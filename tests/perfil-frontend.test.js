// Mi Perfil (public/js/perfil.js), ejecutado en Node: los botones de aprobar y rechazar según quién puede auditar el
// cambio, y quién lo auditó (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const escaparHtml = (texto) => String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// elementos: los del DOM que mira el test (los demás son objetos vacíos); API: la de la página
const cargarPerfil = ({ elementos = {}, API = {} } = {}) => {
  const contexto = vm.createContext({
    document: { addEventListener() {}, getElementById: (id) => elementos[id] ?? { style: {} } },
    Utils: { escapeHtml: escaparHtml, textoCargo: (cargo) => cargo ?? '', textoVinculo: (vinculo) => vinculo ?? '', showError: (m) => { throw new Error(m); },
      safeUrl: (u) => /^https?:\/\//.test(u ?? '') ? u : null },
    Auth: {}, API, CONFIG: {}, console
  });
  vm.runInContext(fs.readFileSync(new URL('../public/js/perfil.js', import.meta.url), 'utf8'), contexto);
  return contexto;
};
const MENSAJE = 'Este cambio lo auditan Persona Auditora. Podés auditarlo solo si ninguno está disponible.';

describe('perfil.js: auditar un cambio (spec 8.2)', () => {
  it('con permiso, los botones de aprobar y rechazar funcionan', () => {
    const html = cargarPerfil().botonesDeAuditoria(5, { puede: true, mensaje: null });
    assert.match(html, /onclick="aprobarCambio\(5\)"/);
    assert.match(html, /abrirModalRechazo\(5\)/);
    assert.doesNotMatch(html, /disabled/);
  });

  it('sin permiso aparecen deshabilitados, con el motivo', () => {
    const contexto = cargarPerfil();
    const html = contexto.botonesDeAuditoria(5, { puede: false, mensaje: MENSAJE });
    assert.equal(html.match(/disabled/g).length, 2);
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo/);
    assert.ok(html.includes(`title="${MENSAJE}"`));
    assert.ok(contexto.avisoNoCorresponde('<b>x</b>').includes('&lt;b&gt;x&lt;/b&gt;'));
  });

  it('si el detalle no trae el permiso, falla cerrado: sin permiso ni motivo, los botones quedan deshabilitados y no se rompe', () => {
    const contexto = cargarPerfil();
    const permiso = contexto.permisoDeAuditoria({ id: 5, estado: 'pendiente' });
    assert.equal(permiso.puede, false);
    assert.equal(permiso.respaldo, false);
    assert.equal(permiso.mensaje, null);
    const html = contexto.botonesDeAuditoria(5, permiso);
    assert.equal(html.match(/disabled/g).length, 2);
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo|undefined|null/);
    // Si lo trae, se respeta tal cual
    const delServidor = { puede: true, respaldo: false, mensaje: null };
    assert.equal(contexto.permisoDeAuditoria({ auditoria: delServidor }), delServidor);
  });

  it('quién auditó: aprobado o rechazado, con "(respaldo)" si fue un editor de respaldo', () => {
    const contexto = cargarPerfil();
    assert.equal(contexto.textoRevisor({ estado: 'aprobado', revisor_nombre: 'Persona Editora', revisado_como_respaldo: 1 }),
      'Aprobado por Persona Editora (respaldo)');
    assert.equal(contexto.textoRevisor({ estado: 'aprobado', revisor_nombre: 'Persona Auditora', revisado_como_respaldo: 0 }),
      'Aprobado por Persona Auditora');
    assert.equal(contexto.textoRevisor({ estado: 'rechazado', revisor_nombre: 'Persona Editora', revisado_como_respaldo: 1 }),
      'Rechazado por Persona Editora (respaldo)');
  });
});

