// La votación de la principal del equipo (spec 2026-11-23-dato-quincena-principal-votacion, 3), contra una base de prueba propia y la
// app real: al llegar una edición por el POST de Datito nacen su votación y la foto de quienes votan (las personas activas de la lista);
// el PUT del voto, con sus controles en orden, una fila por cada orden guardado y dos pedidos a la vez sin cruzarse; el detalle y la
// lista con la votación (lo de quien mira, para cada uno); la elección a mano, que ya no escribe; y sin las tablas, 500. Y el cierre
// cuando votaron todos (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado): el voto que completa la foto la cierra en ese momento.
// La hora del servidor no se fija: una votación abierta es una que llegó recién (su cierre es posterior), una cerrada es una sellada a
// mano o una cuya llegada se corrió al pasado. El cierre esperado se calcula con las reglas y el calendario de la base de prueba, sin
// filas de feriados (los 9 fijos). Las personas se llaman Persona A, B, C…: inventadas.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { crearBaseDePrueba, iniciarServidor, crearCliente, crearUsuariosPrueba, cerrarDb, query, db, mailpit } from './helpers.js';
import { FECHA_DE_PRUEBA, edicionDePrueba, pilotoDePrueba, partesDePrueba } from './dato-quincena-fixtures.js';
import {
  MENSAJES_VOTACION, cierreDeLaVotacion, llegadaDe, cierreLargo, cierreMedio, cierreCorto, estadoDeLaVotacionLeida
} from '../services/datoQuincenaVotacionReglas.js';
import { calendarioCon } from '../services/feriadosReglas.js';
import { ahoraArgentina } from '../services/notasDigitalesCalendario.js';

const sha256 = (datos) => crypto.createHash('sha256').update(datos).digest('hex');
const TOKEN = crypto.randomBytes(32).toString('hex');
const RESPUESTAS = JSON.parse(fs.readFileSync(new URL('./fixtures/dato-quincena-respuestas.json', import.meta.url), 'utf8'));
const NO_EXISTE = { success: false, error: 'No existe esa edición.' };
const error = (clave) => ({ success: false, error: MENSAJES_VOTACION[clave] });
const NADIE_VOTA = 'No había nadie en la lista para votar.';
const CERRO = 'Guardamos tu orden. Votaron todos: la votación cerró.';
const AVISO_DE_CIERRE = 'Sos la última persona en votar: al guardar, la votación cierra y nadie puede cambiar su orden.';
const SIN_CALENDARIO = 'No se pudo leer el calendario: el cierre se confirma en unos minutos.';

// La forma de una respuesta (la de tests/dato-quincena-api.test.js): de cada objeto, sus claves en orden con la forma de cada valor;
// de cada lista, las formas distintas de sus objetos; de lo demás, '·'
const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
const forma = (valor) => {
  if (Array.isArray(valor)) {
    return [...new Set(valor.filter(esObjeto).map((elemento) => JSON.stringify(forma(elemento))))].map((f) => JSON.parse(f));
  }
  if (esObjeto(valor)) return Object.entries(valor).map(([clave, hijo]) => [clave, forma(hijo)]);
  return '·';
};

// Una edición de cuatro propuestas (la 1, la de Datito): con cuatro, [1, 2] no es un orden completo
const cuatroPropuestas = () => {
  const [a, b] = edicionDePrueba().propuestas;
  return [a, b, { ...structuredClone(b), orden: 3, titulo: 'Un tercer título inventado' },
    { ...structuredClone(b), orden: 4, titulo: 'Un cuarto título inventado' }];
};
const regularDeCuatro = (fecha_edicion, cambios = {}) => edicionDePrueba({ fecha_edicion, propuestas: cuatroPropuestas(), ...cambios });
const TITULOS = ['Un título inventado', 'Otro título inventado', 'Un tercer título inventado', 'Un cuarto título inventado'];
const textoDe = (orden) => `Propuesta ${orden} · ${TITULOS[orden - 1]}`;

let base, servidor, api, personas, dbReal;
let poolDelServicio = null;
// Las ediciones: la regular abierta, el piloto (se vota y se sella con votos), la de llegada vieja (cerrada por su cierre calculado),
// la sellada en el minuto actual y una de antes (escrita a mano, sin votación)
const ed = {};

before(async () => {
  dbReal = process.env.DB_NAME;
  base = await crearBaseDePrueba('rpad_test_dato_quincena_votacion_api');
  process.env.DB_NAME = base.nombre;
  servidor = await iniciarServidor({ env: { DB_NAME: base.nombre, DATO_QUINCENA_TOKEN_SHA256: sha256(TOKEN) } });
  api = crearCliente(servidor.url);
  personas = await crearUsuariosPrueba(api, {
    a: 'admin', b: 'editor', c: 'lector', d: 'lector', e: 'lector', f: 'colaborador', superadmin: 'superadmin'
  });
  for (const [clave, persona] of Object.entries(personas)) {
    await query('UPDATE usuarios SET nombre_completo = ? WHERE id = ?', [`Persona ${clave.toUpperCase()}`, persona.id]);
  }
  await query("INSERT INTO areas (id, nombre) VALUES (1, '[TEST] Área del dato de la quincena')");
  await query(
    `INSERT INTO datasets (id, titulo, area_id, frecuencia_id, tema_principal_id, activo)
     VALUES (1, '[TEST] Dataset de prueba A', 1, 1, 1, 1), (2, '[TEST] Dataset de prueba B', 1, 1, 1, 0)`
  );
  await mailpit.vaciar();
});

after(async () => {
  // El pool de config/database.js, si un test llamó directo a un servicio (guardarVoto): con DB_NAME ya apuntado a la base de prueba
  if (poolDelServicio !== null) await poolDelServicio.end();
  await cerrarDb();
  await servidor?.detener();
  if (dbReal === undefined) delete process.env.DB_NAME;
  else process.env.DB_NAME = dbReal;
  await base?.borrar();
});

