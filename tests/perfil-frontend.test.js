// Mi Perfil (public/js/perfil.js), ejecutado en Node: los botones de aprobar y rechazar según quién puede auditar el
// cambio, y quién lo auditó (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const escaparHtml = (texto) => String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// elementos: los del DOM que mira el test (los demás son objetos vacíos); API: la de la página; globales: lo que el test agrega
// al contexto (el archivo, al cargarse, no usa window, location, history ni localStorage: son del navegador)
const cargarPerfil = ({ elementos = {}, API = {}, globales = {} } = {}) => {
  const contexto = vm.createContext({
    document: { addEventListener() {}, getElementById: (id) => elementos[id] ?? { style: {} } },
    Utils: { escapeHtml: escaparHtml, textoCargo: (cargo) => cargo ?? '', textoVinculo: (vinculo) => vinculo ?? '', showError: (m) => { throw new Error(m); },
      safeUrl: (u) => /^https?:\/\//.test(u ?? '') ? u : null },
    Auth: {}, API, CONFIG: {}, console, ...globales
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

  it('un texto largo con una sola palabra cambiada: recorta lo común del principio y del final y marca solo esa palabra', () => {
    const palabras = (cambiada) => Array.from({ length: 600 }, (_, i) => (i + 1 === 300 && cambiada ? 'cambiada' : `palabra${i + 1}`)).join(' ');
    const antes = palabras(false);
    const despues = palabras(true);
    const desde = Date.now();
    const segmentos = diff(antes, despues);
    assert.ok(Date.now() - desde < 500);
    assert.deepEqual(segmentos.filter(s => s.tipo === '-'), [{ tipo: '-', texto: 'palabra300' }]);
    assert.deepEqual(segmentos.filter(s => s.tipo === '+'), [{ tipo: '+', texto: 'cambiada' }]);
    assert.deepEqual(segmentos.map(s => s.tipo), ['=', '-', '+', '=']);
    assert.ok(segmentos[0].texto.startsWith('palabra1 palabra2 ') && segmentos[0].texto.endsWith(' palabra299 '));
    assert.ok(segmentos[3].texto.startsWith(' palabra301 ') && segmentos[3].texto.endsWith(' palabra600'));
    // Quitado + igual reconstruye el texto de antes; agregado + igual, el de después
    assert.equal(segmentos.filter(s => s.tipo !== '+').map(s => s.texto).join(''), antes);
    assert.equal(segmentos.filter(s => s.tipo !== '-').map(s => s.texto).join(''), despues);
  });

  it('lo común del principio y del final se recorta aunque el medio sea enorme: el tope se aplica solo al medio', () => {
    const medio = (prefijo) => Array.from({ length: 3000 }, (_, i) => `${prefijo}${i}`).join(' ');
    const antes = `Inicio igual ${medio('viejo')} final igual.`;
    const despues = `Inicio igual ${medio('nuevo')} final igual.`;
    assert.deepEqual(diff(antes, despues), [
      { tipo: '=', texto: 'Inicio igual ' }, { tipo: '-', texto: medio('viejo') }, { tipo: '+', texto: medio('nuevo') }, { tipo: '=', texto: ' final igual.' }
    ]);
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

// Mi Perfil en pestañas (spec 2026-10-16-perfil-pestanas-gestion-cambios): la estructura de la página
describe('perfil.html: pestañas', () => {
  const PAGINA = fs.readFileSync(new URL('../public/perfil.html', import.meta.url), 'utf8');
  const NOMBRES = ['para-revisar', 'mis-cambios', 'mis-datos', 'mi-firma'];
  // La etiqueta de apertura del elemento con ese id
  const etiqueta = (id) => PAGINA.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  const posicion = (texto) => PAGINA.indexOf(texto);

  it('hay una barra de pestañas (tablist) debajo de los mensajes', () => {
    assert.ok(PAGINA.includes('role="tablist"'));
    assert.ok(posicion('role="tablist"') > posicion('id="message-container"'), 'la barra va después de #message-container');
    const barra = etiqueta('pestanas-perfil');
    assert.match(barra, /class="pf-pestanas"/);
    assert.match(barra, /role="tablist"/);
    assert.match(barra, /aria-label="Secciones de Mi Perfil"/);
    assert.match(barra, /\bhidden\b/, 'arranca oculta: solo la muestra quien administra');
  });

  for (const n of NOMBRES) {
    it(`${n}: una pestaña (botón) y su panel enlazados`, () => {
      const pestana = etiqueta(`pestana-${n}`);
      assert.match(pestana, /^<button\b/);
      assert.match(pestana, /type="button"/);
      assert.match(pestana, /role="tab"/);
      assert.match(pestana, new RegExp(`aria-controls="vista-${n}"`));
      assert.match(pestana, new RegExp(`data-vista="${n}"`));
      assert.match(pestana, /aria-selected="false"/);
      assert.match(pestana, /tabindex="-1"/);
      const panel = etiqueta(`vista-${n}`);
      assert.match(panel, /role="tabpanel"/);
      assert.match(panel, new RegExp(`aria-labelledby="pestana-${n}"`));
      assert.match(panel, /\bhidden\b/);
    });
  }

  it('las pestañas van en este orden: Para revisar, Mis cambios, Mis datos y Mi firma', () => {
    const lugares = NOMBRES.map(n => posicion(`id="pestana-${n}"`));
    assert.ok(lugares.every(lugar => lugar > 0));
    assert.deepEqual([...lugares].sort((a, b) => a - b), lugares);
  });

  it('Para revisar y Mis cambios traen su cuenta, oculta mientras no hay cambios', () => {
    for (const n of ['para-revisar', 'mis-cambios']) {
      const cuenta = etiqueta(`cuenta-${n}`);
      assert.match(cuenta, /class="pf-cuenta"/, n);
      assert.match(cuenta, /\bhidden\b/, n);
      assert.ok(posicion(`id="cuenta-${n}"`) > posicion(`id="pestana-${n}"`), n);
    }
  });

  it('ya no están las pestañas internas ni la tarjeta de Gestión de Cambios', () => {
    assert.ok(!PAGINA.includes('class="tab-btn'));
    assert.ok(!PAGINA.includes('id="seccion-cambios"'));
    assert.ok(!PAGINA.includes('badge-para-revisar') && !PAGINA.includes('badge-mis-cambios'));
    assert.ok(!PAGINA.includes('class="tab-content'));
  });

  it('cada panel tiene lo suyo: las listas de cambios y los formularios de siempre', () => {
    const [revisar, cambios, datos, firma] = NOMBRES.map(n => posicion(`id="vista-${n}"`));
    const dentro = (id, desde, hasta) => posicion(`id="${id}"`) > desde && posicion(`id="${id}"`) < hasta;
    assert.ok(dentro('filtro-revisar-tipo', revisar, cambios) && dentro('lista-para-revisar', revisar, cambios));
    assert.ok(dentro('filtro-mis-estado', cambios, datos) && dentro('lista-mis-cambios', cambios, datos));
    for (const id of ['form-perfil', 'perfil-username', 'perfil-nombre', 'perfil-email', 'btn-guardar-perfil', 'form-password', 'password-actual',
      'password-nueva', 'password-confirmar', 'btn-cambiar-password']) {
      assert.ok(dentro(id, datos, firma), `${id} va en Mis datos`);
    }
    for (const id of ['form-firma', 'firma-nombre', 'firma-cargo', 'firma-archivo', 'firma-vista', 'firma-muestra', 'firma-estado', 'btn-guardar-firma']) {
      assert.ok(posicion(`id="${id}"`) > firma, `${id} va en Mi firma`);
    }
  });

  it('Mis datos: las ayudas de las tarjetas, y las tarjetas en dos columnas que pasan a una en 760 px', () => {
    assert.ok(PAGINA.includes('Tu nombre y email aparecen en los avisos y en el historial de cambios.'));
    assert.ok(PAGINA.includes('Al cambiarla se cierran tus otras sesiones abiertas.'));
    assert.match(PAGINA, /\.pf-tarjetas\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
    assert.match(PAGINA, /@media \(max-width: 760px\)\s*\{[^@]*\.pf-tarjetas\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('los estilos nuevos: contenido más angosto, barra que se desplaza, mensajes y movimiento reducido', () => {
    assert.match(PAGINA, /\.main-content\s*\{\s*max-width:\s*1120px;\s*min-width:\s*0;\s*\}/);
    assert.match(PAGINA, /\.pf-pestanas\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(PAGINA, /\.pf-pestana\.activa\s*\{[^}]*border-bottom-color:\s*var\(--primary\)/);
    assert.match(PAGINA, /\.pf-pestana:focus-visible/);
    assert.match(PAGINA, /\.alert-success\s*\{[^}]*#EAF6EF[^}]*#C7E6D3[^}]*#2E6B4C/i);
    assert.match(PAGINA, /\.alert-error\s*\{[^}]*#FBEEEE[^}]*#EFCACA[^}]*#8A3434/i);
    assert.match(PAGINA, /@media \(prefers-reduced-motion: reduce\)/);
  });
});

// Las pestañas por dentro: elementos falsos que guardan lo que el script les hace
describe('perfil.js: cambiar de pestaña', () => {
  const NOMBRES = ['para-revisar', 'mis-cambios', 'mis-datos', 'mi-firma'];
  const armar = () => {
    const elementos = {};
    const estado = { enfocada: null, historial: [] };
    for (const n of NOMBRES) {
      const clases = new Set();
      elementos[`pestana-${n}`] = {
        dataset: { vista: n }, attrs: {}, tabIndex: 0, clases,
        setAttribute(nombre, valor) { this.attrs[nombre] = valor; },
        classList: { toggle: (clase, activa) => (activa ? clases.add(clase) : clases.delete(clase)) },
        focus() { estado.enfocada = n; }
      };
      elementos[`vista-${n}`] = { hidden: true };
    }
    const globales = { history: { replaceState: (...argumentos) => estado.historial.push(argumentos) } };
    return { elementos, estado, contexto: cargarPerfil({ elementos, globales }) };
  };
  const activas = (elementos) => NOMBRES.filter(n => elementos[`pestana-${n}`].attrs['aria-selected'] === 'true');

  it('mostrarPestana: activa la pestaña, muestra su panel, oculta los demás y deja el hash', () => {
    const { elementos, estado, contexto } = armar();
    contexto.mostrarPestana('mis-datos');
    assert.deepEqual(activas(elementos), ['mis-datos']);
    for (const n of NOMBRES) {
      const activa = n === 'mis-datos';
      const pestana = elementos[`pestana-${n}`];
      assert.equal(pestana.attrs['aria-selected'], String(activa), n);
      assert.equal(pestana.tabIndex, activa ? 0 : -1, n);
      assert.equal(pestana.clases.has('activa'), activa, n);
      assert.equal(elementos[`vista-${n}`].hidden, !activa, n);
    }
    assert.deepEqual(plano(estado.historial), [[null, '', '#mis-datos']]);
    // Cambiar a otra deja una sola activa
    contexto.mostrarPestana('para-revisar');
    assert.deepEqual(activas(elementos), ['para-revisar']);
    assert.deepEqual(NOMBRES.filter(n => !elementos[`vista-${n}`].hidden), ['para-revisar']);
    assert.deepEqual(plano(estado.historial.at(-1)), [null, '', '#para-revisar']);
  });

  describe('teclado en la barra', () => {
    const teclear = (desde, key) => {
      const { elementos, estado, contexto } = armar();
      contexto.mostrarPestana(desde);
      let frenada = false;
      contexto.teclaEnPestanas({ key, target: elementos[`pestana-${desde}`], preventDefault() { frenada = true; } });
      return { elementos, estado, frenada };
    };

    it('flecha derecha e izquierda mueven el foco y activan, y dan la vuelta', () => {
      for (const [desde, key, hacia] of [
        ['para-revisar', 'ArrowRight', 'mis-cambios'], ['mis-cambios', 'ArrowRight', 'mis-datos'], ['mi-firma', 'ArrowRight', 'para-revisar'],
        ['mis-datos', 'ArrowLeft', 'mis-cambios'], ['para-revisar', 'ArrowLeft', 'mi-firma']
      ]) {
        const { elementos, estado, frenada } = teclear(desde, key);
        assert.deepEqual(activas(elementos), [hacia], `${desde} ${key}`);
        assert.equal(estado.enfocada, hacia, `${desde} ${key}`);
        assert.equal(elementos[`pestana-${hacia}`].tabIndex, 0);
        assert.equal(frenada, true, 'no desplaza la página');
      }
    });

    it('inicio va a la primera y fin a la última', () => {
      for (const [desde, key, hacia] of [['mis-datos', 'Home', 'para-revisar'], ['mis-datos', 'End', 'mi-firma']]) {
        const { elementos, estado, frenada } = teclear(desde, key);
        assert.deepEqual(activas(elementos), [hacia], key);
        assert.equal(estado.enfocada, hacia, key);
        assert.equal(frenada, true, key);
      }
    });

    it('cualquier otra tecla no hace nada', () => {
      for (const key of ['Enter', 'Tab', 'a', 'ArrowDown']) {
        const { elementos, estado, frenada } = teclear('mis-datos', key);
        assert.deepEqual(activas(elementos), ['mis-datos'], key);
        assert.equal(estado.enfocada, null, key);
        assert.equal(frenada, false, key);
      }
    });
  });

  it('la cuenta de una pestaña: con cambios muestra el número; sin cambios queda oculta y vacía', () => {
    const cuenta = { textContent: '', hidden: true };
    const contexto = cargarPerfil({ elementos: { 'cuenta-para-revisar': cuenta } });
    contexto.mostrarCuenta('cuenta-para-revisar', 3);
    assert.equal(cuenta.textContent, '3');
    assert.equal(cuenta.hidden, false);
    contexto.mostrarCuenta('cuenta-para-revisar', 0);
    assert.equal(cuenta.textContent, '');
    assert.equal(cuenta.hidden, true);
  });

  it('actualizarBadges escribe en las cuentas de las pestañas (Para revisar y Mis cambios pendientes)', async () => {
    const elementos = { 'cuenta-para-revisar': { textContent: '', hidden: true }, 'cuenta-mis-cambios': { textContent: '', hidden: true } };
    const API = { getContadorPendientes: async () => ({ cantidad: 4 }), getMisCambios: async () => [{}, {}] };
    await cargarPerfil({ elementos, API }).actualizarBadges();
    assert.equal(elementos['cuenta-para-revisar'].textContent, '4');
    assert.equal(elementos['cuenta-para-revisar'].hidden, false);
    assert.equal(elementos['cuenta-mis-cambios'].textContent, '2');
    assert.equal(elementos['cuenta-mis-cambios'].hidden, false);
  });
});