// Mi firma del personal contratado (usuarios.vinculo = 'contrato', pedido del usuario el 16/10/2026): una muestra de cómo sale
// en las notas, con el renglón "Personal contratado, cumpliendo funciones de" más chico entre el nombre y el cargo
describe('perfil.js: muestra de la firma del personal contratado', () => {
  const RENGLON = 'Personal contratado, cumpliendo funciones de';
  const renglones = (html) => [...html.matchAll(/<div class="(firma-muestra-[a-z]+)">([^<]*)<\/div>/g)].map(m => [m[1], m[2]]);
  const PAGINA = fs.readFileSync(new URL('../public/perfil.html', import.meta.url), 'utf8');
  const tamanoCss = (clase) => Number(PAGINA.match(new RegExp(`\\.${clase}\\s*\\{[^}]*font-size:\\s*([\\d.]+)rem`))?.[1]);

  it('contratado: "Así sale en las notas:" y los tres renglones, el del medio más chico, con los datos escapados', () => {
    const html = cargarPerfil().muestraDeFirma('Nombre <b>Apellido</b>', 'Cargo de Prueba', true);
    assert.ok(html.includes('Así sale en las notas:'));
    assert.deepEqual(renglones(html), [
      ['firma-muestra-renglon', 'Nombre &lt;b&gt;Apellido&lt;/b&gt;'], ['firma-muestra-chico', RENGLON], ['firma-muestra-renglon', 'Cargo de Prueba']
    ]);
    assert.ok(tamanoCss('firma-muestra-chico') < tamanoCss('firma-muestra-renglon'), 'el renglón del medio tiene que ser más chico');
  });

  it('sin contrato no hay muestra: la firma sale con el nombre y el cargo, como siempre', () => {
    assert.equal(cargarPerfil().muestraDeFirma('Nombre Apellido', 'Cargo de Prueba', false), '');
  });

  it('el renglón de la muestra es el de las notas', async () => {
    const { RENGLON_FIRMA_CONTRATADO } = await import('../services/notasDigitalesContenido.js');
    assert.equal(RENGLON_FIRMA_CONTRATADO, RENGLON);
    assert.equal(vm.runInContext('RENGLON_FIRMA_CONTRATADO', cargarPerfil()), RENGLON_FIRMA_CONTRATADO);
  });

  it('la muestra sale según el vínculo del perfil, con lo escrito en los campos de la firma', async () => {
    for (const [vinculo, visible] of [['contrato', true], ['planta_permanente', false], ['planta_politica', false], [null, false]]) {
      // (la muestra empieza al revés de como tiene que quedar)
      const elementos = {
        'firma-nombre': { value: ' Nombre Apellido ' }, 'firma-cargo': { value: 'Cargo de Prueba' }, 'firma-muestra': { innerHTML: 'anterior', hidden: visible }
      };
      const contexto = cargarPerfil({
        elementos, API: { getProfile: async () => ({ username: 'u', nombre_completo: 'Nombre', email: 'u@rpad.test', cargo: 'Cargo', vinculo }) }
      });
      await contexto.cargarPerfil();
      contexto.actualizarMuestraFirma();
      assert.equal(elementos['firma-muestra'].hidden, !visible, String(vinculo));
      assert.equal(elementos['firma-muestra'].innerHTML, visible ? contexto.muestraDeFirma('Nombre Apellido', 'Cargo de Prueba', true) : '', String(vinculo));
    }
  });

  it('el ejemplo del nombre para la firma ya no propone un título', () => {
    assert.ok(PAGINA.includes('id="firma-nombre" class="form-input" maxlength="150" placeholder="Ej.: Nombre Apellido"'));
    assert.ok(!PAGINA.includes('Téc.'));
    assert.ok(PAGINA.includes('<div id="firma-muestra" class="firma-muestra" hidden></div>'));
  });
});

// Gestión de cambios (spec 2026-10-16-perfil-pestanas-gestion-cambios): funciones puras que arman lo que se ve de un cambio
// propuesto. Los arreglos y objetos vienen de otro contexto vm: se comparan pasados por JSON.
const plano = (valor) => JSON.parse(JSON.stringify(valor));

describe('perfil.js: etiquetas y valores para mostrar', () => {
  it('etiquetas con tilde y valores para mostrar', () => {
    const contexto = cargarPerfil();
    assert.equal(contexto.etiquetaDeCampo('Proxima Actualizacion'), 'Próxima actualización');
    assert.equal(contexto.etiquetaDeCampo('URL en Portal'), 'URL en el portal');
    assert.equal(contexto.etiquetaDeCampo('Frecuencia'), 'Frecuencia');
    assert.equal(contexto.etiquetaDeCampo('constructor'), 'constructor');
    assert.equal(contexto.textoDeValor('-'), '');
    assert.equal(contexto.textoDeValor(null), '');
    assert.equal(contexto.textoDeValor(undefined), '');
    assert.equal(contexto.textoDeValor(''), '');
    assert.equal(contexto.textoDeValor('2026-07-31T03:00:00.000Z'), '31/07/2026');
    assert.equal(contexto.textoDeValor('2026-07-31'), '31/07/2026');
    assert.equal(contexto.textoDeValor('Anualmente'), 'Anualmente');
    assert.equal(contexto.textoDeValor(['CSV', 'JSON']), 'CSV, JSON');
  });

  it('las etiquetas del servidor que se comparan palabra por palabra', () => {
    const contexto = cargarPerfil();
    assert.deepEqual(plano(vm.runInContext('CAMPOS_LARGOS', contexto)), ['Descripcion', 'Observaciones', 'Qué se solicita']);
  });
});