let ip = 0;
const enviar = async (partes) => {
  const formulario = new FormData();
  for (const [nombre, contenido] of Object.entries(partes)) formulario.append(nombre, new Blob([contenido]), `${nombre}.bin`);
  ip += 1;
  const res = await fetch(`${servidor.url}/api/dato-quincena/ediciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'X-Forwarded-For': `203.0.113.${ip}` },
    body: formulario,
    signal: AbortSignal.timeout(30000)
  });
  return { status: res.status, body: await res.json() };
};

const votar = (id, cuerpo, clave = 'a') => api.put(`/dato-quincena/ediciones/${id}/voto`, cuerpo,
  { token: clave === null ? undefined : personas[clave].token });
const detalle = async (id, clave = 'a') => {
  const res = await api.get(`/dato-quincena/ediciones/${id}`, { token: personas[clave].token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
};
const enLaLista = async (id, clave = 'a') => {
  const res = await api.get('/dato-quincena/ediciones?anio=2026', { token: personas[clave].token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.data.ediciones.find((e) => e.id === id);
};

const votacionDe = async (id) => (await query(
  `SELECT edicion_id, DATE_FORMAT(creada_at, '%Y-%m-%d %H:%i:%s') AS creada_at, cierre_at, sellada_at, aviso, aviso_at
   FROM dato_quincena_votaciones WHERE edicion_id = ?`, [id]
)).map((fila) => ({ ...fila }));
const fotoDe = async (id) => (await query(
  'SELECT usuario_id FROM dato_quincena_votacion_personas WHERE edicion_id = ? ORDER BY id', [id]
)).map((fila) => fila.usuario_id);
const votosDe = async (id) => (await query(
  `SELECT vo.id, vp.usuario_id, vo.orden, DATE_FORMAT(vo.votado_at, '%Y-%m-%d %H:%i:%s') AS votado_at
   FROM dato_quincena_votos vo JOIN dato_quincena_votacion_personas vp ON vp.id = vo.persona_id
   WHERE vp.edicion_id = ? ORDER BY vo.id`, [id]
)).map((fila) => ({ ...fila }));
const todosLosVotos = async () => (await query('SELECT * FROM dato_quincena_votos ORDER BY id')).map((fila) => ({ ...fila }));
const cuenta = async (tabla) => Number((await query(`SELECT COUNT(*) AS n FROM \`${tabla}\``))[0].n);
const lista = (claves) => claves.map((clave) => personas[clave].id);
const ponerLaLista = async (claves) => {
  await query('DELETE FROM dato_quincena_votantes');
  for (const id of lista(claves)) {
    await query('INSERT INTO dato_quincena_votantes (usuario_id, agregado_por, agregado_at) VALUES (?, NULL, ?)', [id, ahoraArgentina()]);
  }
};

// El cierre de una edición guardada: el de las reglas, con su llegada y el calendario de la base de prueba (sin feriados: los 9 fijos)
const cierreDe = async (id) => {
  const [fila] = await query(
    "SELECT DATE_FORMAT(fecha_edicion, '%Y-%m-%d') AS fecha_edicion, UNIX_TIMESTAMP(recibida_at) AS recibida_ts FROM dato_quincena_ediciones WHERE id = ?",
    [id]
  );
  return cierreDeLaVotacion({ fecha_edicion: fila.fecha_edicion, llegada: llegadaDe(Number(fila.recibida_ts)), calendario: calendarioCon([]) });
};
const sellar = (id, cierre) => query('UPDATE dato_quincena_votaciones SET cierre_at = ?, sellada_at = ? WHERE edicion_id = ?',
  [cierre, ahoraArgentina(), id]);

// El servicio de las consultas, para llamar a guardarVoto directo. El pool del servicio nace al importarlo: solo con DB_NAME en la base
// de prueba, nunca en la del .env
const elServicio = async () => {
  assert.equal(process.env.DB_NAME, base.nombre);
  const servicio = await import('../services/datoQuincenaVotacionDatos.js');
  poolDelServicio = (await import('../config/database.js')).default;
  return servicio;
};

describe('al llegar la edición', () => {
  before(async () => {
    await ponerLaLista(['a', 'b', 'c', 'd']);
    await query('UPDATE usuarios SET activo = 0 WHERE id = ?', [personas.d.id]);
  });

  it('una regular: la votación con la hora de la llegada y la foto de las personas activas de la lista, por nombre', async () => {
    const antes = ahoraArgentina();
    const res = await enviar(partesDePrueba(regularDeCuatro(FECHA_DE_PRUEBA)));
    const despues = ahoraArgentina();
    assert.equal(res.status, 201, JSON.stringify(res.body));
    ed.regular = res.body.data.id;
    const [votacion] = await votacionDe(ed.regular);
    assert.ok(votacion.creada_at >= antes && votacion.creada_at <= despues, `${antes} ≤ ${votacion.creada_at} ≤ ${despues}`);
    assert.deepEqual({ ...votacion, creada_at: '·' },
      { edicion_id: ed.regular, creada_at: '·', cierre_at: null, sellada_at: null, aviso: null, aviso_at: null });
    // La persona desactivada no entra
    assert.deepEqual(await fotoDe(ed.regular), lista(['a', 'b', 'c']));
    assert.deepEqual(await votosDe(ed.regular), []);
  });

  it('el 200 de lo mismo otra vez y el 409 no crean otra votación ni cambian la foto, aunque la lista cambie', async () => {
    await ponerLaLista(['a', 'b', 'c', 'd', 'f']);
    const antes = { votaciones: await cuenta('dato_quincena_votaciones'), personas: await cuenta('dato_quincena_votacion_personas') };
    const repetida = await enviar(partesDePrueba(regularDeCuatro(FECHA_DE_PRUEBA)));
    assert.equal(repetida.status, 200, JSON.stringify(repetida.body));
    const conflicto = await enviar(partesDePrueba(regularDeCuatro(FECHA_DE_PRUEBA, { titulo: 'Otro título de la edición' })));
    assert.equal(conflicto.status, 409, JSON.stringify(conflicto.body));
    assert.deepEqual(
      { votaciones: await cuenta('dato_quincena_votaciones'), personas: await cuenta('dato_quincena_votacion_personas') }, antes
    );
    assert.deepEqual(await fotoDe(ed.regular), lista(['a', 'b', 'c']));
  });

  it('un piloto también se vota, con la foto de la lista de ese momento', async () => {
    const res = await enviar(partesDePrueba(pilotoDePrueba({ propuestas: cuatroPropuestas() })));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    ed.piloto = res.body.data.id;
    assert.equal((await votacionDe(ed.piloto)).length, 1);
    assert.deepEqual(await fotoDe(ed.piloto), lista(['a', 'b', 'c', 'f']));
  });

  it('las demás: una de llegada vieja, una que se sella en el minuto actual y una de antes, sin votación', async () => {
    // La de llegada vieja: llegó el 03/11 a las 10:00 (13:00 UTC), así que su cierre fue el miércoles 04/11 a las 12:00
    const vieja = await enviar(partesDePrueba(regularDeCuatro('2026-11-03')));
    assert.equal(vieja.status, 201, JSON.stringify(vieja.body));
    ed.vieja = vieja.body.data.id;
    await query('UPDATE dato_quincena_ediciones SET recibida_at = FROM_UNIXTIME(?) WHERE id = ?', [Date.UTC(2026, 10, 3, 13, 0) / 1000, ed.vieja]);
    assert.equal(await cierreDe(ed.vieja), '2026-11-04 12:00');

    const sellada = await enviar(partesDePrueba(regularDeCuatro('2026-11-05')));
    assert.equal(sellada.status, 201, JSON.stringify(sellada.body));
    ed.sellada = sellada.body.data.id;
    await sellar(ed.sellada, `${ahoraArgentina().slice(0, 16)}:00`);

    // Una edición de antes de la votación: escrita a mano, sin su fila en dato_quincena_votaciones, con una elección a mano
    const deAntes = edicionDePrueba({ fecha_edicion: '2026-11-09' });
    ed.deAntes = (await query(
      `INSERT INTO dato_quincena_ediciones (clave, tipo, fecha_edicion, referencia_piloto, titulo, metadata, huella)
       VALUES ('dq:regular:2026-11-09', 'regular', '2026-11-09', NULL, ?, ?, ?)`,
      [deAntes.titulo, JSON.stringify(deAntes), 'e'.repeat(64)]
    )).insertId;
    await query(
      `INSERT INTO dato_quincena_propuestas (edicion_id, orden, titulo, cifra_clave, principal, dataset_id, dataset_nombre)
       VALUES (?, 1, 'Un título inventado', '1.234 casos · septiembre de 2026', 1, 1, 'Dataset de prueba A'),
              (?, 2, 'Otro título inventado', '56 casos · septiembre de 2026', 0, 2, 'Dataset de prueba B')`,
      [ed.deAntes, ed.deAntes]
    );
    await query(
      "INSERT INTO dato_quincena_principal_equipo (edicion_id, orden, elegida_por, elegida_at) VALUES (?, 2, ?, '2026-11-09 10:12:00')",
      [ed.deAntes, personas.a.id]
    );
    assert.deepEqual(await votacionDe(ed.deAntes), []);
  });
});

