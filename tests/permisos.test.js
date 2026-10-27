// Permisos por rol: qué puede hacer un visitante, un lector, un colaborador y un admin
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { iniciarServidor, crearCliente, crearUsuariosPrueba, limpiarDatosPrueba, cerrarDb, query, db } from './helpers.js';
import { BLOQUEO_EVENTOS } from '../services/miEspacioEventosReglas.js';

let servidor, api, usuarios;

// El 404 del Informe anual de un año sin foto (1999 nunca la tiene)
const SIN_FOTO_DEL_ANIO = 'Todavía no hay foto de ese año: se saca el 10/01 del año siguiente.';

before(async () => {
  servidor = await iniciarServidor();
  api = crearCliente(servidor.url);
  usuarios = await crearUsuariosPrueba(api,
    { adminA: 'admin', adminB: 'admin', lector: 'lector', superadmin: 'superadmin', colaborador: 'colaborador' });
});

after(async () => {
  await limpiarDatosPrueba(usuarios);
  await cerrarDb();
  await servidor?.detener();
});

// Rutas que solo un admin puede usar. Los IDs no importan: el rol se valida antes.
const RUTAS_SOLO_ADMIN = [
  ['POST', '/datasets'],
  ['PUT', '/datasets/1'],
  ['DELETE', '/datasets/1'],
  ['POST', '/datasets/1/actualizar'],
  ['POST', '/areas'],
  ['PUT', '/areas/1'],
  ['DELETE', '/areas/1'],
  ['GET', '/cambios-pendientes/contador'],
  ['GET', '/cambios-pendientes/para-revisar'],
  ['GET', '/cambios-pendientes/mis-cambios'],
  ['GET', '/cambios-pendientes/datasets-bloqueados'],
  ['GET', '/cambios-pendientes/1'],
  ['GET', '/cambios-pendientes/verificar/1'],
  ['POST', '/cambios-pendientes/1/aprobar'],
  ['POST', '/cambios-pendientes/1/rechazar'],
  ['GET', '/notificaciones/ejecutar'],
  ['GET', '/notificaciones/verificar-smtp'],
  ['POST', '/notificaciones/prueba-area'],
  ['GET', '/notificaciones/preview/area-aviso-40'],
  ['GET', '/notificaciones/notas-digitales'],
  ['GET', '/notificaciones/notas-digitales/estado'],
  ['GET', '/notificaciones/notas-digitales/preview?tipo=aviso&gestion=interna'],
  ['GET', '/notificaciones/notas-digitales/preview?tipo=auditoria'],
  ['POST', '/notificaciones/notas-digitales/prueba'],
  ['GET', '/notificaciones/notas-digitales/config'],
  ['PUT', '/notificaciones/notas-digitales/config'],
  ['PUT', '/notificaciones/notas-digitales/config/firma'],
  ['GET', '/notificaciones/notas-digitales/config/firma'],
  ['PUT', '/notificaciones/notas-digitales/config/membrete'],
  ['GET', '/notificaciones/notas-digitales/config/membrete'],
  ['GET', '/notificaciones/notas-digitales/preview/pdf?tipo=aviso&gestion=interna'],
  ['GET', '/notificaciones/notas-digitales/preview/anexo?gestion=interna'],
  ['GET', '/notificaciones/notas-digitales/1/pdf'],
  ['GET', '/notificaciones/notas-digitales/1/anexo'],
  ['GET', '/notificaciones/notas-digitales/1/word'],
  ['POST', '/notificaciones/notas-digitales/1/reintentar'],
  ['GET', '/notificaciones/cambios-pendientes'],
  ['GET', '/notificaciones/preview-cambios-pendientes'],
  ['GET', '/usuarios'],
  ['POST', '/usuarios'],
  ['GET', '/usuarios/1'],
  ['PUT', '/usuarios/1'],
  ['POST', '/usuarios/1/desactivar'],
  ['POST', '/usuarios/1/reactivar'],
  ['POST', '/usuarios/1/enviar-acceso'],
  ['GET', '/usuarios/licencias'],
  ['GET', '/usuarios/licencias/sin-auditor'],
  ['POST', '/usuarios/licencias'],
  ['PUT', '/usuarios/licencias/1'],
  ['POST', '/usuarios/licencias/1/anular'],
  ['GET', '/auth/profile/firma'],
  ['PUT', '/auth/profile/firma'],
  ['GET', '/auth/profile/firma/imagen'],
  ['GET', '/notificaciones/notas-digitales/config/firmantes'],
  ['PUT', '/notificaciones/notas-digitales/config/firmante'],
  // Proyectos (spec 2026-10-25-proyectos, 7): leen todos los roles con sesión; crean, editan y borran solo administración
  ['POST', '/gestion/proyectos'],
  ['PUT', '/gestion/proyectos/1'],
  ['DELETE', '/gestion/proyectos/1'],
  ['POST', '/gestion/logros'],
  ['POST', '/gestion/proyectos/1/hitos'],
  ['PUT', '/gestion/hitos/1'],
  ['DELETE', '/gestion/hitos/1'],
  // Subir y borrar documentos y archivos de hitos, también solo administración. Las descargas no van acá: son para todos los roles
  // con sesión (lo prueba tests/proyectos-api.test.js)
  ['POST', '/gestion/proyectos/1/documentos'],
  ['DELETE', '/gestion/proyectos/1/documentos/1'],
  ['POST', '/gestion/hitos/1/archivos'],
  ['DELETE', '/gestion/hitos/1/archivos/1'],
  // Feriados (spec 2026-10-26-feriados, 3): los lee cualquier rol con sesión; cargan, corrigen y dan de baja solo administración, que
  // también es la única que pide cuántas licencias de Mi espacio incluye una fecha (el modal del feriado)
  ['POST', '/feriados'],
  ['PUT', '/feriados/1'],
  ['PUT', '/feriados/1/rige'],
  ['DELETE', '/feriados/1'],
  ['GET', '/feriados/afectadas?fecha=2026-02-16']
];

