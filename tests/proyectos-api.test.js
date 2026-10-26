// API de Proyectos (spec 2026-10-25-proyectos, sección 9): proyectos, hitos, logros del área (hitos sin proyecto) y la línea de
// tiempo. Leen todos los roles con sesión (también el lector y el colaborador); escribe solo administración. Cada error de
// validación es un 400 con su campo, las áreas que no existen no dejan nada a medias (transacción), las fechas van como texto
// 'AAAA-MM-DD' y un proyecto dado de baja (o un hito suyo) da 404. Contra una base de prueba propia, con datos inventados.
// Los archivos (subidas, descargas y borrados) van a una carpeta temporal (UPLOADS_DIR), nunca a uploads/.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { MENSAJES_PROYECTOS, fechaMaxima } from '../services/proyectosReglas.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

let base, servidor, api, usuarios, dbReal, carpeta;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_proyectos_api');
  process.env.DB_NAME = base.nombre;
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'rpad-proyectos-'));
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre, UPLOADS_DIR: carpeta } });
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api, { admin: 'admin', editor: 'editor', colab: 'colaborador', lector: 'lector' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
  if (carpeta) fs.rmSync(carpeta, { recursive: true, force: true });
});

beforeEach(async () => {
  await query('DELETE FROM hito_archivos');
  await query('DELETE FROM proyecto_documentos');
  await query('DELETE FROM proyecto_hitos');
  await query('DELETE FROM proyecto_areas');
  await query('DELETE FROM proyectos');
  await query('DELETE FROM areas');
});

const como = (clave) => ({ token: usuarios[clave].token });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const CLAVES_PROYECTO = ['id', 'nombre', 'descripcion', 'estado', 'fecha_inicio', 'icono', 'color', 'responsable', 'enlace_externo',
  'prioridad', 'categoria', 'orden', 'areas', 'cantidad_hitos', 'hitos_completados', 'cantidad_documentos'];
const CLAVES_DETALLE = [...CLAVES_PROYECTO, 'hitos', 'documentos'];
const CLAVES_HITO = ['id', 'proyecto_id', 'titulo', 'fecha', 'descripcion', 'evidencia_tipo', 'evidencia_url', 'archivos'];
const CLAVES_TIMELINE = [...CLAVES_HITO, 'proyecto_nombre', 'proyecto_color', 'proyecto_icono', 'categoria'];
const CLAVES_ARCHIVO = ['id', 'nombre_archivo', 'tamano', 'mime_type', 'subido_el'];

const claves = (objeto) => Object.keys(objeto).sort();
const ordenadas = (lista) => [...lista].sort();

const crearArea = async (nombre) => (await query('INSERT INTO areas (nombre) VALUES (?)', [nombre])).insertId;

const crearProyecto = async (datos = {}) => {
  const res = await api.post('/gestion/proyectos', { nombre: '[TEST] Proyecto', ...datos }, como('admin'));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.id;
};

const crearHito = async (proyectoId, datos = {}) => {
  const res = await api.post(`/gestion/proyectos/${proyectoId}/hitos`, { titulo: '[TEST] Hito', fecha: '2026-04-10', ...datos }, como('admin'));
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.data.id;
};

// Un archivo o un documento cargado por SQL con un momento fijo (segundos UNIX): así se prueba el día en Argentina
const momentoUnix = (iso) => Math.round(Date.parse(iso) / 1000);
const crearArchivoDeHito = async (hitoId, nombre, iso) => (await query(
  `INSERT INTO hito_archivos (hito_id, nombre_archivo, nombre_almacenado, tamano, mime_type, created_at)
   VALUES (?, ?, ?, ?, 'application/pdf', FROM_UNIXTIME(?))`,
  [hitoId, nombre, `almacenado-${nombre}`, 1234, momentoUnix(iso)]
)).insertId;
const crearDocumento = async (proyectoId, nombre, iso) => (await query(
  `INSERT INTO proyecto_documentos (proyecto_id, nombre_archivo, nombre_almacenado, tamano, mime_type, ruta_archivo, created_at)
   VALUES (?, ?, ?, ?, 'application/pdf', ?, FROM_UNIXTIME(?))`,
  [proyectoId, nombre, `almacenado-${nombre}`, 5678, `proyectos/${proyectoId}/almacenado-${nombre}`, momentoUnix(iso)]
)).insertId;

const cantidad = async (sql, params = []) => Number((await query(sql, params))[0].n);