describe('perfil.js: comparación palabra por palabra', () => {
  const contexto = cargarPerfil();
  const diff = (antes, despues) => plano(contexto.diffPalabras(antes, despues));

  it('una palabra cambiada, una agregada, una quitada', () => {
    assert.deepEqual(diff('a b c', 'a x c'), [{ tipo: '=', texto: 'a ' }, { tipo: '-', texto: 'b' }, { tipo: '+', texto: 'x' }, { tipo: '=', texto: ' c' }]);
    assert.deepEqual(diff('uno dos', 'uno dos tres'), [{ tipo: '=', texto: 'uno dos' }, { tipo: '+', texto: ' tres' }]);
    assert.deepEqual(diff('uno dos tres', 'uno tres'), [{ tipo: '=', texto: 'uno ' }, { tipo: '-', texto: 'dos ' }, { tipo: '=', texto: 'tres' }]);
  });

  it('un lado vacío devuelve solo el otro; los dos vacíos, nada', () => {
    assert.deepEqual(diff('', 'texto nuevo'), [{ tipo: '+', texto: 'texto nuevo' }]);
    assert.deepEqual(diff('viejo', ''), [{ tipo: '-', texto: 'viejo' }]);
    assert.deepEqual(diff('', ''), []);
    assert.deepEqual(diff(null, undefined), []);
  });

  it('la puntuación no se pega a la palabra', () => {
    const segmentos = diff('corte semestral.', 'corte trimestral.');
    assert.ok(segmentos.some(s => s.tipo === '-' && s.texto === 'semestral'));
    assert.ok(segmentos.some(s => s.tipo === '+' && s.texto === 'trimestral'));
    assert.deepEqual(segmentos.at(-1), { tipo: '=', texto: '.' });
  });

  it('un texto idéntico sale entero como igual', () => {
    assert.deepEqual(diff('mismo texto, igual.', 'mismo texto, igual.'), [{ tipo: '=', texto: 'mismo texto, igual.' }]);
  });

  it('texto enorme: no calcula, devuelve todo quitado y todo agregado, y rápido', () => {
    const antes = Array.from({ length: 3000 }, (_, i) => `viejo${i}`).join(' ');
    const despues = Array.from({ length: 3000 }, (_, i) => `nuevo${i}`).join(' ');
    const desde = Date.now();
    const segmentos = diff(antes, despues);
    assert.ok(Date.now() - desde < 500);
    assert.deepEqual(segmentos, [{ tipo: '-', texto: antes }, { tipo: '+', texto: despues }]);
  });

  it('htmlDeDiff: lo igual tal cual, lo quitado en <del>, lo agregado en <ins>, todo escapado', () => {
    assert.equal(
      contexto.htmlDeDiff([{ tipo: '=', texto: 'a <b> ' }, { tipo: '-', texto: 'x' }, { tipo: '+', texto: 'y' }]),
      'a &lt;b&gt; <del>x</del><ins>y</ins>'
    );
    assert.equal(contexto.htmlDeDiff([{ tipo: '-', texto: '<i>' }, { tipo: '+', texto: '&' }]), '<del>&lt;i&gt;</del><ins>&amp;</ins>');
    assert.equal(contexto.htmlDeDiff([]), '');
  });
});

describe('perfil.js: nombres y título de un cambio', () => {
  it('listaDeNombres: "A", "A y B", "A, B y C"', () => {
    const contexto = cargarPerfil();
    assert.equal(contexto.listaDeNombres([]), '');
    assert.equal(contexto.listaDeNombres(['A']), 'A');
    assert.equal(contexto.listaDeNombres(['A', 'B']), 'A y B');
    assert.equal(contexto.listaDeNombres(['A', 'B', 'C']), 'A, B y C');
    assert.equal(contexto.listaDeNombres(['A', 'B', 'C', 'D']), 'A, B, C y D');
  });

  it('tituloDelCambio: en crear el del dataset nuevo; si no, el del dataset, el anterior, el nuevo, o "Dataset"', () => {
    const contexto = cargarPerfil();
    assert.equal(contexto.tituloDelCambio({ tipo_cambio: 'crear', datos_nuevos: { titulo: 'Nuevo' }, dataset_titulo: 'Otro' }), 'Nuevo');
    assert.equal(contexto.tituloDelCambio({ tipo_cambio: 'crear', datos_nuevos: {} }), 'Dataset');
    assert.equal(contexto.tituloDelCambio({ tipo_cambio: 'editar', dataset_titulo: 'Actual', datos_nuevos: { titulo: 'Renombrado' } }), 'Actual');
    assert.equal(contexto.tituloDelCambio({ tipo_cambio: 'eliminar', dataset_titulo: null, datos_anteriores: { titulo: 'Anterior' } }), 'Anterior');
    assert.equal(contexto.tituloDelCambio({ tipo_cambio: 'editar', datos_nuevos: { titulo: 'Nuevo' } }), 'Nuevo');
    assert.equal(contexto.tituloDelCambio({ tipo_cambio: 'editar' }), 'Dataset');
  });
});