describe('votar: PUT /api/dato-quincena/ediciones/:id/voto', () => {
  let cierre;
  before(async () => {
    cierre = await cierreDe(ed.regular);
  });

  it('404 «No existe esa edición.» con un id que no es un entero positivo o que no existe, antes de mirar el cuerpo', async () => {
    for (const id of ['abc', '999999', '0', '-1', '1.5', '01']) {
      for (const cuerpo of [{ orden: [1, 2, 3, 4] }, { orden: 'x' }, undefined]) {
        const res = await votar(id, cuerpo);
        assert.equal(res.status, 404, `${id} ${JSON.stringify(cuerpo)}`);
        assert.deepEqual(res.body, NO_EXISTE, `${id} ${JSON.stringify(cuerpo)}`);
      }
    }
    assert.deepEqual(await todosLosVotos(), []);
  });

  it('sin sesión o con el token del bot, 401', async () => {
    for (const token of [undefined, TOKEN]) {
      const res = await api.put(`/dato-quincena/ediciones/${ed.regular}/voto`, { orden: [1, 2, 3, 4] }, { token });
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    }
  });

  it('una edición de antes: 409 «Esta edición no se vota.», también para quien no está en ninguna foto', async () => {
    for (const clave of ['a', 'e']) {
      const res = await votar(ed.deAntes, { orden: [1, 2] }, clave);
      assert.equal(res.status, 409, clave);
      assert.deepEqual(res.body, error('noSeVota'), clave);
    }
  });

  it('quien no está en la foto: 403, también quien se sumó a la lista después de la llegada', async () => {
    assert.ok((await query('SELECT 1 FROM dato_quincena_votantes WHERE usuario_id = ?', [personas.f.id])).length === 1);
    for (const clave of ['e', 'f', 'superadmin']) {
      const res = await votar(ed.regular, { orden: [1, 2, 3, 4] }, clave);
      assert.equal(res.status, 403, clave);
      assert.deepEqual(res.body, error('noEstas'), clave);
    }
    // Una que no está en la foto y la votación ya cerró: el 403 va antes que el 409
    assert.deepEqual((await votar(ed.sellada, { orden: [1, 2, 3, 4] }, 'e')).body, error('noEstas'));
    assert.deepEqual(await todosLosVotos(), []);
  });

  it('una votación que ya cerró: 409 «La votación ya cerró.», antes de mirar el orden', async () => {
    // Sellada con el cierre en el minuto actual, y una de llegada vieja (su cierre calculado ya pasó)
    for (const id of [ed.sellada, ed.vieja]) {
      for (const cuerpo of [{ orden: [1, 2, 3, 4] }, { orden: [1, 2] }]) {
        const res = await votar(id, cuerpo);
        assert.equal(res.status, 409, `${id} ${JSON.stringify(cuerpo)}`);
        assert.deepEqual(res.body, error('cerro'), `${id} ${JSON.stringify(cuerpo)}`);
      }
    }
    assert.deepEqual(await todosLosVotos(), []);
  });

  it('un orden que no tiene cada propuesta una sola vez: 400 sin escribir', async () => {
    for (const cuerpo of [{ orden: [1, 2] }, { orden: [1, 1, 2, 3] }, { orden: '1,2,3,4' }, undefined, {}, { orden: null },
      { orden: [1, 2, 3, 5] }, { orden: ['1', '2', '3', '4'] }, { orden: [1, 2, 3, 4, 5] }, { orden: [1.5, 2, 3, 4] },
      { orden: { 0: 1, 1: 2, 2: 3, 3: 4 } }, { otra: [1, 2, 3, 4] }]) {
      const res = await votar(ed.regular, cuerpo);
      assert.equal(res.status, 400, JSON.stringify(cuerpo));
      assert.deepEqual(res.body, error('orden'), JSON.stringify(cuerpo));
    }
    assert.deepEqual(await todosLosVotos(), []);
  });

  it('200 con cambio true y hasta cuándo se puede cambiar; una fila con quién, el orden y la hora argentina', async () => {
    const antes = ahoraArgentina();
    const res = await votar(ed.regular, { orden: [2, 1, 4, 3] });
    const despues = ahoraArgentina();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, {
      success: true, data: { cambio: true }, message: `Guardamos tu orden. Lo podés cambiar hasta ${cierreMedio(cierre)}, o hasta que voten todas las personas de la lista.`
    });
    const votos = await votosDe(ed.regular);
    assert.equal(votos.length, 1);
    assert.deepEqual({ ...votos[0], id: 0, votado_at: '·' }, { id: 0, usuario_id: personas.a.id, orden: '2,1,4,3', votado_at: '·' });
    assert.ok(votos[0].votado_at >= antes && votos[0].votado_at <= despues, `${antes} ≤ ${votos[0].votado_at} ≤ ${despues}`);
  });

  it('el mismo orden otra vez: cambio false, «Tu orden ya era ese.» y ninguna fila nueva; otro orden, una fila más', async () => {
    const igual = await votar(ed.regular, { orden: [2, 1, 4, 3] });
    assert.equal(igual.status, 200, JSON.stringify(igual.body));
    assert.deepEqual(igual.body, { success: true, data: { cambio: false }, message: 'Tu orden ya era ese.' });
    assert.equal((await votosDe(ed.regular)).length, 1);

    const otro = await votar(ed.regular, { orden: [1, 2, 3, 4] });
    assert.equal(otro.status, 200, JSON.stringify(otro.body));
    assert.equal(otro.body.data.cambio, true);
    assert.deepEqual((await votosDe(ed.regular)).map((v) => v.orden), ['2,1,4,3', '1,2,3,4']);
  });

  it('un lector de la foto vota igual: el permiso es estar en la foto, no el rol', async () => {
    const res = await votar(ed.regular, { orden: [4, 3, 2, 1] }, 'c');
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.cambio, true);
    assert.deepEqual((await votosDe(ed.regular)).filter((v) => v.usuario_id === personas.c.id).map((v) => v.orden), ['4,3,2,1']);
  });

  // La fila de la votación se bloquea (FOR UPDATE): los dos pedidos de la misma persona esperan uno al otro, sin cruzarse ni dar un 500.
  // Cinco rondas, porque el cruce depende del momento
  it('dos órdenes distintos a la vez de la misma persona: 200 los dos y dos filas; dos iguales a la vez, una sola', async () => {
    const ordenes = [[1, 3, 2, 4], [3, 1, 4, 2], [2, 4, 1, 3], [4, 1, 3, 2], [1, 4, 2, 3], [3, 2, 4, 1], [2, 3, 4, 1], [4, 2, 1, 3],
      [1, 2, 4, 3], [3, 4, 1, 2]];
    for (let ronda = 0; ronda < 5; ronda++) {
      const antes = (await votosDe(ed.regular)).length;
      const respuestas = await Promise.all([votar(ed.regular, { orden: ordenes[2 * ronda] }, 'c'),
        votar(ed.regular, { orden: ordenes[2 * ronda + 1] }, 'c')]);
      for (const res of respuestas) {
        assert.equal(res.status, 200, `ronda ${ronda}: ${JSON.stringify(res.body)}`);
        assert.equal(res.body.data.cambio, true, `ronda ${ronda}`);
      }
      assert.equal((await votosDe(ed.regular)).length, antes + 2, `ronda ${ronda}`);
    }
    const antes = (await votosDe(ed.regular)).length;
    const iguales = await Promise.all(Array.from({ length: 5 }, () => votar(ed.regular, { orden: [4, 3, 2, 1] }, 'c')));
    for (const res of iguales) assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(iguales.map((res) => res.body.data.cambio).sort(), [false, false, false, false, true]);
    const despues = await votosDe(ed.regular);
    assert.equal(despues.length, antes + 1);
    assert.equal(despues.at(-1).orden, '4,3,2,1');
  });

  it('el piloto: votan A, B y C; F, no', async () => {
    for (const [clave, orden] of [['a', [2, 1, 4, 3]], ['b', [3, 2, 1, 4]], ['c', [4, 2, 1, 3]]]) {
      const res = await votar(ed.piloto, { orden }, clave);
      assert.equal(res.status, 200, `${clave} ${JSON.stringify(res.body)}`);
    }
    assert.deepEqual((await votosDe(ed.piloto)).map((v) => [v.usuario_id, v.orden]),
      [[personas.a.id, '2,1,4,3'], [personas.b.id, '3,2,1,4'], [personas.c.id, '4,2,1,3']]);
  });

  // guardarVoto llamado directo (lo que el PUT no puede forzar): si el cierre se mira adentro y ya cerró, no escribe; si mirarlo tira,
  // rechaza sin escribir y la transacción se deshace (después, la fila de la votación se puede volver a bloquear)
  it('guardarVoto: cerrada adentro de la transacción, { cerrada: true } sin escribir; si el cierre tira, rechaza sin escribir', async () => {
    const { guardarVoto } = await elServicio();
    const antes = await todosLosVotos();
    const pedido = { edicionId: ed.regular, usuarioId: personas.a.id, orden: '3,4,1,2' };
    assert.deepEqual(await guardarVoto({ ...pedido, estaCerrada: () => true }),
      { votacion: true, persona: true, cerrada: true, cambio: false, cerro: false });
    assert.deepEqual(await todosLosVotos(), antes);
    await assert.rejects(guardarVoto({ ...pedido, estaCerrada: () => { throw new Error('Sin el calendario'); } }), /Sin el calendario/);
    assert.deepEqual(await todosLosVotos(), antes);
    // El último orden de A es 1,2,3,4: con el candado suelto, el mismo orden contesta sin escribir
    assert.deepEqual(await guardarVoto({ ...pedido, orden: '1,2,3,4', estaCerrada: () => false }),
      { votacion: true, persona: true, cerrada: false, cambio: false, cerro: false });
    assert.deepEqual(await todosLosVotos(), antes);
  });

  // Sin la tabla de feriados el calendario son los 9 fijos y el cierre no se sabe con certeza: una votación sin sellar no guarda votos
  // (500 sin escribir); una sellada sigue cerrada. El detalle y la lista la muestran abierta, sin cierre y sin que nadie pueda votar
  it('sin el calendario: 500 «No se pudo guardar tu orden…» sin escribir; la sellada, 409; el detalle y la lista, sin cierre', async () => {
    const antes = await todosLosVotos();
    await query('RENAME TABLE feriados TO feriados_fuera');
    try {
      const res = await votar(ed.regular, { orden: [1, 2, 3, 4] }, 'b');
      assert.equal(res.status, 500, JSON.stringify(res.body));
      assert.deepEqual(res.body, error('alGuardar'));
      assert.deepEqual((await votar(ed.sellada, { orden: [1, 2, 3, 4] })).body, error('cerro'));
      const { votacion, principal_equipo } = (await detalle(ed.regular, 'b')).data;
      assert.deepEqual([votacion.estado, votacion.cierre, votacion.resumen, votacion.puede_votar, votacion.falta_tu_voto, votacion.dialogo],
        ['abierta', SIN_CALENDARIO, 'se está votando.', false, false, null]);
      assert.equal(principal_equipo.resumen, 'se está votando.');
      assert.equal(votacion.resultado, null);
      assert.deepEqual((await enLaLista(ed.regular, 'b')).votacion, { texto: 'Se está votando', falta_tu_voto: false });
    } finally {
      await query('RENAME TABLE feriados_fuera TO feriados');
    }
    assert.deepEqual(await todosLosVotos(), antes);
  });
});