describe('proyectos', () => {
  it('crear un proyecto con dos áreas da 201 con su id, y el detalle trae las áreas y la fecha de elevación como texto', async () => {
    const areaB = await crearArea('[TEST] Área B');
    const areaA = await crearArea('[TEST] Área A');
    const res = await api.post('/gestion/proyectos', {
      nombre: '  [TEST] Portal de datos  ', descripcion: 'Un portal inventado.', estado: 'en_curso', prioridad: 'alta',
      categoria: 'normativa', fecha_inicio: '2026-03-16', responsable: '[TEST] Responsable', enlace_externo: 'https://ejemplo.test/portal',
      color: '#2E6B4C', icono: 'database', areas: [areaB, areaA]
    }, como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.data.id, 'number');
    assert.equal(res.body.message, 'Proyecto creado');

    const detalle = await api.get(`/gestion/proyectos/${res.body.data.id}`, como('lector'));
    assert.equal(detalle.status, 200);
    const p = detalle.body.data;
    assert.deepEqual(claves(p), ordenadas(CLAVES_DETALLE));
    assert.equal(p.nombre, '[TEST] Portal de datos');
    assert.equal(p.fecha_inicio, '2026-03-16');
    assert.equal(p.estado, 'en_curso');
    assert.equal(p.prioridad, 'alta');
    assert.equal(p.categoria, 'normativa');
    assert.equal(p.icono, 'database');
    assert.equal(p.color, '#2E6B4C');
    assert.equal(p.responsable, '[TEST] Responsable');
    assert.equal(p.enlace_externo, 'https://ejemplo.test/portal');
    assert.equal(p.orden, 0);
    assert.deepEqual(p.areas, [{ id: areaA, nombre: '[TEST] Área A' }, { id: areaB, nombre: '[TEST] Área B' }]);
    assert.deepEqual(p.hitos, []);
    assert.deepEqual(p.documentos, []);
    assert.equal(p.cantidad_hitos, 0);
    assert.equal(p.hitos_completados, 0);
    assert.equal(p.cantidad_documentos, 0);
  });

  it('el editor también crea (es de administración)', async () => {
    const res = await api.post('/gestion/proyectos', { nombre: '[TEST] Del editor' }, como('editor'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('el mínimo: sin color guarda el azul de siempre, y estado, prioridad y categoría por defecto; sin fecha, null', async () => {
    const id = await crearProyecto({ nombre: '[TEST] Mínimo' });
    const { body } = await api.get(`/gestion/proyectos/${id}`, como('admin'));
    assert.equal(body.data.color, '#3b82f6');
    assert.equal(body.data.estado, 'idea');
    assert.equal(body.data.prioridad, 'media');
    assert.equal(body.data.categoria, 'tecnologia');
    assert.equal(body.data.fecha_inicio, null);
    assert.equal(body.data.icono, null);
    assert.deepEqual(body.data.areas, []);
  });

  it('el color #6CA3C6 (fuera de la paleta) se guarda tal cual, en el alta y en la edición', async () => {
    const id = await crearProyecto({ color: '#6CA3C6' });
    assert.equal((await api.get(`/gestion/proyectos/${id}`, como('admin'))).body.data.color, '#6CA3C6');
    const otro = await crearProyecto({ nombre: '[TEST] Otro', color: '#1A365D' });
    const res = await api.put(`/gestion/proyectos/${otro}`, { color: '#6CA3C6' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal((await query('SELECT color FROM proyectos WHERE id = ?', [otro]))[0].color, '#6CA3C6');
  });

  it('un área que no existe da 400 en areas y no deja el proyecto creado (la transacción)', async () => {
    const area = await crearArea('[TEST] Área existente');
    const res = await api.post('/gestion/proyectos', { nombre: '[TEST] Con un área que no existe', areas: [area, 999999] }, como('admin'));
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.success, false);
    assert.equal(res.body.campo, 'areas');
    assert.equal(res.body.error, MENSAJES_PROYECTOS.areas);
    assert.deepEqual(res.body.errores, [{ campo: 'areas', mensaje: MENSAJES_PROYECTOS.areas }]);
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyectos WHERE nombre = ?', ['[TEST] Con un área que no existe']), 0);
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyecto_areas'), 0);
  });

  // Una por regla de services/proyectosReglas.js: el cuerpo es el mínimo válido más el campo que falla
  const hoy = hoyArgentina();
  const CASOS_DEL_PROYECTO = [
    ['nombre vacío', { nombre: '   ' }, 'nombre', MENSAJES_PROYECTOS.nombre],
    ['nombre de 201 caracteres', { nombre: 'n'.repeat(201) }, 'nombre', MENSAJES_PROYECTOS.nombreLargo],
    ['estado que no es de la lista', { estado: 'otro' }, 'estado', MENSAJES_PROYECTOS.estado],
    ['prioridad que no es de la lista', { prioridad: 'urgente' }, 'prioridad', MENSAJES_PROYECTOS.prioridad],
    ['categoría que no es de la lista', { categoria: 'deportes' }, 'categoria', MENSAJES_PROYECTOS.categoria],
    ['fecha de elevación que no existe', { fecha_inicio: '2026-02-30' }, 'fecha_inicio', MENSAJES_PROYECTOS.fechaInicio],
    ['fecha de elevación anterior al 2000', { fecha_inicio: '1999-12-31' }, 'fecha_inicio', MENSAJES_PROYECTOS.fechaInicio],
    ['fecha de elevación después del tope', { fecha_inicio: sumarDias(fechaMaxima(hoy), 1) }, 'fecha_inicio', MENSAJES_PROYECTOS.fechaInicio],
    ['responsable de 151 caracteres', { responsable: 'r'.repeat(151) }, 'responsable', MENSAJES_PROYECTOS.responsable],
    ['enlace que no es http', { enlace_externo: 'javascript:alert(1)' }, 'enlace_externo', MENSAJES_PROYECTOS.enlace],
    ['enlace de más de 500 caracteres', { enlace_externo: `https://${'a'.repeat(493)}` }, 'enlace_externo', MENSAJES_PROYECTOS.enlaceLargo],
    ['color que no es #RRGGBB', { color: 'red' }, 'color', MENSAJES_PROYECTOS.color],
    ['ícono que no es de la lista', { icono: 'rocket' }, 'icono', MENSAJES_PROYECTOS.icono],
    ['áreas con un id inválido', { areas: [1, 'x'] }, 'areas', MENSAJES_PROYECTOS.areas]
  ];
  for (const [caso, cuerpo, campo, mensaje] of CASOS_DEL_PROYECTO) {
    it(`alta con ${caso}: 400 en ${campo}, sin guardar nada`, async () => {
      const res = await api.post('/gestion/proyectos', { nombre: '[TEST] Válido', ...cuerpo }, como('admin'));
      assert.equal(res.status, 400, JSON.stringify(res.body));
      assert.equal(res.body.success, false);
      assert.equal(res.body.campo, campo);
      assert.equal(res.body.error, mensaje);
      assert.deepEqual(res.body.errores, [{ campo, mensaje }]);
      assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyectos'), 0);
    });
  }

  it('un PUT solo con la descripción no cambia el nombre ni las áreas', async () => {
    const area = await crearArea('[TEST] Área que queda');
    const id = await crearProyecto({ nombre: '[TEST] Nombre original', descripcion: 'Vieja', areas: [area] });
    const res = await api.put(`/gestion/proyectos/${id}`, { descripcion: 'Nueva' }, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.message, 'Proyecto actualizado');
    assert.equal(res.body.data.id, id);
    const { body } = await api.get(`/gestion/proyectos/${id}`, como('admin'));
    assert.equal(body.data.nombre, '[TEST] Nombre original');
    assert.equal(body.data.descripcion, 'Nueva');
    assert.deepEqual(body.data.areas, [{ id: area, nombre: '[TEST] Área que queda' }]);
  });

  it('PUT { nombre: "" } da 400 en nombre y no cambia nada; PUT {} da 400 sin campo', async () => {
    const id = await crearProyecto({ nombre: '[TEST] Sin tocar' });
    const vacio = await api.put(`/gestion/proyectos/${id}`, { nombre: '' }, como('admin'));
    assert.equal(vacio.status, 400);
    assert.equal(vacio.body.campo, 'nombre');
    assert.equal(vacio.body.error, MENSAJES_PROYECTOS.nombre);
    assert.equal((await query('SELECT nombre FROM proyectos WHERE id = ?', [id]))[0].nombre, '[TEST] Sin tocar');

    const nada = await api.put(`/gestion/proyectos/${id}`, {}, como('admin'));
    assert.equal(nada.status, 400);
    assert.equal(nada.body.campo, null);
    assert.equal(nada.body.error, MENSAJES_PROYECTOS.sinDatos);

    const invalido = await api.put(`/gestion/proyectos/${id}`, { estado: '' }, como('admin'));
    assert.equal(invalido.status, 400);
    assert.equal(invalido.body.campo, 'estado');
  });

  it('PUT con áreas las reemplaza; con un área que no existe da 400 y conserva todo lo anterior', async () => {
    const a = await crearArea('[TEST] Área 1');
    const b = await crearArea('[TEST] Área 2');
    const id = await crearProyecto({ nombre: '[TEST] Con áreas', areas: [a] });
    const cambio = await api.put(`/gestion/proyectos/${id}`, { areas: [b] }, como('admin'));
    assert.equal(cambio.status, 200, JSON.stringify(cambio.body));
    assert.deepEqual(cambio.body.data.areas, [{ id: b, nombre: '[TEST] Área 2' }]);

    const malo = await api.put(`/gestion/proyectos/${id}`, { nombre: '[TEST] Renombrado', areas: [a, 999999] }, como('admin'));
    assert.equal(malo.status, 400, JSON.stringify(malo.body));
    assert.equal(malo.body.campo, 'areas');
    const { body } = await api.get(`/gestion/proyectos/${id}`, como('admin'));
    assert.equal(body.data.nombre, '[TEST] Con áreas');
    assert.deepEqual(body.data.areas, [{ id: b, nombre: '[TEST] Área 2' }]);

    const ninguna = await api.put(`/gestion/proyectos/${id}`, { areas: [] }, como('admin'));
    assert.equal(ninguna.status, 200);
    assert.deepEqual(ninguna.body.data.areas, []);
  });

  it('PUT de un proyecto que no existe da 404', async () => {
    const res = await api.put('/gestion/proyectos/999999', { descripcion: 'x' }, como('admin'));
    assert.equal(res.status, 404);
    assert.equal(res.body.error, 'Proyecto no encontrado');
  });

  it('el DELETE da de baja: el detalle da 404, la lista y la timeline no lo traen y sus hitos dan 404', async () => {
    const id = await crearProyecto({ nombre: '[TEST] A dar de baja' });
    const hito = await crearHito(id, { titulo: '[TEST] Hito del dado de baja' });
    const res = await api.delete(`/gestion/proyectos/${id}`, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.message, 'Proyecto eliminado');
    assert.equal(Number((await query('SELECT activo FROM proyectos WHERE id = ?', [id]))[0].activo), 0);

    assert.equal((await api.get(`/gestion/proyectos/${id}`, como('admin'))).status, 404);
    assert.ok(!(await api.get('/gestion/proyectos', como('admin'))).body.data.some((p) => p.id === id));
    assert.ok(!(await api.get('/gestion/timeline', como('admin'))).body.data.some((h) => h.id === hito));

    const editar = await api.put(`/gestion/hitos/${hito}`, { titulo: '[TEST] Cambiado' }, como('admin'));
    assert.equal(editar.status, 404);
    assert.equal(editar.body.error, 'Hito no encontrado');
    const borrar = await api.delete(`/gestion/hitos/${hito}`, como('admin'));
    assert.equal(borrar.status, 404);
    assert.equal(borrar.body.error, 'Hito no encontrado');
    assert.equal((await query('SELECT titulo FROM proyecto_hitos WHERE id = ?', [hito]))[0].titulo, '[TEST] Hito del dado de baja');

    assert.equal((await api.post(`/gestion/proyectos/${id}/hitos`, { titulo: '[TEST] Otro', fecha: '2026-04-01' }, como('admin'))).status, 404);
    assert.equal((await api.put(`/gestion/proyectos/${id}`, { descripcion: 'x' }, como('admin'))).status, 404);
    assert.equal((await api.delete(`/gestion/proyectos/${id}`, como('admin'))).status, 404);
  });

  it('la lista: los activos por categoría, orden y nombre, con sus áreas y cantidades (completados hasta hoy en Argentina)', async () => {
    const area = await crearArea('[TEST] Área de la lista');
    const difusion = await crearProyecto({ nombre: '[TEST] A difusión', categoria: 'difusion' });
    const tecDos = await crearProyecto({ nombre: '[TEST] B tecnología', categoria: 'tecnologia', fecha_inicio: '2025-08-01', areas: [area] });
    const tecUno = await crearProyecto({ nombre: '[TEST] C tecnología', categoria: 'tecnologia' });
    const normativa = await crearProyecto({ nombre: '[TEST] D normativa', categoria: 'normativa' });
    const baja = await crearProyecto({ nombre: '[TEST] E dado de baja' });
    await query('UPDATE proyectos SET orden = 2 WHERE id = ?', [tecDos]);
    await query('UPDATE proyectos SET orden = 1 WHERE id = ?', [tecUno]);
    await query('UPDATE proyectos SET activo = FALSE WHERE id = ?', [baja]);

    const hoy = hoyArgentina();
    await crearHito(tecDos, { fecha: '2026-01-10' });
    await crearHito(tecDos, { fecha: hoy });
    await crearHito(tecDos, { fecha: sumarDias(hoy, 30) });
    await crearDocumento(tecDos, 'uno.pdf', '2026-03-17T12:00:00Z');
    await crearDocumento(tecDos, 'dos.pdf', '2026-03-18T12:00:00Z');

    const res = await api.get('/gestion/proyectos', como('lector'));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.data.map((p) => p.id), [tecUno, tecDos, normativa, difusion]);
    for (const p of res.body.data) assert.deepEqual(claves(p), ordenadas(CLAVES_PROYECTO));
    const b = res.body.data.find((p) => p.id === tecDos);
    assert.equal(b.fecha_inicio, '2025-08-01');
    assert.deepEqual(b.areas, [{ id: area, nombre: '[TEST] Área de la lista' }]);
    assert.equal(b.cantidad_hitos, 3);
    assert.equal(b.hitos_completados, 2);
    assert.equal(b.cantidad_documentos, 2);
    const c = res.body.data.find((p) => p.id === tecUno);
    assert.equal(c.fecha_inicio, null);
    assert.equal(c.cantidad_hitos, 0);
    assert.equal(c.hitos_completados, 0);
    assert.equal(c.cantidad_documentos, 0);
  });

  it('un id que no es un entero positivo da 404 (GET, PUT y DELETE); uno que no existe, también', async () => {
    for (const id of ['abc', '0', '-3', '1.5', '1e3']) {
      const res = await api.get(`/gestion/proyectos/${id}`, como('admin'));
      assert.equal(res.status, 404, id);
      assert.equal(res.body.success, false, id);
      assert.equal(res.body.error, 'Proyecto no encontrado', id);
    }
    assert.equal((await api.get('/gestion/proyectos/999999', como('admin'))).status, 404);
    assert.equal((await api.put('/gestion/proyectos/abc', { descripcion: 'x' }, como('admin'))).status, 404);
    assert.equal((await api.delete('/gestion/proyectos/abc', como('admin'))).status, 404);
  });
});

describe('hitos y logros', () => {
  it('el hito con evidencia_url queda en url y sin ella en ninguno, aunque llegue evidencia_tipo archivo', async () => {
    const id = await crearProyecto();
    const conEnlace = await api.post(`/gestion/proyectos/${id}/hitos`, {
      titulo: '  [TEST] Con enlace ', fecha: '2026-04-10', descripcion: 'Algo.', evidencia_url: 'https://ejemplo.test/acta', evidencia_tipo: 'archivo'
    }, como('admin'));
    assert.equal(conEnlace.status, 201, JSON.stringify(conEnlace.body));
    assert.equal(conEnlace.body.message, 'Hito creado');
    assert.deepEqual(claves(conEnlace.body.data), ordenadas(CLAVES_HITO));
    assert.equal(conEnlace.body.data.titulo, '[TEST] Con enlace');
    assert.equal(conEnlace.body.data.fecha, '2026-04-10');
    assert.equal(conEnlace.body.data.proyecto_id, id);
    assert.equal(conEnlace.body.data.evidencia_tipo, 'url');

    const sinEnlace = await api.post(`/gestion/proyectos/${id}/hitos`, {
      titulo: '[TEST] Sin enlace', fecha: '2026-04-11', evidencia_tipo: 'archivo'
    }, como('admin'));
    assert.equal(sinEnlace.status, 201, JSON.stringify(sinEnlace.body));
    assert.equal(sinEnlace.body.data.evidencia_tipo, 'ninguno');
    assert.equal((await query('SELECT evidencia_tipo FROM proyecto_hitos WHERE id = ?', [sinEnlace.body.data.id]))[0].evidencia_tipo, 'ninguno');
  });

  it('el detalle trae los hitos por fecha descendente, con sus archivos y los documentos (subido_el, el día en Argentina)', async () => {
    const id = await crearProyecto();
    const viejo = await crearHito(id, { titulo: '[TEST] Viejo', fecha: '2026-02-01' });
    const nuevo = await crearHito(id, { titulo: '[TEST] Nuevo', fecha: '2026-05-01' });
    // 01:30 en UTC del 17/03 es el 16/03 a las 22:30 en Argentina
    const tarde = await crearArchivoDeHito(nuevo, 'acta.pdf', '2026-03-17T01:30:00Z');
    const despues = await crearArchivoDeHito(nuevo, 'foto.pdf', '2026-03-17T12:00:00Z');
    const documento = await crearDocumento(id, 'informe.pdf', '2026-03-17T02:59:00Z');

    const { status, body } = await api.get(`/gestion/proyectos/${id}`, como('colab'));
    assert.equal(status, 200);
    assert.deepEqual(body.data.hitos.map((h) => h.id), [nuevo, viejo]);
    for (const h of body.data.hitos) {
      assert.deepEqual(claves(h), ordenadas(CLAVES_HITO));
      assert.match(h.fecha, FECHA);
    }
    const [primero, segundo] = body.data.hitos;
    assert.deepEqual(primero.archivos.map((a) => a.id), [despues, tarde]);
    for (const a of primero.archivos) assert.deepEqual(claves(a), ordenadas(CLAVES_ARCHIVO));
    assert.deepEqual(primero.archivos[1], { id: tarde, nombre_archivo: 'acta.pdf', tamano: 1234, mime_type: 'application/pdf', subido_el: '2026-03-16' });
    assert.equal(primero.archivos[0].subido_el, '2026-03-17');
    assert.deepEqual(segundo.archivos, []);
    assert.deepEqual(body.data.documentos, [
      { id: documento, nombre_archivo: 'informe.pdf', tamano: 5678, mime_type: 'application/pdf', subido_el: '2026-03-16' }
    ]);
    assert.equal(body.data.cantidad_hitos, 2);
    assert.equal(body.data.cantidad_documentos, 1);
  });

  it('PUT de un hito cambia solo lo que viene y vuelve a derivar la evidencia', async () => {
    const id = await crearProyecto();
    const hito = await crearHito(id, { titulo: '[TEST] Original', fecha: '2026-04-10', descripcion: 'Desc.' });

    const conEnlace = await api.put(`/gestion/hitos/${hito}`, { evidencia_url: 'https://ejemplo.test/x', evidencia_tipo: 'ninguno' }, como('admin'));
    assert.equal(conEnlace.status, 200, JSON.stringify(conEnlace.body));
    assert.equal(conEnlace.body.message, 'Hito actualizado');
    assert.equal(conEnlace.body.data.evidencia_tipo, 'url');
    assert.equal(conEnlace.body.data.titulo, '[TEST] Original');
    assert.equal(conEnlace.body.data.descripcion, 'Desc.');
    assert.equal(conEnlace.body.data.fecha, '2026-04-10');

    const soloTitulo = await api.put(`/gestion/hitos/${hito}`, { titulo: '[TEST] Renombrado' }, como('admin'));
    assert.equal(soloTitulo.status, 200);
    assert.equal(soloTitulo.body.data.evidencia_tipo, 'url');
    assert.equal(soloTitulo.body.data.evidencia_url, 'https://ejemplo.test/x');

    await crearArchivoDeHito(hito, 'evidencia.pdf', '2026-04-10T15:00:00Z');
    const sinEnlace = await api.put(`/gestion/hitos/${hito}`, { evidencia_url: '' }, como('admin'));
    assert.equal(sinEnlace.status, 200);
    assert.equal(sinEnlace.body.data.evidencia_url, null);
    assert.equal(sinEnlace.body.data.evidencia_tipo, 'archivo');
    assert.equal(sinEnlace.body.data.archivos.length, 1);

    const soloTipo = await api.put(`/gestion/hitos/${hito}`, { evidencia_tipo: 'url' }, como('admin'));
    assert.equal(soloTipo.status, 400);
    assert.equal(soloTipo.body.campo, null);
    assert.equal(soloTipo.body.error, MENSAJES_PROYECTOS.sinDatos);

    const tituloVacio = await api.put(`/gestion/hitos/${hito}`, { titulo: '' }, como('admin'));
    assert.equal(tituloVacio.status, 400);
    assert.equal(tituloVacio.body.campo, 'titulo');
    assert.equal((await query('SELECT titulo FROM proyecto_hitos WHERE id = ?', [hito]))[0].titulo, '[TEST] Renombrado');
  });

  const hoy = hoyArgentina();
  const CASOS_DEL_HITO = [
    ['sin título', { titulo: undefined }, 'titulo', MENSAJES_PROYECTOS.titulo],
    ['título de 201 caracteres', { titulo: 't'.repeat(201) }, 'titulo', MENSAJES_PROYECTOS.tituloLargo],
    ['sin fecha', { fecha: undefined }, 'fecha', MENSAJES_PROYECTOS.fecha],
    ['fecha que no existe', { fecha: '2026-02-30' }, 'fecha', MENSAJES_PROYECTOS.fechaInvalida],
    ['fecha anterior al 2000', { fecha: '1999-12-31' }, 'fecha', MENSAJES_PROYECTOS.fechaInvalida],
    ['fecha después del tope', { fecha: sumarDias(fechaMaxima(hoy), 1) }, 'fecha', MENSAJES_PROYECTOS.fechaInvalida],
    ['evidencia que no es http', { evidencia_url: 'ftp://ejemplo.test/x' }, 'evidencia_url', MENSAJES_PROYECTOS.evidencia],
    ['evidencia de más de 500 caracteres', { evidencia_url: `https://${'e'.repeat(493)}` }, 'evidencia_url', MENSAJES_PROYECTOS.evidenciaLarga]
  ];
  for (const [caso, cuerpo, campo, mensaje] of CASOS_DEL_HITO) {
    it(`hito ${caso}: 400 en ${campo}, sin guardar nada (también como logro)`, async () => {
      const id = await crearProyecto();
      const datos = { titulo: '[TEST] Válido', fecha: '2026-04-10', ...cuerpo };
      for (const ruta of [`/gestion/proyectos/${id}/hitos`, '/gestion/logros']) {
        const res = await api.post(ruta, datos, como('admin'));
        assert.equal(res.status, 400, `${ruta} ${JSON.stringify(res.body)}`);
        assert.equal(res.body.success, false);
        assert.equal(res.body.campo, campo);
        assert.equal(res.body.error, mensaje);
        assert.deepEqual(res.body.errores, [{ campo, mensaje }]);
      }
      assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyecto_hitos'), 0);
    });
  }

  it('un hito previsto (fecha posterior a hoy) se acepta', async () => {
    const id = await crearProyecto();
    const res = await api.post(`/gestion/proyectos/${id}/hitos`, { titulo: '[TEST] Previsto', fecha: sumarDias(hoyArgentina(), 60) }, como('admin'));
    assert.equal(res.status, 201, JSON.stringify(res.body));
  });

  it('crear un hito en un proyecto que no existe, o con un id inválido, da 404', async () => {
    for (const proyecto of ['999999', 'abc', '0']) {
      const res = await api.post(`/gestion/proyectos/${proyecto}/hitos`, { titulo: '[TEST] Huérfano', fecha: '2026-04-10' }, como('admin'));
      assert.equal(res.status, 404, proyecto);
      assert.equal(res.body.error, 'Proyecto no encontrado', proyecto);
    }
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyecto_hitos'), 0);
  });

  it('PUT y DELETE de un hito que no existe, o con un id inválido, dan 404', async () => {
    for (const hito of ['999999', 'abc', '-1']) {
      const editar = await api.put(`/gestion/hitos/${hito}`, { titulo: '[TEST] x' }, como('admin'));
      assert.equal(editar.status, 404, hito);
      assert.equal(editar.body.error, 'Hito no encontrado', hito);
      const borrar = await api.delete(`/gestion/hitos/${hito}`, como('admin'));
      assert.equal(borrar.status, 404, hito);
      assert.equal(borrar.body.error, 'Hito no encontrado', hito);
    }
  });

  it('el logro (POST /gestion/logros) aparece en la timeline con proyecto_id null, y las fechas de la timeline son texto', async () => {
    const id = await crearProyecto({ nombre: '[TEST] Con hitos', color: '#0E7490', icono: 'flag', categoria: 'difusion' });
    const hito = await crearHito(id, { titulo: '[TEST] Hito del proyecto', fecha: '2026-03-01' });
    await crearArchivoDeHito(hito, 'acta.pdf', '2026-03-17T01:30:00Z');
    const logro = await api.post('/gestion/logros', {
      titulo: '[TEST] Logro del área', fecha: '2026-05-20', evidencia_url: 'https://ejemplo.test/logro', evidencia_tipo: 'archivo'
    }, como('admin'));
    assert.equal(logro.status, 201, JSON.stringify(logro.body));
    assert.equal(logro.body.message, 'Logro registrado');
    assert.equal(logro.body.data.proyecto_id, null);
    assert.equal(logro.body.data.evidencia_tipo, 'url');
    assert.equal(logro.body.data.fecha, '2026-05-20');

    const res = await api.get('/gestion/timeline', como('lector'));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map((h) => h.id), [logro.body.data.id, hito]);
    for (const h of res.body.data) {
      assert.deepEqual(claves(h), ordenadas(CLAVES_TIMELINE));
      assert.match(h.fecha, FECHA);
      for (const a of h.archivos) {
        assert.deepEqual(claves(a), ordenadas(CLAVES_ARCHIVO));
        assert.match(a.subido_el, FECHA);
      }
    }
    const [delArea, delProyecto] = res.body.data;
    assert.equal(delArea.proyecto_id, null);
    assert.equal(delArea.proyecto_nombre, null);
    assert.equal(delArea.fecha, '2026-05-20');
    assert.deepEqual(delArea.archivos, []);
    assert.equal(delProyecto.proyecto_id, id);
    assert.equal(delProyecto.proyecto_nombre, '[TEST] Con hitos');
    assert.equal(delProyecto.proyecto_color, '#0E7490');
    assert.equal(delProyecto.proyecto_icono, 'flag');
    assert.equal(delProyecto.categoria, 'difusion');
    assert.equal(delProyecto.fecha, '2026-03-01');
    assert.equal(delProyecto.archivos[0].subido_el, '2026-03-16');
  });

  it('un logro se edita y se borra por /gestion/hitos/:id', async () => {
    const logro = (await api.post('/gestion/logros', { titulo: '[TEST] Logro', fecha: '2026-05-20' }, como('admin'))).body.data.id;
    const editar = await api.put(`/gestion/hitos/${logro}`, { fecha: '2026-06-01' }, como('admin'));
    assert.equal(editar.status, 200, JSON.stringify(editar.body));
    assert.equal(editar.body.data.fecha, '2026-06-01');
    assert.equal(editar.body.data.proyecto_id, null);
    const borrar = await api.delete(`/gestion/hitos/${logro}`, como('admin'));
    assert.equal(borrar.status, 200);
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyecto_hitos WHERE id = ?', [logro]), 0);
  });

  it('DELETE de un hito borra la fila y las de sus archivos', async () => {
    const id = await crearProyecto();
    const hito = await crearHito(id);
    await crearArchivoDeHito(hito, 'a.pdf', '2026-04-10T15:00:00Z');
    await crearArchivoDeHito(hito, 'b.pdf', '2026-04-10T16:00:00Z');
    const res = await api.delete(`/gestion/hitos/${hito}`, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.message, 'Hito eliminado');
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyecto_hitos WHERE id = ?', [hito]), 0);
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM hito_archivos WHERE hito_id = ?', [hito]), 0);
    assert.equal((await api.delete(`/gestion/hitos/${hito}`, como('admin'))).status, 404);
  });
});

describe('permisos', () => {
  let proyectoId, hitoId;
  beforeEach(async () => {
    proyectoId = await crearProyecto({ nombre: '[TEST] Intocable' });
    hitoId = await crearHito(proyectoId, { titulo: '[TEST] Hito intocable' });
  });

  const lecturas = () => ['/gestion/proyectos', `/gestion/proyectos/${proyectoId}`, '/gestion/timeline'];
  const escrituras = () => [
    ['POST', '/gestion/proyectos', { nombre: '[TEST] Intruso' }],
    ['PUT', `/gestion/proyectos/${proyectoId}`, { nombre: '[TEST] Cambiado' }],
    ['DELETE', `/gestion/proyectos/${proyectoId}`],
    ['POST', '/gestion/logros', { titulo: '[TEST] Logro intruso', fecha: '2026-05-01' }],
    ['POST', `/gestion/proyectos/${proyectoId}/hitos`, { titulo: '[TEST] Hito intruso', fecha: '2026-05-01' }],
    ['PUT', `/gestion/hitos/${hitoId}`, { titulo: '[TEST] Cambiado' }],
    ['DELETE', `/gestion/hitos/${hitoId}`]
  ];
  const pedir = (metodo, ruta, cuerpo, opciones) => {
    if (metodo === 'DELETE') return api.delete(ruta, opciones);
    return metodo === 'POST' ? api.post(ruta, cuerpo, opciones) : api.put(ruta, cuerpo, opciones);
  };
  const nadaCambio = async () => {
    assert.deepEqual((await query('SELECT id, nombre, activo FROM proyectos')).map((p) => [p.id, p.nombre, Number(p.activo)]),
      [[proyectoId, '[TEST] Intocable', 1]]);
    assert.deepEqual((await query('SELECT id, titulo FROM proyecto_hitos')).map((h) => [h.id, h.titulo]), [[hitoId, '[TEST] Hito intocable']]);
  };

  for (const clave of ['lector', 'colab']) {
    it(`${clave === 'colab' ? 'el colaborador' : 'el lector'} recibe 200 en los tres GET y 403 en cada escritura`, async () => {
      for (const ruta of lecturas()) {
        const res = await api.get(ruta, como(clave));
        assert.equal(res.status, 200, ruta);
        assert.equal(res.body.success, true, ruta);
      }
      for (const [metodo, ruta, cuerpo] of escrituras()) {
        const res = await pedir(metodo, ruta, cuerpo, como(clave));
        assert.equal(res.status, 403, `${metodo} ${ruta}`);
      }
      await nadaCambio();
    });
  }

  it('sin sesión, 401 en las lecturas y en las escrituras', async () => {
    for (const ruta of lecturas()) assert.equal((await api.get(ruta)).status, 401, ruta);
    for (const [metodo, ruta, cuerpo] of escrituras()) {
      assert.equal((await pedir(metodo, ruta, cuerpo, {})).status, 401, `${metodo} ${ruta}`);
    }
    await nadaCambio();
  });
});

// Los archivos (spec 2026-10-25-proyectos, 6 a 9, arreglos 2 a 9 y 12): antes de que multer lea el pedido se valida el id, que el
// proyecto (activo) o el hito existan y que queden lugares; multer recibe como límite los lugares que quedan y borra lo que escribió si
// algo falla; los nombres con tildes se guardan bien; las descargas son para todos los roles con sesión; borrar un hito borra su carpeta
describe('archivos', () => {
  const MENSAJE_HITO_LLENO = 'Podés subir hasta 3 archivos por hito.';
  const MENSAJE_PROYECTO_LLENO = 'Podés subir hasta 10 documentos por proyecto.';
  const MENSAJE_FALTANTE = 'El archivo no está en el servidor.';
  const ALMACENADO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

  beforeEach(() => {
    for (const sub of ['proyectos', 'hitos']) fs.rmSync(path.join(carpeta, sub), { recursive: true, force: true });
  });

  const contenidoDe = (nombre) => Buffer.from(`%PDF-1.4 [TEST] ${nombre}`);
  const pdf = (nombre) => new File([contenidoDe(nombre)], nombre, { type: 'application/pdf' });

  // Una subida como la manda el navegador: FormData con el campo «archivos» y el JWT, sin Content-Type a mano
  const subir = async (ruta, archivos, clave = 'admin') => {
    const formulario = new FormData();
    for (const archivo of archivos) formulario.append('archivos', archivo);
    const res = await fetch(`${servidor.url}/api${ruta}`, {
      method: 'POST',
      headers: clave ? { Authorization: `Bearer ${usuarios[clave].token}` } : {},
      body: formulario
    });
    const tipo = res.headers.get('content-type') || '';
    return { status: res.status, body: tipo.includes('application/json') ? await res.json() : await res.text() };
  };
  const subirDocumentos = (proyectoId, archivos, clave) => subir(`/gestion/proyectos/${proyectoId}/documentos`, archivos, clave);
  const subirArchivos = (hitoId, archivos, clave) => subir(`/gestion/hitos/${hitoId}/archivos`, archivos, clave);

  // Lo que hay en una carpeta de la temporal (ordenado), o null si la carpeta no existe
  const enCarpeta = (...partes) => {
    const dir = path.join(carpeta, ...partes);
    return fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null;
  };

  const documentosDe = (proyectoId) => query(
    'SELECT id, nombre_archivo, nombre_almacenado, ruta_archivo, tamano, mime_type FROM proyecto_documentos WHERE proyecto_id = ? ORDER BY id',
    [proyectoId]
  );
  const archivosDe = (hitoId) => query(
    'SELECT id, nombre_archivo, nombre_almacenado, tamano, mime_type FROM hito_archivos WHERE hito_id = ? ORDER BY id', [hitoId]
  );
  const evidenciaDe = async (hitoId) => (await query('SELECT evidencia_tipo FROM proyecto_hitos WHERE id = ?', [hitoId]))[0].evidencia_tipo;
  // El filename* de un Content-Disposition, decodificado
  const nombreDescargado = (disposicion) => decodeURIComponent(/filename\*=UTF-8''([^;]+)/.exec(disposicion ?? '')?.[1] ?? '');

  it('subir 2 PDF a un proyecto da 201 y dos filas, con ruta_archivo relativa y los archivos en <tmp>/proyectos/<id>/', async () => {
    const id = await crearProyecto();
    const res = await subirDocumentos(id, [pdf('uno.pdf'), pdf('dos.pdf')]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.success, true);
    assert.equal(res.body.message, '2 documentos subidos');
    assert.equal(res.body.data.length, 2);
    for (const archivo of res.body.data) {
      assert.deepEqual(claves(archivo), ordenadas(CLAVES_ARCHIVO));
      assert.match(archivo.subido_el, FECHA);
    }

    const filas = await documentosDe(id);
    assert.deepEqual(filas.map((f) => f.nombre_archivo), ['uno.pdf', 'dos.pdf']);
    assert.deepEqual(res.body.data.map((a) => a.id), filas.map((f) => f.id));
    for (const fila of filas) {
      assert.match(fila.nombre_almacenado, ALMACENADO);
      assert.equal(fila.ruta_archivo, `proyectos/${id}/${fila.nombre_almacenado}`);
      assert.equal(fila.tamano, contenidoDe(fila.nombre_archivo).length);
      assert.equal(fila.mime_type, 'application/pdf');
      assert.deepEqual(fs.readFileSync(path.join(carpeta, 'proyectos', String(id), fila.nombre_almacenado)), contenidoDe(fila.nombre_archivo));
    }
    assert.deepEqual(enCarpeta('proyectos', String(id)), filas.map((f) => f.nombre_almacenado).sort());
    assert.equal((await api.get(`/gestion/proyectos/${id}`, como('admin'))).body.data.cantidad_documentos, 2);

    const uno = await subirDocumentos(id, [pdf('tres.pdf')]);
    assert.equal(uno.status, 201, JSON.stringify(uno.body));
    assert.equal(uno.body.message, '1 documento subido');
  });

  it('«presentación final.pdf» queda con ese nombre y se descarga con ese nombre (filename*), también en un hito', async () => {
    const id = await crearProyecto();
    const res = await subirDocumentos(id, [pdf('presentación final.pdf')]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.data[0].nombre_archivo, 'presentación final.pdf');
    const [fila] = await documentosDe(id);
    assert.equal(fila.nombre_archivo, 'presentación final.pdf');
    assert.equal((await api.get(`/gestion/proyectos/${id}`, como('lector'))).body.data.documentos[0].nombre_archivo, 'presentación final.pdf');

    const bajada = await api.get(`/gestion/proyectos/${id}/documentos/${fila.id}/descargar`, como('lector'));
    assert.equal(bajada.status, 200);
    const disposicion = bajada.headers.get('content-disposition');
    assert.match(disposicion, /^attachment;/);
    assert.ok(disposicion.includes("filename*=UTF-8''presentaci%C3%B3n%20final.pdf"), disposicion);
    assert.equal(nombreDescargado(disposicion), 'presentación final.pdf');

    const hito = await crearHito(id);
    const subida = await subirArchivos(hito, [pdf('Señal año 2026.pdf')]);
    assert.equal(subida.status, 201, JSON.stringify(subida.body));
    const [archivo] = await archivosDe(hito);
    assert.equal(archivo.nombre_archivo, 'Señal año 2026.pdf');
    const otra = await api.get(`/gestion/hitos/${hito}/archivos/${archivo.id}/descargar`, como('lector'));
    assert.equal(otra.status, 200);
    assert.equal(nombreDescargado(otra.headers.get('content-disposition')), 'Señal año 2026.pdf');
  });

  it('un nombre de más de 255 caracteres se guarda cortado en 255, con su extensión', async () => {
    const id = await crearProyecto();
    const res = await subirDocumentos(id, [pdf(`${'n'.repeat(296)}.pdf`)]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const [fila] = await documentosDe(id);
    assert.equal(fila.nombre_archivo, `${'n'.repeat(251)}.pdf`);
  });

  it('el lector y el colaborador descargan un documento y un archivo de hito: 200 y los mismos bytes; sin sesión, 401', async () => {
    const id = await crearProyecto();
    const hito = await crearHito(id);
    assert.equal((await subirDocumentos(id, [pdf('documento.pdf')])).status, 201);
    assert.equal((await subirArchivos(hito, [pdf('evidencia.pdf')])).status, 201);
    const [documento] = await documentosDe(id);
    const [archivo] = await archivosDe(hito);
    const rutas = [
      [`/gestion/proyectos/${id}/documentos/${documento.id}/descargar`, contenidoDe('documento.pdf')],
      [`/gestion/hitos/${hito}/archivos/${archivo.id}/descargar`, contenidoDe('evidencia.pdf')]
    ];
    for (const clave of ['lector', 'colab', 'admin']) {
      for (const [ruta, bytes] of rutas) {
        const res = await api.get(ruta, como(clave));
        assert.equal(res.status, 200, `${clave} ${ruta}`);
        assert.equal(res.headers.get('content-type'), 'application/pdf');
        assert.deepEqual(Buffer.from(res.body), bytes, `${clave} ${ruta}`);
      }
    }
    for (const [ruta] of rutas) assert.equal((await api.get(ruta)).status, 401, ruta);
  });

  it('el lector y el colaborador reciben 403 al subir y al borrar, sin escribir ni borrar nada', async () => {
    const id = await crearProyecto();
    const hito = await crearHito(id);
    assert.equal((await subirDocumentos(id, [pdf('documento.pdf')])).status, 201);
    assert.equal((await subirArchivos(hito, [pdf('evidencia.pdf')])).status, 201);
    const [documento] = await documentosDe(id);
    const [archivo] = await archivosDe(hito);
    for (const clave of ['lector', 'colab']) {
      assert.equal((await subirDocumentos(id, [pdf('intruso.pdf')], clave)).status, 403, clave);
      assert.equal((await subirArchivos(hito, [pdf('intruso.pdf')], clave)).status, 403, clave);
      assert.equal((await api.delete(`/gestion/proyectos/${id}/documentos/${documento.id}`, como(clave))).status, 403, clave);
      assert.equal((await api.delete(`/gestion/hitos/${hito}/archivos/${archivo.id}`, como(clave))).status, 403, clave);
    }
    assert.deepEqual((await documentosDe(id)).map((f) => f.nombre_archivo), ['documento.pdf']);
    assert.deepEqual((await archivosDe(hito)).map((f) => f.nombre_archivo), ['evidencia.pdf']);
    assert.deepEqual(enCarpeta('proyectos', String(id)), [documento.nombre_almacenado]);
    assert.deepEqual(enCarpeta('hitos', String(hito)), [archivo.nombre_almacenado]);
    assert.equal((await subirDocumentos(id, [pdf('anonimo.pdf')], null)).status, 401);
    assert.deepEqual(enCarpeta('proyectos', String(id)), [documento.nombre_almacenado]);
  });

  it('subir a un proyecto o a un hito que no existe, o a un proyecto dado de baja, da 404 sin crear su carpeta', async () => {
    const res = await subirDocumentos(999999, [pdf('perdido.pdf')]);
    assert.equal(res.status, 404, JSON.stringify(res.body));
    assert.equal(res.body.error, 'Proyecto no encontrado');
    assert.equal(enCarpeta('proyectos', '999999'), null);

    const hito = await subirArchivos(999999, [pdf('perdido.pdf')]);
    assert.equal(hito.status, 404, JSON.stringify(hito.body));
    assert.equal(hito.body.error, 'Hito no encontrado');
    assert.equal(enCarpeta('hitos', '999999'), null);

    const id = await crearProyecto();
    const hitoDeBaja = await crearHito(id);
    assert.equal((await api.delete(`/gestion/proyectos/${id}`, como('admin'))).status, 200);
    assert.equal((await subirDocumentos(id, [pdf('tarde.pdf')])).status, 404);
    assert.equal((await subirArchivos(hitoDeBaja, [pdf('tarde.pdf')])).status, 404);
    assert.equal(enCarpeta('proyectos', String(id)), null);
    assert.equal(enCarpeta('hitos', String(hitoDeBaja)), null);
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM proyecto_documentos'), 0);
    assert.equal(await cantidad('SELECT COUNT(*) AS n FROM hito_archivos'), 0);
  });

  it('subir a /gestion/proyectos/..%2F..%2Fescape/documentos (o a un hito así) da 404, sin escribir nada fuera de <tmp>', async () => {
    const escape = `rpad-escape-${crypto.randomBytes(4).toString('hex')}`;
    const afuera = path.resolve(carpeta, 'proyectos', '..', '..', escape);
    assert.equal(fs.existsSync(afuera), false);
    for (const ruta of [`/gestion/proyectos/..%2F..%2F${escape}/documentos`, `/gestion/hitos/..%2F..%2F${escape}/archivos`]) {
      const res = await subir(ruta, [pdf('escape.pdf')]);
      assert.equal(res.status, 404, `${ruta} ${JSON.stringify(res.body)}`);
      assert.equal(fs.existsSync(afuera), false, ruta);
    }
    assert.equal(enCarpeta('proyectos'), null);
    assert.equal(enCarpeta('hitos'), null);
    for (const id of ['abc', '0', '-3', '1.5']) {
      assert.equal((await subirDocumentos(id, [pdf('raro.pdf')])).status, 404, id);
      assert.equal((await subirArchivos(id, [pdf('raro.pdf')])).status, 404, id);
    }
    assert.equal(enCarpeta('proyectos'), null);
    assert.equal(enCarpeta('hitos'), null);
  });

  it('un hito con 2 archivos que recibe 2 más da 400 con el mensaje, y su carpeta sigue con 2', async () => {
    const hito = await crearHito(await crearProyecto());
    assert.equal((await subirArchivos(hito, [pdf('a.pdf'), pdf('b.pdf')])).status, 201);
    const antes = enCarpeta('hitos', String(hito));
    assert.equal(antes.length, 2);
    const res = await subirArchivos(hito, [pdf('c.pdf'), pdf('d.pdf')]);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.success, false);
    assert.equal(res.body.error, MENSAJE_HITO_LLENO);
    assert.deepEqual(enCarpeta('hitos', String(hito)), antes);
    assert.deepEqual((await archivosDe(hito)).map((f) => f.nombre_archivo), ['a.pdf', 'b.pdf']);
  });

  it('un hito lleno da 400 sin escribir, y 4 archivos de una vez a un hito vacío también', async () => {
    const hito = await crearHito(await crearProyecto());
    const lleno = await subirArchivos(hito, [pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]);
    assert.equal(lleno.status, 201, JSON.stringify(lleno.body));
    assert.equal(lleno.body.message, '3 archivos subidos');
    const antes = enCarpeta('hitos', String(hito));
    assert.equal(antes.length, 3);
    const res = await subirArchivos(hito, [pdf('d.pdf')]);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, MENSAJE_HITO_LLENO);
    assert.deepEqual(enCarpeta('hitos', String(hito)), antes);
    assert.equal((await archivosDe(hito)).length, 3);

    const vacio = await crearHito(await crearProyecto({ nombre: '[TEST] Otro' }));
    const cuatro = await subirArchivos(vacio, [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf'), pdf('4.pdf')]);
    assert.equal(cuatro.status, 400, JSON.stringify(cuatro.body));
    assert.equal(cuatro.body.error, MENSAJE_HITO_LLENO);
    assert.deepEqual(enCarpeta('hitos', String(vacio)) ?? [], []);
    assert.equal((await archivosDe(vacio)).length, 0);
  });

  it('un proyecto con 9 documentos que recibe 2 más da 400 con el mensaje, y uno con 10 no recibe ninguno', async () => {
    const id = await crearProyecto();
    const nueve = Array.from({ length: 9 }, (_, i) => pdf(`doc-${i + 1}.pdf`));
    assert.equal((await subirDocumentos(id, nueve)).status, 201);
    const antes = enCarpeta('proyectos', String(id));
    assert.equal(antes.length, 9);
    const res = await subirDocumentos(id, [pdf('doc-10.pdf'), pdf('doc-11.pdf')]);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, MENSAJE_PROYECTO_LLENO);
    assert.deepEqual(enCarpeta('proyectos', String(id)), antes);
    assert.equal((await subirDocumentos(id, [pdf('doc-10.pdf')])).status, 201);
    const lleno = await subirDocumentos(id, [pdf('doc-11.pdf')]);
    assert.equal(lleno.status, 400);
    assert.equal(lleno.body.error, MENSAJE_PROYECTO_LLENO);
    assert.equal((await documentosDe(id)).length, 10);
    assert.equal(enCarpeta('proyectos', String(id)).length, 10);
  });

  it('un .exe da 400 «Tipo de archivo no permitido: .exe» y no deja nada, tampoco el PDF que venía antes', async () => {
    const id = await crearProyecto();
    const exe = new File([Buffer.from('MZ [TEST]')], 'programa.exe', { type: 'application/x-msdownload' });
    const res = await subirDocumentos(id, [pdf('bueno.pdf'), exe]);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'Tipo de archivo no permitido: .exe');
    assert.deepEqual(enCarpeta('proyectos', String(id)) ?? [], []);
    assert.equal((await documentosDe(id)).length, 0);
    const hito = await crearHito(id);
    const solo = await subirArchivos(hito, [exe]);
    assert.equal(solo.status, 400);
    assert.equal(solo.body.error, 'Tipo de archivo no permitido: .exe');
    assert.deepEqual(enCarpeta('hitos', String(hito)) ?? [], []);
  });

  it('un archivo de más de 10 MB da 400 con el mensaje y no queda en el disco', async () => {
    const id = await crearProyecto();
    const grande = new File([Buffer.alloc(10 * 1024 * 1024 + 1, 0x20)], 'grande.pdf', { type: 'application/pdf' });
    const res = await subirDocumentos(id, [grande]);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'El archivo excede el tamaño máximo de 10 MB');
    assert.deepEqual(enCarpeta('proyectos', String(id)) ?? [], []);
    assert.equal((await documentosDe(id)).length, 0);
  });

  it('una subida sin archivos da 400', async () => {
    const id = await crearProyecto();
    const res = await subirDocumentos(id, []);
    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.equal(res.body.error, 'No se enviaron archivos');
  });

  it('borrar un documento borra su fila y su archivo del disco', async () => {
    const id = await crearProyecto();
    assert.equal((await subirDocumentos(id, [pdf('uno.pdf'), pdf('dos.pdf')])).status, 201);
    const [uno, dos] = await documentosDe(id);
    const res = await api.delete(`/gestion/proyectos/${id}/documentos/${uno.id}`, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.message, 'Documento eliminado');
    assert.deepEqual((await documentosDe(id)).map((f) => f.id), [dos.id]);
    assert.deepEqual(enCarpeta('proyectos', String(id)), [dos.nombre_almacenado]);
    assert.equal((await api.delete(`/gestion/proyectos/${id}/documentos/${uno.id}`, como('admin'))).status, 404);
  });

  it('borrar el hito borra su carpeta de archivos (también un logro)', async () => {
    const hito = await crearHito(await crearProyecto());
    assert.equal((await subirArchivos(hito, [pdf('a.pdf'), pdf('b.pdf')])).status, 201);
    assert.equal(enCarpeta('hitos', String(hito)).length, 2);
    const res = await api.delete(`/gestion/hitos/${hito}`, como('admin'));
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.message, 'Hito eliminado');
    assert.equal(enCarpeta('hitos', String(hito)), null);

    const logro = (await api.post('/gestion/logros', { titulo: '[TEST] Logro', fecha: '2026-05-20' }, como('admin'))).body.data.id;
    assert.equal((await subirArchivos(logro, [pdf('logro.pdf')])).status, 201);
    assert.equal(enCarpeta('hitos', String(logro)).length, 1);
    assert.equal((await api.delete(`/gestion/hitos/${logro}`, como('admin'))).status, 200);
    assert.equal(enCarpeta('hitos', String(logro)), null);
  });

  it('borrar el archivo del disco a mano y descargarlo da 404 «El archivo no está en el servidor.»', async () => {
    const id = await crearProyecto();
    const hito = await crearHito(id);
    assert.equal((await subirDocumentos(id, [pdf('documento.pdf')])).status, 201);
    assert.equal((await subirArchivos(hito, [pdf('evidencia.pdf')])).status, 201);
    const [documento] = await documentosDe(id);
    const [archivo] = await archivosDe(hito);
    fs.rmSync(path.join(carpeta, 'proyectos', String(id), documento.nombre_almacenado));
    fs.rmSync(path.join(carpeta, 'hitos', String(hito), archivo.nombre_almacenado));
    for (const ruta of [`/gestion/proyectos/${id}/documentos/${documento.id}/descargar`, `/gestion/hitos/${hito}/archivos/${archivo.id}/descargar`]) {
      const res = await api.get(ruta, como('lector'));
      assert.equal(res.status, 404, ruta);
      assert.deepEqual(res.body, { success: false, error: MENSAJE_FALTANTE }, ruta);
    }
    // Borrar la fila de un archivo que ya no está en el disco anda igual
    assert.equal((await api.delete(`/gestion/proyectos/${id}/documentos/${documento.id}`, como('admin'))).status, 200);
    assert.equal((await api.delete(`/gestion/hitos/${hito}/archivos/${archivo.id}`, como('admin'))).status, 200);
  });

  it('la descarga y el borrado controlan que el documento o el archivo sean del proyecto o del hito de la dirección', async () => {
    const id = await crearProyecto();
    const otro = await crearProyecto({ nombre: '[TEST] Otro' });
    const hito = await crearHito(id);
    const otroHito = await crearHito(otro);
    assert.equal((await subirDocumentos(id, [pdf('documento.pdf')])).status, 201);
    assert.equal((await subirArchivos(hito, [pdf('evidencia.pdf')])).status, 201);
    const [documento] = await documentosDe(id);
    const [archivo] = await archivosDe(hito);
    const ajeno = await api.get(`/gestion/proyectos/${otro}/documentos/${documento.id}/descargar`, como('lector'));
    assert.equal(ajeno.status, 404);
    assert.equal(ajeno.body.error, 'Documento no encontrado');
    const ajenoHito = await api.get(`/gestion/hitos/${otroHito}/archivos/${archivo.id}/descargar`, como('lector'));
    assert.equal(ajenoHito.status, 404);
    assert.equal(ajenoHito.body.error, 'Archivo no encontrado');
    for (const ruta of [`/gestion/proyectos/abc/documentos/${documento.id}/descargar`, `/gestion/proyectos/${id}/documentos/1.5/descargar`,
      `/gestion/hitos/-1/archivos/${archivo.id}/descargar`, `/gestion/hitos/${hito}/archivos/0/descargar`]) {
      assert.equal((await api.get(ruta, como('lector'))).status, 404, ruta);
    }
    assert.equal((await api.delete(`/gestion/proyectos/${otro}/documentos/${documento.id}`, como('admin'))).status, 404);
    assert.equal((await api.delete(`/gestion/hitos/${otroHito}/archivos/${archivo.id}`, como('admin'))).status, 404);
    assert.equal((await documentosDe(id)).length, 1);
    assert.equal((await archivosDe(hito)).length, 1);

    // Los de un proyecto dado de baja ya no se ven: 404
    assert.equal((await api.delete(`/gestion/proyectos/${id}`, como('admin'))).status, 200);
    assert.equal((await api.get(`/gestion/proyectos/${id}/documentos/${documento.id}/descargar`, como('lector'))).status, 404);
    assert.equal((await api.get(`/gestion/hitos/${hito}/archivos/${archivo.id}/descargar`, como('lector'))).status, 404);
  });

  it('subir un archivo a un hito sin enlace lo deja en evidencia «archivo», y borrarlo lo vuelve a «ninguno»; con enlace, sigue «url»', async () => {
    const id = await crearProyecto();
    const hito = await crearHito(id);
    assert.equal(await evidenciaDe(hito), 'ninguno');
    const res = await subirArchivos(hito, [pdf('evidencia.pdf')]);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.equal(res.body.message, '1 archivo subido');
    assert.equal(await evidenciaDe(hito), 'archivo');
    const detalle = (await api.get(`/gestion/proyectos/${id}`, como('lector'))).body.data.hitos[0];
    assert.equal(detalle.evidencia_tipo, 'archivo');
    assert.deepEqual(detalle.archivos.map((a) => a.nombre_archivo), ['evidencia.pdf']);
    const [archivo] = await archivosDe(hito);
    const borrar = await api.delete(`/gestion/hitos/${hito}/archivos/${archivo.id}`, como('admin'));
    assert.equal(borrar.status, 200, JSON.stringify(borrar.body));
    assert.equal(borrar.body.message, 'Archivo eliminado');
    assert.equal(await evidenciaDe(hito), 'ninguno');
    assert.deepEqual(enCarpeta('hitos', String(hito)), []);

    const conEnlace = await crearHito(id, { titulo: '[TEST] Con enlace', evidencia_url: 'https://ejemplo.test/evidencia' });
    assert.equal((await subirArchivos(conEnlace, [pdf('extra.pdf')])).status, 201);
    assert.equal(await evidenciaDe(conEnlace), 'url');
    const [extra] = await archivosDe(conEnlace);
    assert.equal((await api.delete(`/gestion/hitos/${conEnlace}/archivos/${extra.id}`, como('admin'))).status, 200);
    assert.equal(await evidenciaDe(conEnlace), 'url');
  });
});