describe('perfil.js: resumen de la fila cerrada', () => {
  const resumen = (cambio) => cargarPerfil().resumenDelCambio(cambio);
  const editar = (campos) => ({ tipo_cambio: 'editar', campos_modificados: campos });
  const FRECUENCIA = { campo: 'Frecuencia', antes: 'Anualmente', despues: 'Cada medio año' };

  it('un campo corto: "campo de A a B"', () => {
    assert.equal(resumen(editar([FRECUENCIA])), '<b>Frecuencia</b> de Anualmente a Cada medio año');
  });

  it('con más campos, suma ", y N campo(s) más"', () => {
    const otro = { campo: 'Tipo de Gestion', antes: 'interna', despues: 'externa' };
    assert.ok(resumen(editar([FRECUENCIA, otro])).endsWith(', y 1 campo más'));
    assert.ok(resumen(editar([FRECUENCIA, otro, otro])).endsWith(', y 2 campos más'));
  });

  it('los campos largos y los dos primeros nombres: "Cambia …"', () => {
    const descripcion = { campo: 'Descripcion', antes: 'a', despues: 'b' };
    const observaciones = { campo: 'Observaciones', antes: '-', despues: 'c' };
    assert.equal(resumen(editar([descripcion, observaciones])), 'Cambia <b>Descripción</b> y <b>Observaciones</b>');
    assert.equal(resumen(editar([descripcion])), 'Cambia <b>Descripción</b>');
    assert.equal(resumen(editar([descripcion, observaciones, { campo: 'Titulo', antes: 'a', despues: 'b' }])),
      'Cambia <b>Descripción</b>, <b>Observaciones</b> y 1 más');
    assert.equal(resumen(editar([descripcion, observaciones, { campo: 'Titulo', antes: 'a', despues: 'b' }, FRECUENCIA])),
      'Cambia <b>Descripción</b>, <b>Observaciones</b> y 2 más');
  });

  it('las fechas salen como dd/mm/aaaa y el valor vacío como "vacío"', () => {
    assert.equal(resumen(editar([{ campo: 'Proxima Actualizacion', antes: '2026-07-31T03:00:00.000Z', despues: '2027-01-31' }])),
      '<b>Próxima actualización</b> de 31/07/2026 a 31/01/2027');
    assert.equal(resumen(editar([{ campo: 'Tema Secundario', antes: '-', despues: 'Salud' }])), '<b>Tema secundario</b> de vacío a Salud');
    assert.equal(resumen(editar([{ campo: 'Tema Secundario', antes: 'Salud', despues: '-' }])), '<b>Tema secundario</b> de Salud a vacío');
  });

  it('un valor de más de 40 caracteres pasa al formato "Cambia …"; con 40 justos, no', () => {
    assert.equal(resumen(editar([{ campo: 'Tema Principal', antes: 'x'.repeat(41), despues: 'b' }])), 'Cambia <b>Tema principal</b>');
    assert.equal(resumen(editar([{ campo: 'Tema Principal', antes: 'b', despues: 'x'.repeat(41) }])), 'Cambia <b>Tema principal</b>');
    assert.equal(resumen(editar([{ campo: 'Tema Principal', antes: 'x'.repeat(40), despues: 'b' }])), `<b>Tema principal</b> de ${'x'.repeat(40)} a b`);
  });

  it('escapa los valores', () => {
    const html = resumen(editar([{ campo: 'Titulo', antes: '<i>a</i>', despues: 'b' }]));
    assert.ok(html.includes('&lt;i&gt;a&lt;/i&gt;'));
    assert.ok(!html.includes('<i>'));
  });

  it('una edición sin campos: "Sin cambios en los campos principales"', () => {
    assert.equal(resumen(editar([])), 'Sin cambios en los campos principales');
    assert.equal(resumen(editar(null)), 'Sin cambios en los campos principales');
    assert.equal(resumen({ tipo_cambio: 'editar' }), 'Sin cambios en los campos principales');
  });

  it('crear: "Dataset nuevo de {área}, {frecuencia en minúscula}", con lo que haya, escapado', () => {
    assert.equal(resumen({ tipo_cambio: 'crear', datos_nuevos: { area_nombre: 'Ambiente', frecuencia_nombre: 'Anualmente' } }), 'Dataset nuevo de Ambiente, anualmente');
    assert.equal(resumen({ tipo_cambio: 'crear', datos_nuevos: { area_nombre: 'Ambiente' } }), 'Dataset nuevo de Ambiente');
    assert.equal(resumen({ tipo_cambio: 'crear', datos_nuevos: { frecuencia_nombre: 'Anualmente' } }), 'Dataset nuevo, anualmente');
    assert.equal(resumen({ tipo_cambio: 'crear', datos_nuevos: {} }), 'Dataset nuevo');
    assert.equal(resumen({ tipo_cambio: 'crear' }), 'Dataset nuevo');
    assert.equal(resumen({ tipo_cambio: 'crear', datos_nuevos: { area_nombre: '<b>X</b>' } }), 'Dataset nuevo de &lt;b&gt;X&lt;/b&gt;');
  });

  it('eliminar: "Se quita del registro"', () => {
    assert.equal(resumen({ tipo_cambio: 'eliminar' }), 'Se quita del registro');
  });
});