const pedir = (metodo, ruta, token) => {
  const opciones = { token };
  if (metodo === 'GET') return api.get(ruta, opciones);
  if (metodo === 'DELETE') return api.delete(ruta, opciones);
  return metodo === 'POST' ? api.post(ruta, {}, opciones) : api.put(ruta, {}, opciones);
};

describe('lector', () => {
  for (const [metodo, ruta] of RUTAS_SOLO_ADMIN) {
    it(`recibe 403 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.lector.token);
      assert.equal(res.status, 403);
    });
  }

  for (const ruta of ['/auth/profile', '/datasets', '/reportes/estado-general', '/reportes/avisos', '/reportes/agenda', '/reportes/para-completar',
    '/gestion/metricas', '/gestion/proyectos', '/gestion/timeline', '/seguimiento', '/metricas', '/metricas/pdf', '/reportes/ciclo-de-vida',
    '/feriados', '/mi-espacio/resumen', '/mi-espacio/licencias', '/mi-espacio/horas-extras', '/mi-espacio/saldo-inicial',
    '/mi-espacio/anio/2026', '/mi-espacio/ausentes?desde=2026-10-26&hasta=2026-10-27', '/mi-espacio/firmante',
    '/mi-espacio/eventos?desde=2026-10-26&hasta=2026-10-27']) {
    it(`puede usar GET ${ruta}`, async () => {
      const res = await api.get(ruta, { token: usuarios.lector.token });
      assert.equal(res.status, 200);
    });
  }

  // La agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, sección 1): solo administración comparte eventos
  it('recibe 403 en GET /mi-espacio/personas', async () => {
    const res = await api.get('/mi-espacio/personas', { token: usuarios.lector.token });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'No tenés permiso para compartir eventos.');
  });

  // El Seguimiento de un dataset lo ve cualquier rol con sesión (spec 2026-10-20-seguimiento-dataset)
  it('puede usar GET /seguimiento/:id', async () => {
    const [{ id }] = await query('SELECT id FROM datasets LIMIT 1');
    const res = await api.get(`/seguimiento/${id}`, { token: usuarios.lector.token });
    assert.equal(res.status, 200);
  });

  // El Informe anual (spec 2026-10-24-metricas-y-reportes, 5): sin la foto del año, el 404 del controlador (no un 401 ni un 403)
  it('puede usar GET /reportes/informe-anual', async () => {
    const res = await api.get('/reportes/informe-anual?anio=1999', { token: usuarios.lector.token });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, SIN_FOTO_DEL_ANIO);
  });
});

// Notas DGMIT (spec 2026-10-24-notas-dgmit, sección 8): las cargan administración y el colaborador, no el lector. Los IDs no
// importan: el rol se valida antes
const RUTAS_NOTAS_DGMIT = [
  ['POST', '/notas-dgmit'],
  ['PUT', '/notas-dgmit/1'],
  ['POST', '/notas-dgmit/1/anular']
];

describe('notas DGMIT', () => {
  for (const [metodo, ruta] of RUTAS_NOTAS_DGMIT) {
    it(`el lector recibe 403 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.lector.token);
      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'No tenés permiso para cargar notas DGMIT.');
    });

    it(`el visitante sin sesión recibe 401 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, undefined);
      assert.equal(res.status, 401);
    });
  }

  it('el lector sigue pudiendo usar GET /seguimiento', async () => {
    const res = await api.get('/seguimiento', { token: usuarios.lector.token });
    assert.equal(res.status, 200);
  });
});

// El generador de notas (spec 2026-10-24-generador-de-notas, sección 1): lo usan los mismos que cargan notas DGMIT,
// administración y el colaborador, no el lector. Los IDs no importan: el rol se valida antes
const RUTAS_GENERADOR = [
  ['GET', '/notas/areas'],
  ['GET', '/notas/areas/1'],
  ['GET', '/notas/membrete'],
  ['POST', '/notas/vista-previa'],
  ['POST', '/notas/generar']
];

describe('generador de notas', () => {
  for (const [metodo, ruta] of RUTAS_GENERADOR) {
    it(`el lector recibe 403 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.lector.token);
      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'No tenés permiso para usar el generador de notas.');
    });

    it(`el visitante sin sesión recibe 401 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, undefined);
      assert.equal(res.status, 401);
    });
  }
});

// Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, sección 10): cada persona con sesión usa el suyo, cualquiera sea su
// rol (el lector y el colaborador las usan en sus listas de arriba y de abajo); sin sesión, 401. Los IDs no importan: la sesión
// se valida antes
const RUTAS_MI_ESPACIO = [
  ['GET', '/mi-espacio/resumen'],
  ['GET', '/mi-espacio/licencias'],
  ['GET', '/mi-espacio/horas-extras'],
  ['GET', '/mi-espacio/anio/2026'],
  ['GET', '/mi-espacio/saldo-inicial'],
  ['POST', '/mi-espacio/licencias'],
  ['POST', '/mi-espacio/licencias/calculo'],
  ['PUT', '/mi-espacio/licencias/1'],
  ['DELETE', '/mi-espacio/licencias/1'],
  ['POST', '/mi-espacio/horas-extras'],
  ['PUT', '/mi-espacio/horas-extras/1'],
  ['DELETE', '/mi-espacio/horas-extras/1'],
  ['PUT', '/mi-espacio/anio/2026'],
  ['PUT', '/mi-espacio/saldo-inicial'],
  ['GET', '/mi-espacio/ausentes?desde=2026-10-26&hasta=2026-10-27'],
  ['GET', '/mi-espacio/firmante'],
  // La agenda (spec 2026-10-26-mi-espacio-agenda, sección 7)
  ['GET', '/mi-espacio/eventos?desde=2026-10-26&hasta=2026-10-27'],
  ['GET', '/mi-espacio/eventos/aviso?fecha=2026-10-27&desde=10:00&recordatorio=2h'],
  ['GET', '/mi-espacio/personas'],
  ['POST', '/mi-espacio/eventos'],
  ['PUT', '/mi-espacio/eventos/1'],
  ['DELETE', '/mi-espacio/eventos/1'],
  ['PUT', '/mi-espacio/eventos/1/mi-recordatorio']
];

describe('Mi espacio', () => {
  for (const [metodo, ruta] of RUTAS_MI_ESPACIO) {
    it(`el visitante sin sesión recibe 401 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, undefined);
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  }
});