describe('el detalle y la lista', () => {
  let cierre;
  before(async () => {
    cierre = await cierreDe(ed.regular);
  });

  const participacion = 'Ya votaron 2 de 3: Persona A y Persona C. Falta el voto de Persona B.';
  const dialogo = () => 'Tocá las propuestas en orden, de la que más querés trabajar como principal a la que menos. '
    + `Lo podés cambiar hasta ${cierreMedio(cierre)}, o hasta que voten todas las personas de la lista.`;

  it('abierta, para quien está en la foto y no votó: puede votar y le falta, sin el orden de nadie', async () => {
    const res = await detalle(ed.regular, 'b');
    assert.deepEqual(forma(res), forma(RESPUESTAS.detalle_votacion_abierta));
    assert.deepEqual(res.data.votacion, {
      estado: 'abierta',
      resumen: `se vota hasta ${cierreMedio(cierre)}.`,
      cierre: `Se vota hasta ${cierreLargo(cierre)}.`,
      participacion,
      puede_votar: true,
      falta_tu_voto: true,
      tu_orden: null,
      dialogo: dialogo(),
      // B es la única que falta: su voto cierra la votación
      aviso_de_cierre: AVISO_DE_CIERRE,
      resultado: null
    });
    assert.deepEqual(res.data.principal_equipo, {
      ...RESPUESTAS.detalle_votacion_abierta.data.principal_equipo, resumen: `se vota hasta ${cierreMedio(cierre)}.`
    });
    assert.equal(Object.keys(res.data).at(-1), 'votacion');
  });

  it('abierta, para quien ya votó: su orden vigente; para quien no está en la foto, sin votar y la misma participación', async () => {
    const conVoto = await detalle(ed.regular, 'a');
    assert.deepEqual(forma(conVoto), forma(RESPUESTAS.detalle_votacion_abierta_con_voto));
    assert.deepEqual(conVoto.data.votacion.tu_orden, [1, 2, 3, 4].map((orden, i) => ({ puesto: `${i + 1}.º`, orden, texto: textoDe(orden) })));
    assert.deepEqual([conVoto.data.votacion.puede_votar, conVoto.data.votacion.falta_tu_voto], [true, false]);

    const fuera = (await detalle(ed.regular, 'e')).data.votacion;
    assert.deepEqual([fuera.puede_votar, fuera.falta_tu_voto, fuera.tu_orden, fuera.dialogo], [false, false, null, null]);
    // El aviso del diálogo es solo para B, la única que falta: ni para quien ya votó y cambia, ni para quien no está en la foto
    assert.deepEqual([conVoto.data.votacion.aviso_de_cierre, fuera.aviso_de_cierre], [null, null]);
    assert.equal(fuera.participacion, participacion);
    assert.equal(conVoto.data.votacion.participacion, participacion);
  });

  it('cerrada por puntos (el piloto, sellado con su cierre): la ganadora, cómo ganó, la tabla de los votos y quién no votó', async () => {
    const cierreDelPiloto = await cierreDe(ed.piloto);
    await sellar(ed.piloto, `${cierreDelPiloto}:00`);
    const res = await detalle(ed.piloto, 'e');
    assert.deepEqual(forma(res), forma(RESPUESTAS.detalle_votacion_cerrada_puntos));
    const { votacion, principal_equipo } = res.data;
    assert.deepEqual(
      [votacion.estado, votacion.resumen, votacion.cierre, votacion.participacion, votacion.puede_votar, votacion.tu_orden, votacion.dialogo],
      ['cerrada', null, `La votación cerró ${cierreLargo(cierreDelPiloto)}.`, 'Votaron 3 de 4: no votó Persona F.', false, null, null]
    );
    assert.deepEqual(votacion.resultado, {
      orden: 2,
      como: 'puntos',
      texto: 'Ganó por puntos: 10, contra 7 de la que siguió.',
      regla: 'Cada puesto da puntos: con 4 propuestas, el 1.º da 4 y el último, 1. Si empatan, gana la de Datito; si no está entre '
        + 'las empatadas, la de número más bajo.',
      tabla: {
        votantes: ['Persona A', 'Persona B', 'Persona C'],
        filas: [
          { orden: 2, texto: textoDe(2), de_datito: false, puestos: ['1.º', '2.º', '2.º'], puntos: 10, gana: true },
          { orden: 1, texto: textoDe(1), de_datito: true, puestos: ['2.º', '3.º', '3.º'], puntos: 7, gana: false },
          { orden: 4, texto: textoDe(4), de_datito: false, puestos: ['3.º', '4.º', '1.º'], puntos: 7, gana: false },
          { orden: 3, texto: textoDe(3), de_datito: false, puestos: ['4.º', '1.º', '4.º'], puntos: 6, gana: false }
        ]
      }
    });
    assert.deepEqual(principal_equipo, {
      ...RESPUESTAS.detalle_votacion_cerrada_puntos.data.principal_equipo, resumen: textoDe(2)
    });
    // Ya cerrada, nadie puede votar
    assert.deepEqual((await votar(ed.piloto, { orden: [1, 2, 3, 4] }, 'f')).body, error('cerro'));
  });

  it('cerrada sin votos (la de llegada vieja): queda la de Datito y no hay tabla', async () => {
    const res = await detalle(ed.vieja, 'b');
    assert.deepEqual(forma(res), forma(RESPUESTAS.detalle_votacion_cerrada_nadie));
    const { votacion, principal_equipo } = res.data;
    assert.equal(votacion.cierre, 'La votación cerró el miércoles 04/11/2026 a las 12:00.');
    assert.equal(votacion.participacion, 'No votó nadie de 4.');
    assert.deepEqual([votacion.resultado.orden, votacion.resultado.como, votacion.resultado.texto, votacion.resultado.tabla],
      [1, 'nadie', 'Nadie votó: quedó la de Datito.', null]);
    assert.deepEqual(principal_equipo, RESPUESTAS.detalle_votacion_cerrada_nadie.data.principal_equipo);
  });

  it('una edición de antes: votacion null y la elección a mano, como antes', async () => {
    const res = await detalle(ed.deAntes, 'c');
    assert.equal(res.data.votacion, null);
    assert.deepEqual(res.data.principal_equipo, {
      ...RESPUESTAS.detalle_equipo_otra.data.principal_equipo, quien: 'La eligió Persona A el 09/11/2026 a las 10:12.'
    });
  });

  it('la lista: la abierta con la de Datito y hasta cuándo, con «falta tu voto» de cada uno; las cerradas, con la que ganó', async () => {
    const abierta = await enLaLista(ed.regular, 'b');
    assert.deepEqual(abierta.principal, RESPUESTAS.lista.data.ediciones[2].principal);
    assert.deepEqual(abierta.votacion, { texto: `Se vota hasta el ${cierreCorto(cierre)}`, falta_tu_voto: true });
    assert.equal(Object.keys(abierta).at(-1), 'votacion');
    assert.deepEqual((await enLaLista(ed.regular, 'a')).votacion.falta_tu_voto, false);
    assert.deepEqual((await enLaLista(ed.regular, 'e')).votacion.falta_tu_voto, false);

    const piloto = await enLaLista(ed.piloto, 'b');
    assert.deepEqual(piloto.principal, { titulo: TITULOS[1], cifra_clave: '56 casos · septiembre de 2026', rotulo: 'Principal del equipo' });
    assert.equal(piloto.resto, 'Y 3 propuestas más: Dataset de prueba A, Dataset de prueba B y Dataset de prueba B.');
    assert.equal(piloto.votacion, null);
    const vieja = await enLaLista(ed.vieja, 'b');
    assert.deepEqual(vieja.principal, { ...RESPUESTAS.lista.data.ediciones[2].principal, rotulo: 'Principal del equipo' });
    assert.equal(vieja.votacion, null);
    const deAntes = await enLaLista(ed.deAntes, 'b');
    assert.deepEqual(deAntes.principal, { titulo: TITULOS[1], cifra_clave: '56 casos · septiembre de 2026', rotulo: 'Principal del equipo' });
    assert.equal(deAntes.votacion, null);
  });
});