describe('perfil.js: marca del editor', () => {
  const marca = (auditoria, esEditor = true, estado = 'pendiente') => cargarPerfil().marcaDeAuditoria({ estado, auditoria }, esEditor);

  it('si puede auditarlo de respaldo, lo dice con el escudo', () => {
    const html = marca({ puede: true, respaldo: true, auditan: [] });
    assert.ok(html.includes('Podés auditarlo de respaldo'));
    assert.ok(html.includes('pf-marca pf-marca-respaldo'));
    assert.ok(html.includes('<svg'));
  });

  it('si no puede, dice quiénes lo auditan, con los nombres escapados', () => {
    const html = marca({ puede: false, respaldo: false, auditan: ['Ana', 'Pablo', 'Laura'] });
    assert.ok(html.includes('Lo auditan Ana, Pablo y Laura'));
    assert.ok(html.includes('class="pf-marca"'));
    assert.ok(!html.includes('pf-marca-respaldo'));
    assert.ok(marca({ puede: false, respaldo: false, auditan: ['<b>Ana</b>'] }).includes('Lo auditan &lt;b&gt;Ana&lt;/b&gt;'));
  });

  it('sin ser editor, sin auditoría, ya resuelto o sin nadie que nombrar, no hay marca', () => {
    assert.equal(marca({ puede: true, respaldo: true, auditan: [] }, false), '');
    assert.equal(marca(undefined), '');
    assert.equal(marca({ puede: true, respaldo: true, auditan: [] }, true, 'aprobado'), '');
    assert.equal(marca({ puede: true, respaldo: true, auditan: [] }, true, 'rechazado'), '');
    assert.equal(marca({ puede: false, respaldo: false, auditan: [] }), '');
  });
});

describe('perfil.js: pestaña inicial y demora', () => {
  it('pestaña inicial según rol y hash', () => {
    const { pestanaInicial } = cargarPerfil();
    assert.equal(pestanaInicial('', true), 'para-revisar');
    assert.equal(pestanaInicial('#mis-cambios', true), 'mis-cambios');
    assert.equal(pestanaInicial('mi-firma', true), 'mi-firma');
    assert.equal(pestanaInicial('#mis-datos', true), 'mis-datos');
    assert.equal(pestanaInicial('#cualquiera', true), 'para-revisar');
    assert.equal(pestanaInicial(undefined, true), 'para-revisar');
    assert.equal(pestanaInicial('', false), 'mis-datos');
    assert.equal(pestanaInicial('#para-revisar', false), 'mis-datos');
    assert.equal(pestanaInicial('#mis-cambios', false), 'mis-datos');
    assert.equal(pestanaInicial('#mi-firma', false), 'mis-datos');
  });

  it('demora: más de 2 días', () => {
    const { estaDemorado } = cargarPerfil();
    const ahora = Date.parse('2026-10-16T12:00:00Z');
    assert.equal(estaDemorado('2026-10-14T11:00:00Z', ahora), true);
    assert.equal(estaDemorado('2026-10-15T12:00:00Z', ahora), false);
    assert.equal(estaDemorado('2026-10-14T12:00:00Z', ahora), false, 'justo 2 días no es más de 2 días');
    assert.equal(estaDemorado('no es una fecha', ahora), false);
    assert.equal(estaDemorado(undefined, ahora), false);
    assert.equal(estaDemorado('2020-01-01'), true, 'sin "ahora" usa la hora actual');
  });
});