// El colaborador (spec 2026-10-24-notas-dgmit, sección 1): ve lo que ve un lector y carga notas DGMIT; no entra a la administración
describe('colaborador', () => {
  for (const [metodo, ruta] of RUTAS_SOLO_ADMIN) {
    it(`recibe 403 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.colaborador.token);
      assert.equal(res.status, 403);
    });
  }

  for (const ruta of ['/auth/profile', '/datasets', '/seguimiento', '/metricas', '/metricas/pdf', '/reportes/estado-general', '/reportes/avisos',
    '/reportes/agenda', '/reportes/para-completar', '/gestion/proyectos', '/gestion/timeline', '/reportes/ciclo-de-vida', '/feriados',
    '/mi-espacio/resumen', '/mi-espacio/licencias', '/mi-espacio/horas-extras', '/mi-espacio/saldo-inicial', '/mi-espacio/anio/2026',
    '/mi-espacio/ausentes?desde=2026-10-26&hasta=2026-10-27', '/mi-espacio/firmante',
    '/mi-espacio/eventos?desde=2026-10-26&hasta=2026-10-27']) {
    it(`puede usar GET ${ruta}`, async () => {
      const res = await api.get(ruta, { token: usuarios.colaborador.token });
      assert.equal(res.status, 200);
    });
  }

  it('recibe 403 en GET /mi-espacio/personas', async () => {
    const res = await api.get('/mi-espacio/personas', { token: usuarios.colaborador.token });
    assert.equal(res.status, 403);
    assert.equal(res.body.error, 'No tenés permiso para compartir eventos.');
  });

  it('puede usar GET /seguimiento/:id', async () => {
    const [{ id }] = await query('SELECT id FROM datasets LIMIT 1');
    const res = await api.get(`/seguimiento/${id}`, { token: usuarios.colaborador.token });
    assert.equal(res.status, 200);
  });

  it('puede usar GET /reportes/informe-anual', async () => {
    const res = await api.get('/reportes/informe-anual?anio=1999', { token: usuarios.colaborador.token });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, SIN_FOTO_DEL_ANIO);
  });

  // Con el cuerpo vacío, el middleware lo deja pasar y contesta el controlador (la validación, o la nota que no existe o no es suya):
  // nunca el 403 del middleware ni un 401. Nada se guarda
  for (const [metodo, ruta] of RUTAS_NOTAS_DGMIT) {
    it(`llega al controlador en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.colaborador.token);
      assert.ok([400, 403, 404].includes(res.status), `${res.status} ${JSON.stringify(res.body)}`);
      assert.equal(res.body.success, false);
      assert.notEqual(res.body.error, 'No tenés permiso para cargar notas DGMIT.');
    });
  }

  it('POST /notas-dgmit sin datos da el 400 de la validación, en el número', async () => {
    const res = await pedir('POST', '/notas-dgmit', usuarios.colaborador.token);
    assert.equal(res.status, 400);
    assert.equal(res.body.campo, 'numero');
  });

  // El generador de notas: el middleware lo deja pasar y contesta el controlador (los datos, la validación de un cuerpo vacío o un
  // área que no existe): nunca el 403 del middleware, un 401 ni el 404 de una ruta que no existe. No se guarda nada
  for (const [metodo, ruta] of RUTAS_GENERADOR) {
    it(`llega al controlador en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, usuarios.colaborador.token);
      assert.ok([200, 400, 404].includes(res.status), `${res.status} ${JSON.stringify(res.body)}`);
      assert.notEqual(res.body.error, 'No tenés permiso para usar el generador de notas.');
      assert.notEqual(res.body.error, 'Ruta no encontrada');
    });
  }

  it('POST /notas/generar sin datos da el 400 de la validación, en la fecha', async () => {
    const res = await pedir('POST', '/notas/generar', usuarios.colaborador.token);
    assert.equal(res.status, 400);
    assert.equal(res.body.campo, 'fecha');
  });
});

describe('visitante sin sesión', () => {
  for (const [metodo, ruta] of RUTAS_SOLO_ADMIN) {
    it(`recibe 401 en ${metodo} ${ruta}`, async () => {
      const res = await pedir(metodo, ruta, undefined);
      assert.equal(res.status, 401);
    });
  }

  it('recibe 401 en las rutas del Seguimiento', async () => {
    const [{ id }] = await query('SELECT id FROM datasets LIMIT 1');
    for (const ruta of ['/seguimiento', `/seguimiento/${id}`, `/seguimiento/${id}/pdf`]) {
      assert.equal((await api.get(ruta)).status, 401, ruta);
    }
  });

  // Las métricas (spec 2026-10-24-metricas-y-reportes, 2.3): para todos los roles con sesión, nunca sin ella
  it('recibe 401 en GET /metricas y en su PDF', async () => {
    for (const ruta of ['/metricas', '/metricas/pdf']) {
      const res = await api.get(ruta);
      assert.equal(res.status, 401, ruta);
      assert.equal(res.body.success, false, ruta);
    }
  });

  // Los reportes PDF (spec 2026-10-24-metricas-y-reportes, 5 y 6): para todos los roles con sesión, nunca sin ella
  it('recibe 401 en los reportes PDF', async () => {
    for (const ruta of ['/reportes/estado-general', '/reportes/avisos', '/reportes/agenda', '/reportes/para-completar', '/reportes/informe-anual?anio=2026',
      '/reportes/ciclo-de-vida']) {
      const res = await api.get(ruta);
      assert.equal(res.status, 401, ruta);
      assert.equal(res.body.success, false, ruta);
    }
  });

  // Los feriados (spec 2026-10-26-feriados, 3): para todos los roles con sesión, nunca sin ella
  it('recibe 401 en GET /feriados', async () => {
    const res = await api.get('/feriados');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('no puede usar un token firmado con la clave por defecto que tenía el código', async () => {
    const falso = jwt.sign({ userId: usuarios.adminA.id, rol: 'admin' }, 'rpad-secret-key-cambiar-en-produccion');
    const res = await api.get('/auth/verify', { token: falso });
    assert.equal(res.status, 401);
  });
});

// GET de administración que se pueden llamar sin efectos sobre la base local
const RUTAS_GET_ADMIN = [
  '/cambios-pendientes/contador',
  '/cambios-pendientes/para-revisar',
  '/cambios-pendientes/mis-cambios',
  '/cambios-pendientes/datasets-bloqueados',
  '/notificaciones/verificar-smtp',
  '/notificaciones/preview/area-aviso-40',
  '/notificaciones/notas-digitales',
  '/notificaciones/notas-digitales/estado',
  '/notificaciones/preview-cambios-pendientes',
  '/usuarios',
  '/usuarios/licencias',
  '/usuarios/licencias/sin-auditor',
  '/auth/profile/firma',
  '/notificaciones/notas-digitales/config/firmantes'
];

for (const clave of ['adminA', 'superadmin']) {
  describe(clave === 'adminA' ? 'admin' : 'superadmin', () => {
    for (const ruta of RUTAS_GET_ADMIN) {
      it(`puede usar GET ${ruta}`, async () => {
        const res = await api.get(ruta, { token: usuarios[clave].token });
        assert.equal(res.status, 200);
      });
    }
  });
}

describe('cron', () => {
  it('rechaza sin clave', async () => {
    assert.equal((await api.get('/cron/cambios-pendientes')).status, 403);
  });

  it('rechaza clave incorrecta', async () => {
    const res = await api.get('/cron/cambios-pendientes', { headers: { 'x-cron-secret': 'incorrecta' } });
    assert.equal(res.status, 403);
  });

  it('rechaza clave vacía por query', async () => {
    assert.equal((await api.get('/cron/cambios-pendientes?secret=')).status, 403);
  });

  it('acepta la clave correcta por header', async () => {
    const res = await api.get('/cron/cambios-pendientes', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
    assert.equal(res.status, 200);
  });

  it('acepta la clave correcta por query (como la llama el cron de cPanel)', async () => {
    const res = await api.get(`/cron/cambios-pendientes?secret=${encodeURIComponent(process.env.CRON_SECRET)}`);
    assert.equal(res.status, 200);
  });

  // La corrida de los recordatorios de la agenda de Mi espacio (cada media hora). El servidor de este archivo usa la base del
  // .env, no una de prueba: con la clave, la corrida correría de verdad (anotaría su última corrida y mandaría los recordatorios
  // de los eventos que haya). Por eso el pedido con la clave va con el candado de la corrida tomado en otra conexión: responde 200
  // «ocupada» sin escribir ni mandar nada. La corrida en sí se prueba en tests/mi-espacio-eventos-corrida.test.js
  it('/cron/eventos: 403 sin clave y con una incorrecta', async () => {
    assert.equal((await api.get('/cron/eventos')).status, 403);
    assert.equal((await api.get('/cron/eventos', { headers: { 'x-cron-secret': 'incorrecta' } })).status, 403);
    assert.equal((await api.get('/cron/eventos?secret=')).status, 403);
  });

  it('/cron/eventos: 200 con la clave por encabezado (con el candado tomado: no escribe ni manda nada)', async () => {
    const contar = async () => Number((await query('SELECT COUNT(*) AS n FROM mi_espacio_eventos_corridas'))[0].n)
      + Number((await query('SELECT COUNT(*) AS n FROM mi_espacio_evento_envios'))[0].n);
    const antes = await contar();
    const conexion = await db().getConnection();
    try {
      const [[{ tomado }]] = await conexion.query('SELECT GET_LOCK(?, 10) AS tomado', [BLOQUEO_EVENTOS]);
      assert.equal(Number(tomado), 1);
      const res = await api.get('/cron/eventos', { headers: { 'x-cron-secret': process.env.CRON_SECRET } });
      assert.equal(res.status, 200, JSON.stringify(res.body));
      assert.deepEqual(res.body, {
        success: true, message: 'Otra corrida de los recordatorios está en curso.',
        data: { ocupada: true, dia_habil: null, enviados: 0, fallidos: 0, errores: [] }
      });
    } finally {
      await conexion.query('SELECT RELEASE_LOCK(?)', [BLOQUEO_EVENTOS]);
      conexion.release();
    }
    assert.equal(await contar(), antes);
  });
});