// La votación cierra cuando votaron todos (spec 2026-11-23-dato-quincena-votacion-cierre-anticipado): el voto que completa la foto la
// cierra en ese momento, con la hora de ese voto; después nadie cambia su orden (409, sin fila nueva), y mientras falta alguien, sí. Cada
// test con ediciones nuevas, con la foto de A, B y C, que llegan recién: su cierre de las 12:00 todavía no pasó
describe('cierra cuando votaron todos', () => {
  const nueva = async (fecha) => {
    const res = await enviar(partesDePrueba(regularDeCuatro(fecha)));
    assert.equal(res.status, 201, JSON.stringify(res.body));
    return res.body.data.id;
  };
  const hastaCuando = async (id) => `Guardamos tu orden. Lo podés cambiar hasta ${cierreMedio(await cierreDe(id))}, `
    + 'o hasta que voten todas las personas de la lista.';
  const guardado = (message) => ({ success: true, data: { cambio: true }, message });
  // De cada propuesta, de la ganadora a la última: [orden, puntos]
  const puntosDe = (votacion) => votacion.resultado.tabla.filas.map((fila) => [fila.orden, fila.puntos]);
  // Cuántos pedidos esperan el FOR UPDATE de guardarVoto en la base de prueba (los hilos del mismo usuario de la base, sin esta conexión)
  const esperandoElCandado = async (conexion) => Number((await conexion.query(
    `SELECT COUNT(*) AS n FROM information_schema.PROCESSLIST
     WHERE DB = DATABASE() AND ID <> CONNECTION_ID() AND INFO LIKE '%dato_quincena_votaciones%FOR UPDATE%'`
  ))[0][0].n);
  // Fuerza el choque en el candado: toma la fila de la votación de `id` con FOR UPDATE en otra conexión, con la transacción abierta,
  // lanza los pedidos y, cuando los dos esperan ese candado (o pasados dos segundos), hace el rollback. Así los dos llegan al FOR UPDATE de
  // guardarVoto antes de que alguno se guarde, y no uno después del otro. Devuelve las respuestas y cuántos esperaron
  const chocanEnElCandado = async (id, pedidos) => {
    const conexion = await db().getConnection();
    let respuestas = null;
    let esperando = 0;
    try {
      await conexion.beginTransaction();
      await conexion.query('SELECT edicion_id FROM dato_quincena_votaciones WHERE edicion_id = ? FOR UPDATE', [id]);
      respuestas = Promise.all(pedidos());
      for (let vuelta = 0; vuelta < 100 && esperando < 2; vuelta++) {
        await new Promise((listo) => setTimeout(listo, 20));
        esperando = await esperandoElCandado(conexion);
      }
    } finally {
      await conexion.rollback();
      conexion.release();
    }
    return { respuestas: await respuestas, esperando };
  };

  before(async () => {
    await ponerLaLista(['a', 'b', 'c']);
  });

  it('el voto que completa la foto: 200 con «Votaron todos…» y la edición cerrada para todos, con la hora de ese voto', async () => {
    ed.porTodos = await nueva('2026-11-10');
    const id = ed.porTodos;
    const normal = await hastaCuando(id);
    assert.deepEqual((await votar(id, { orden: [2, 1, 4, 3] }, 'a')).body, guardado(normal));
    // Faltan B y C: el aviso no es para nadie
    for (const clave of ['a', 'b', 'c']) assert.equal((await detalle(id, clave)).data.votacion.aviso_de_cierre, null, clave);
    assert.deepEqual((await votar(id, { orden: [3, 1, 2, 4] }, 'b')).body, guardado(normal));
    // Falta C: el aviso es solo para C
    assert.equal((await detalle(id, 'c')).data.votacion.aviso_de_cierre, AVISO_DE_CIERRE);
    for (const clave of ['a', 'b', 'e']) assert.equal((await detalle(id, clave)).data.votacion.aviso_de_cierre, null, clave);
    // Mientras falta C, A cambia su orden: 200, como siempre (Review Focus 2)
    assert.deepEqual((await votar(id, { orden: [1, 2, 3, 4] }, 'a')).body, guardado(normal));

    const antes = ahoraArgentina();
    const res = await votar(id, { orden: [4, 1, 2, 3] }, 'c');
    const despues = ahoraArgentina();
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body, guardado(CERRO));
    const votos = await votosDe(id);
    assert.deepEqual(votos.map((v) => [v.usuario_id, v.orden]), [[personas.a.id, '2,1,4,3'], [personas.b.id, '3,1,2,4'],
      [personas.a.id, '1,2,3,4'], [personas.c.id, '4,1,2,3']]);
    const hora = votos.at(-1).votado_at;
    assert.ok(antes <= hora && hora <= despues, `${antes} ≤ ${hora} ≤ ${despues}`);

    for (const clave of ['a', 'c', 'e']) {
      const { votacion, principal_equipo } = (await detalle(id, clave)).data;
      assert.deepEqual(
        [votacion.estado, votacion.resumen, votacion.cierre, votacion.participacion, votacion.puede_votar, votacion.falta_tu_voto,
          votacion.tu_orden, votacion.dialogo, votacion.aviso_de_cierre],
        ['cerrada', null, `La votación cerró ${cierreLargo(hora.slice(0, 16))}, cuando votaron todos.`, 'Votaron 3 de 3.', false, false,
          null, null, null],
        clave
      );
      // Cuenta el cambio de A (con su primer orden, ganaba la 1 por 9 a 8)
      assert.equal(votacion.resultado.texto, 'Ganó por puntos: 10, contra 7 de la que siguió.', clave);
      assert.deepEqual(votacion.resultado.tabla.votantes, ['Persona A', 'Persona B', 'Persona C'], clave);
      assert.deepEqual(puntosDe(votacion), [[1, 10], [2, 7], [3, 7], [4, 6]], clave);
      assert.equal(principal_equipo.orden, 1, clave);
    }
    const enLista = await enLaLista(id, 'b');
    assert.equal(enLista.votacion, null);
    assert.equal(enLista.principal.rotulo, 'Principal del equipo');
  });

  it('después del voto que cierra nadie cambia su orden: 409 «La votación ya cerró.» sin fila nueva, ni con el mismo orden', async () => {
    const antes = await votosDe(ed.porTodos);
    for (const [clave, orden] of [['a', [4, 3, 2, 1]], ['b', [1, 2, 3, 4]], ['c', [1, 2, 3, 4]], ['c', [4, 1, 2, 3]]]) {
      const res = await votar(ed.porTodos, { orden }, clave);
      assert.equal(res.status, 409, `${clave} ${orden}`);
      assert.deepEqual(res.body, error('cerro'), `${clave} ${orden}`);
    }
    // Quien no está en la foto sigue con su 403
    assert.deepEqual((await votar(ed.porTodos, { orden: [1, 2, 3, 4] }, 'e')).body, error('noEstas'));
    assert.deepEqual(await votosDe(ed.porTodos), antes);
  });

  // Review Focus 2, justo después: el control de afuera del PUT pasó antes de que se guardara el voto que cierra, y el pedido esperó el
  // candado. Adentro de la transacción, guardarVoto le pasa a estaCerrada la foto, los votos y las propuestas de ese momento: ya cerró
  it('guardarVoto, justo después del voto que cierra: adentro de la transacción ve que votaron todos y no escribe', async () => {
    const { guardarVoto } = await elServicio();
    const antes = await votosDe(ed.porTodos);
    const calendario = calendarioCon([]);
    const estaCerrada = (leida) => !estadoDeLaVotacionLeida(leida, { ahora: leida.ahora, calendario }).abierta;
    for (const [clave, orden] of [['a', '4,3,2,1'], ['b', '1,2,3,4']]) {
      assert.deepEqual(await guardarVoto({ edicionId: ed.porTodos, usuarioId: personas[clave].id, orden, estaCerrada }),
        { votacion: true, persona: true, cerrada: true, cambio: false, cerro: false }, clave);
    }
    assert.deepEqual(await votosDe(ed.porTodos), antes);
  });

  // La hora del voto la da reloj(), con la votación ya bloqueada: la misma con la que estaCerrada mira el cierre y la que se guarda
  it('guardarVoto: estaCerrada recibe la foto, los votos, las propuestas y la hora de reloj(); cerro, solo el voto que completa la foto', async () => {
    const { guardarVoto } = await elServicio();
    const id = await nueva('2026-11-17');
    const recibido = [];
    const estaCerrada = (leida) => {
      recibido.push(structuredClone(leida));
      return false;
    };
    const vota = (clave, orden, hora) => guardarVoto({
      edicionId: id, usuarioId: personas[clave].id, orden, reloj: () => hora, estaCerrada
    });
    const sinCerrar = { votacion: true, persona: true, cerrada: false, cambio: true, cerro: false };
    assert.deepEqual(await vota('a', '2,1,4,3', '2026-11-23 21:30:15'), sinCerrar);
    assert.deepEqual(Object.keys(recibido[0]).sort(),
      ['ahora', 'cierre_at', 'fecha_edicion', 'ordenes', 'personas', 'recibida_ts', 'votos']);
    assert.deepEqual({ ...recibido[0], recibida_ts: '·', personas: recibido[0].personas.map((p) => p.usuario_id) }, {
      cierre_at: null, fecha_edicion: '2026-11-17', recibida_ts: '·', personas: lista(['a', 'b', 'c']), votos: [], ordenes: [1, 2, 3, 4],
      ahora: '2026-11-23 21:30:15'
    });
    assert.ok(Number.isSafeInteger(recibido[0].recibida_ts));
    assert.deepEqual(await vota('b', '1,2,3,4', '2026-11-23 21:35:00'), sinCerrar);
    // Con los votos de ese momento, ya guardados, y su hora
    assert.deepEqual(recibido[1].votos.map((v) => [v.persona_id, v.orden, v.votado_at]),
      [[recibido[0].personas[0].persona_id, '2,1,4,3', '2026-11-23 21:30:15']]);
    assert.equal(recibido[1].ahora, '2026-11-23 21:35:00');
    // C completa la foto
    assert.deepEqual(await vota('c', '4,3,2,1', '2026-11-23 21:40:00'), { ...sinCerrar, cerro: true });
    assert.deepEqual((await votosDe(id)).map((v) => [v.usuario_id, v.orden, v.votado_at]), [
      [personas.a.id, '2,1,4,3', '2026-11-23 21:30:15'], [personas.b.id, '1,2,3,4', '2026-11-23 21:35:00'],
      [personas.c.id, '4,3,2,1', '2026-11-23 21:40:00']
    ]);
    // Con estaCerrada en false a la fuerza, otro voto se guarda, pero no es el que completa la foto: cerro false; el mismo orden, sin fila
    assert.deepEqual(await vota('a', '1,2,3,4', '2026-11-23 21:41:00'), sinCerrar);
    assert.deepEqual(await vota('a', '1,2,3,4', '2026-11-23 21:42:00'), { ...sinCerrar, cambio: false });
    assert.equal((await votosDe(id)).length, 4);
  });

  // Review Focus 1: B y C faltan y votan a la vez, y chocan en el candado (chocanEnElCandado). El candado los ordena: los dos se guardan, el
  // segundo en guardarse es el que cierra, y el resultado cuenta los dos. Tres rondas: cuál toma el candado primero depende del momento
  it('dos que faltan votan a la vez: 200 los dos, solo el segundo en guardarse trae «Votaron todos…» y el resultado cuenta los dos', async () => {
    for (const [ronda, fecha] of ['2026-11-11', '2026-11-12', '2026-11-13'].entries()) {
      const id = await nueva(fecha);
      const normal = await hastaCuando(id);
      assert.deepEqual((await votar(id, { orden: [1, 2, 3, 4] }, 'a')).body, guardado(normal), `ronda ${ronda}`);
      const { respuestas: [deB, deC], esperando } = await chocanEnElCandado(id,
        () => [votar(id, { orden: [2, 1, 3, 4] }, 'b'), votar(id, { orden: [3, 1, 2, 4] }, 'c')]);
      assert.equal(esperando, 2, `ronda ${ronda}: los dos esperaron el candado`);
      const votos = await votosDe(id);
      assert.deepEqual(votos.map((v) => v.usuario_id).slice(0, 1), [personas.a.id], `ronda ${ronda}`);
      assert.deepEqual(votos.map((v) => v.usuario_id).slice(1).sort(), [personas.b.id, personas.c.id].sort(), `ronda ${ronda}`);
      const cerroB = votos.at(-1).usuario_id === personas.b.id;
      assert.deepEqual((cerroB ? deB : deC).body, guardado(CERRO), `ronda ${ronda}`);
      assert.deepEqual((cerroB ? deC : deB).body, guardado(normal), `ronda ${ronda}`);
      const { votacion } = (await detalle(id, 'e')).data;
      assert.equal(votacion.estado, 'cerrada', `ronda ${ronda}`);
      assert.equal(votacion.cierre, `La votación cerró ${cierreLargo(votos.at(-1).votado_at.slice(0, 16))}, cuando votaron todos.`);
      assert.equal(votacion.participacion, 'Votaron 3 de 3.', `ronda ${ronda}`);
      // Sin el voto de B, la 1 ganaría 7 a 6; sin el de C, empatarían la 1 y la 2
      assert.equal(votacion.resultado.texto, 'Ganó por puntos: 10, contra 9 de la que siguió.', `ronda ${ronda}`);
      assert.deepEqual(puntosDe(votacion), [[1, 10], [2, 9], [3, 8], [4, 3]], `ronda ${ronda}`);
    }
  });

  // Review Focus 2, a la vez: A ya votó y cambia su orden en el mismo momento en que C, la única que falta, vota, y chocan en el candado
  // (chocanEnElCandado). O el cambio entra antes (200 y cuenta) o después (409 y sin fila); el voto de C cierra siempre. Tres rondas: cuál
  // toma el candado primero depende del momento
  it('un cambio a la vez que el voto que cierra: o entra antes y cuenta, o da 409 sin fila; el que cierra, siempre 200', async () => {
    for (const [ronda, fecha] of ['2026-11-14', '2026-11-15', '2026-11-16'].entries()) {
      const id = await nueva(fecha);
      const normal = await hastaCuando(id);
      assert.deepEqual((await votar(id, { orden: [1, 2, 3, 4] }, 'a')).body, guardado(normal), `ronda ${ronda}`);
      assert.deepEqual((await votar(id, { orden: [2, 1, 3, 4] }, 'b')).body, guardado(normal), `ronda ${ronda}`);
      const { respuestas: [deA, deC], esperando } = await chocanEnElCandado(id,
        () => [votar(id, { orden: [4, 3, 2, 1] }, 'a'), votar(id, { orden: [3, 1, 2, 4] }, 'c')]);
      assert.equal(esperando, 2, `ronda ${ronda}: los dos esperaron el candado`);
      assert.deepEqual(deC.body, guardado(CERRO), `ronda ${ronda}`);
      const votos = (await votosDe(id)).map((v) => [v.usuario_id, v.orden]);
      const { votacion } = (await detalle(id, 'e')).data;
      if (deA.status === 200) {
        assert.deepEqual(deA.body, guardado(normal), `ronda ${ronda}`);
        assert.deepEqual(votos, [[personas.a.id, '1,2,3,4'], [personas.b.id, '2,1,3,4'], [personas.a.id, '4,3,2,1'],
          [personas.c.id, '3,1,2,4']], `ronda ${ronda}`);
        assert.equal(votacion.resultado.texto, 'Ganó por puntos: 9, contra 8 de la que siguió.', `ronda ${ronda}`);
      } else {
        assert.equal(deA.status, 409, `ronda ${ronda}`);
        assert.deepEqual(deA.body, error('cerro'), `ronda ${ronda}`);
        assert.deepEqual(votos, [[personas.a.id, '1,2,3,4'], [personas.b.id, '2,1,3,4'], [personas.c.id, '3,1,2,4']], `ronda ${ronda}`);
        assert.equal(votacion.resultado.texto, 'Ganó por puntos: 10, contra 9 de la que siguió.', `ronda ${ronda}`);
      }
      assert.equal(votacion.participacion, 'Votaron 3 de 3.', `ronda ${ronda}`);
    }
  });
});

