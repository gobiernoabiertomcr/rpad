// API de Proyectos (spec 2026-10-25-proyectos, sección 9): proyectos, hitos, logros del área (hitos sin proyecto) y la línea de
// tiempo. Leen todos los roles con sesión (también el lector y el colaborador); escribe solo administración. Cada error de
// validación es un 400 con su campo, las áreas que no existen no dejan nada a medias (transacción), las fechas van como texto
// 'AAAA-MM-DD' y un proyecto dado de baja (o un hito suyo) da 404. Contra una base de prueba propia, con datos inventados.
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query } from './helpers.js';
import { MENSAJES_PROYECTOS, fechaMaxima } from '../services/proyectosReglas.js';
import { hoyArgentina, sumarDias } from '../services/notasDigitalesCalendario.js';

let base, servidor, api, usuarios, dbReal;

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_proyectos_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre } });
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