// La designación directa desaparece (spec 3): la ruta queda para una pestaña con la página anterior y, después del 404, contesta 409
// sin escribir. Sigue siendo de administración (adminOnly)
describe('la principal elegida a mano: PUT …/principal-equipo', () => {
  const elegir = (id, cuerpo, clave = 'a') => api.put(`/dato-quincena/ediciones/${id}/principal-equipo`, cuerpo,
    { token: personas[clave].token });

  it('administración: 409 «… ahora se vota…» sin escribir, en una edición que se vota y en una de antes', async () => {
    const antes = (await query('SELECT * FROM dato_quincena_principal_equipo ORDER BY id')).map((fila) => ({ ...fila }));
    for (const clave of ['a', 'b', 'superadmin']) {
      for (const id of [ed.regular, ed.deAntes]) {
        for (const cuerpo of [{ orden: 1 }, { orden: 'x' }, {}]) {
          const res = await elegir(id, cuerpo, clave);
          assert.equal(res.status, 409, `${clave} ${id} ${JSON.stringify(cuerpo)}`);
          assert.deepEqual(res.body, error('ahoraSeVota'), `${clave} ${id} ${JSON.stringify(cuerpo)}`);
        }
      }
    }
    assert.deepEqual((await query('SELECT * FROM dato_quincena_principal_equipo ORDER BY id')).map((fila) => ({ ...fila })), antes);
  });

  it('404 antes, con un id que no existe o no es un entero positivo; un lector, 403', async () => {
    for (const id of ['999999', 'abc', '0']) {
      const res = await elegir(id, { orden: 1 });
      assert.equal(res.status, 404, id);
      assert.deepEqual(res.body, NO_EXISTE, id);
    }
    const lector = await elegir(ed.regular, { orden: 1 }, 'c');
    assert.equal(lector.status, 403);
  });
});

describe('sin las tablas de la votación', () => {
  it('el detalle, la lista, el voto y el POST: 500 con su mensaje fijo, nada guardado y, en la consola, solo el código', async () => {
    const ediciones = await cuenta('dato_quincena_ediciones');
    await query('RENAME TABLE dato_quincena_votaciones TO dato_quincena_votaciones_fuera');
    try {
      const casos = [
        [() => api.get(`/dato-quincena/ediciones/${ed.regular}`, { token: personas.a.token }), 'Error al obtener la edición'],
        [() => api.get(`/dato-quincena/ediciones/${ed.deAntes}`, { token: personas.a.token }), 'Error al obtener la edición'],
        [() => api.get('/dato-quincena/ediciones?anio=2026', { token: personas.a.token }), 'Error al obtener las ediciones'],
        [() => votar(ed.regular, { orden: [1, 2, 3, 4] }), MENSAJES_VOTACION.alGuardar],
        [() => enviar(partesDePrueba(regularDeCuatro('2026-11-06'))), 'No se pudo guardar la edición.']
      ];
      for (const [pedir, mensaje] of casos) {
        const res = await pedir();
        assert.equal(res.status, 500, mensaje);
        assert.deepEqual(res.body, { success: false, error: mensaje }, mensaje);
      }
    } finally {
      await query('RENAME TABLE dato_quincena_votaciones_fuera TO dato_quincena_votaciones');
    }
    assert.equal(await cuenta('dato_quincena_ediciones'), ediciones, 'el POST no guardó nada');
    const esperadas = ['Error al obtener la edición ER_NO_SUCH_TABLE', 'Error al obtener las ediciones ER_NO_SUCH_TABLE',
      `${MENSAJES_VOTACION.alGuardar} ER_NO_SUCH_TABLE`];
    for (let i = 0; i < 20 && !esperadas.every((linea) => servidor.logs().includes(linea)); i++) {
      await new Promise((listo) => setTimeout(listo, 100));
    }
    const lineas = servidor.logs().split('\n').filter((linea) => linea.startsWith('Error al ') || linea.startsWith('No se pudo guardar tu orden'));
    for (const linea of esperadas) assert.ok(lineas.some((l) => l.startsWith(linea)), `la consola registra «${linea}»`);
    for (const linea of lineas) assert.ok(!/SELECT|INSERT|FROM|WHERE/.test(linea), 'la consola no trae la consulta');
    // Y todo vuelve a andar
    assert.equal((await api.get(`/dato-quincena/ediciones/${ed.regular}`, { token: personas.a.token })).status, 200);
  });

  it('votar no manda ningún mail', async () => {
    assert.deepEqual(await mailpit.mensajes(), []);
  });
});
