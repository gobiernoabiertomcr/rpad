// Mi Perfil (public/js/perfil.js), ejecutado en Node: los botones de aprobar y rechazar según quién puede auditar el
// cambio, y quién lo auditó (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.2)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const escaparHtml = (texto) => String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// dd/mm/aaaa en UTC, para que los tests no dependan de la zona horaria de la máquina
const fechaUtc = (valor) => {
  const fecha = new Date(valor);
  return `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}/${fecha.getUTCFullYear()}`;
};
// elementos: los del DOM que mira el test (los demás son objetos vacíos); API: la de la página; globales: lo que el test agrega
// al contexto (el archivo, al cargarse, no usa window, location, history ni localStorage: son del navegador)
const cargarPerfil = ({ elementos = {}, API = {}, globales = {} } = {}) => {
  const contexto = vm.createContext({
    document: { addEventListener() {}, getElementById: (id) => elementos[id] ?? { style: {} } },
    Utils: { escapeHtml: escaparHtml, textoCargo: (cargo) => cargo ?? '', textoVinculo: (vinculo) => vinculo ?? '', showError: (m) => { throw new Error(m); },
      safeUrl: (u) => /^https?:\/\//.test(u ?? '') ? u : null, formatDate: fechaUtc },
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

// Mi firma: la vista previa "Así sale en las notas", para todos (pedido del usuario el 16/10/2026), armada como la firma del
// PDF: la imagen, el nombre y el cargo; el personal contratado (usuarios.vinculo = 'contrato') lleva entre los dos el renglón
// "Personal contratado, cumpliendo funciones de", más chico
describe('perfil.js: vista previa de la firma', () => {
  const RENGLON = 'Personal contratado, cumpliendo funciones de';
  const renglones = (html) => [...html.matchAll(/<div class="(firma-muestra-[a-z]+)">([^<]*)<\/div>/g)].map(m => [m[1], m[2]]);
  const PAGINA = fs.readFileSync(new URL('../public/perfil.html', import.meta.url), 'utf8');
  const tamanoCss = (clase) => Number(PAGINA.match(new RegExp(`\\.${clase}\\s*\\{[^}]*font-size:\\s*([\\d.]+)rem`))?.[1]);

  it('contratado: los tres renglones, el del medio más chico, con los datos escapados', () => {
    const html = cargarPerfil().muestraDeFirma('Nombre <b>Apellido</b>', 'Cargo de Prueba', true);
    assert.deepEqual(renglones(html), [
      ['firma-muestra-renglon', 'Nombre &lt;b&gt;Apellido&lt;/b&gt;'], ['firma-muestra-chico', RENGLON], ['firma-muestra-renglon', 'Cargo de Prueba']
    ]);
    assert.ok(tamanoCss('firma-muestra-chico') < tamanoCss('firma-muestra-renglon'), 'el renglón del medio tiene que ser más chico');
  });

  it('sin contrato: el nombre y el cargo, como sale en las notas', () => {
    assert.deepEqual(renglones(cargarPerfil().muestraDeFirma('Nombre Apellido', 'Cargo <i>x</i>', false)), [
      ['firma-muestra-renglon', 'Nombre Apellido'], ['firma-muestra-renglon', 'Cargo &lt;i&gt;x&lt;/i&gt;']
    ]);
  });

  it('sin nombre ni cargo no hay nada que mostrar', () => {
    assert.equal(cargarPerfil().muestraDeFirma('', '', false), '');
    assert.equal(cargarPerfil().muestraDeFirma('', '', true), '');
  });

  it('el renglón de la muestra es el de las notas', async () => {
    const { RENGLON_FIRMA_CONTRATADO } = await import('../services/notasDigitalesContenido.js');
    assert.equal(RENGLON_FIRMA_CONTRATADO, RENGLON);
    assert.equal(vm.runInContext('RENGLON_FIRMA_CONTRATADO', cargarPerfil()), RENGLON_FIRMA_CONTRATADO);
  });

  it('la vista previa sale para todos, según el vínculo del perfil y con lo escrito en los campos de la firma', async () => {
    for (const vinculo of ['contrato', 'planta_permanente', 'planta_politica', null]) {
      const elementos = {
        'firma-nombre': { value: ' Nombre Apellido ' }, 'firma-cargo': { value: 'Cargo de Prueba' }, 'firma-muestra': { innerHTML: 'anterior', hidden: true }
      };
      const contexto = cargarPerfil({
        elementos, API: { getProfile: async () => ({ username: 'u', nombre_completo: 'Nombre', email: 'u@rpad.test', cargo: 'Cargo', vinculo }) }
      });
      await contexto.cargarPerfil();
      contexto.actualizarMuestraFirma();
      assert.equal(elementos['firma-muestra'].hidden, false, String(vinculo));
      assert.equal(elementos['firma-muestra'].innerHTML, contexto.muestraDeFirma('Nombre Apellido', 'Cargo de Prueba', vinculo === 'contrato'), String(vinculo));
    }
    // Con los dos campos vacíos, la muestra se oculta
    const vacios = { 'firma-nombre': { value: ' ' }, 'firma-cargo': { value: '' }, 'firma-muestra': { innerHTML: 'anterior', hidden: false } };
    const contexto = cargarPerfil({ elementos: vacios });
    contexto.actualizarMuestraFirma();
    assert.equal(vacios['firma-muestra'].hidden, true);
    assert.equal(vacios['firma-muestra'].innerHTML, '');
  });

  it('la página: el formulario a la izquierda y la vista previa con la imagen a la derecha', () => {
    assert.ok(PAGINA.includes('id="firma-nombre" class="form-input" maxlength="150" placeholder="Ej.: Nombre Apellido"'));
    assert.ok(!PAGINA.includes('Téc.'));
    assert.ok(PAGINA.includes('<div id="firma-muestra" class="firma-muestra" hidden></div>'));
    const panel = PAGINA.slice(PAGINA.indexOf('id="vista-mi-firma"'), PAGINA.indexOf('</section>', PAGINA.indexOf('id="vista-mi-firma"')));
    const previa = panel.indexOf('Así sale en las notas');
    assert.ok(previa > panel.indexOf('id="btn-guardar-firma"'), 'la vista previa va después del formulario');
    assert.ok(panel.indexOf('id="firma-vista"') > previa && panel.indexOf('id="firma-muestra"') > panel.indexOf('id="firma-vista"'),
      'en la vista previa, la imagen va arriba del nombre y el cargo');
    assert.ok(panel.indexOf('id="firma-sin-imagen"') > previa);
  });

  it('el nombre y el cargo se centran en el ancho de la firma del PDF (200 pt ≈ 267 px): un cargo largo se parte igual', () => {
    assert.match(PAGINA, /\.firma-muestra\s*\{[^}]*max-width:\s*267px;[^}]*margin:\s*0 auto/);
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

  // Cada bloque de cambio es un solo quitado seguido de un solo agregado: nunca dos cambios separados solo por espacios, ni
  // un agregado antes de un quitado. Y lo quitado + lo igual reconstruye el texto de antes; lo agregado + lo igual, el de después.
  const comprobarBloques = (segmentos, antes, despues) => {
    segmentos.forEach((segmento, i) => {
      const [anterior, siguiente] = [segmentos[i - 1], segmentos[i + 1]];
      if (segmento.tipo === '=' && /^\s+$/.test(segmento.texto)) {
        assert.ok(!(anterior && anterior.tipo !== '=' && siguiente && siguiente.tipo !== '='), `espacios entre dos cambios: ${JSON.stringify(segmentos)}`);
      }
      if (segmento.tipo === '+') assert.notEqual(siguiente?.tipo, '-', `un agregado antes de un quitado: ${JSON.stringify(segmentos)}`);
      if (segmento.tipo !== '=') assert.notEqual(siguiente?.tipo, segmento.tipo, `dos segmentos seguidos del mismo tipo: ${JSON.stringify(segmentos)}`);
    });
    assert.equal(segmentos.filter(s => s.tipo !== '+').map(s => s.texto).join(''), antes);
    assert.equal(segmentos.filter(s => s.tipo !== '-').map(s => s.texto).join(''), despues);
  };

  it('varias palabras cambiadas no alternan palabra por palabra: los espacios entre cambios se suman al cambio', () => {
    const segmentos = diff('Datos de los locales', 'Listado actualizado de locales');
    assert.deepEqual(segmentos, [{ tipo: '-', texto: 'Datos de los' }, { tipo: '+', texto: 'Listado actualizado de' }, { tipo: '=', texto: ' locales' }]);
    comprobarBloques(segmentos, 'Datos de los locales', 'Listado actualizado de locales');
  });

  it('la limpieza de los espacios vale para cualquier par de textos y no toca lo que ya era legible', () => {
    for (const [antes, despues] of [
      ['Datos de los locales', 'Listado actualizado de locales'],
      ['El censo de árboles del año 2024 en la zona norte.', 'El relevamiento de arbolado del año 2025 en la zona sur.'],
      ['uno dos tres cuatro', 'cinco seis siete ocho'],
      ['Se publica cada mes, con corte semestral.', 'Se publica cada tres meses; corte trimestral y anual.'],
      ['a b c', 'a x c'], ['', 'texto nuevo'], ['viejo', ''], ['mismo texto', 'mismo texto']
    ]) {
      comprobarBloques(diff(antes, despues), antes, despues);
    }
    // Un igual de espacios con un cambio de un solo lado (al principio o al final) queda como igual
    assert.deepEqual(diff(' x', ' y'), [{ tipo: '=', texto: ' ' }, { tipo: '-', texto: 'x' }, { tipo: '+', texto: 'y' }]);
    assert.deepEqual(diff('x ', 'y '), [{ tipo: '-', texto: 'x' }, { tipo: '+', texto: 'y' }, { tipo: '=', texto: ' ' }]);
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

  it('ignora los elementos nulos de la lista de campos', () => {
    assert.equal(resumen(editar([null, { campo: 'Frecuencia', antes: 'A', despues: 'B' }])), '<b>Frecuencia</b> de A a B');
    assert.equal(resumen(editar([null, FRECUENCIA, undefined, { campo: 'Tipo de Gestion', antes: 'interna', despues: 'externa' }])),
      '<b>Frecuencia</b> de Anualmente a Cada medio año, y 1 campo más');
    assert.equal(resumen(editar([null])), 'Sin cambios en los campos principales');
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

  it('quiénes lo auditan también lleva el escudo (spec 5)', () => {
    const html = marca({ puede: false, respaldo: false, auditan: ['Ana'] });
    assert.ok(html.startsWith('<span class="pf-marca"><svg'));
    assert.ok(html.endsWith('Lo auditan Ana</span>'));
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
    for (const id of ['segmento-revisar', 'filtro-revisar-tipo', 'lista-para-revisar', 'mas-para-revisar']) {
      assert.ok(dentro(id, revisar, cambios), `${id} va en Para revisar`);
    }
    for (const id of ['grupo-mios-pendientes', 'lista-mios-pendientes', 'grupo-mios-resueltos', 'segmento-mios', 'lista-mios-resueltos', 'mas-mios']) {
      assert.ok(dentro(id, cambios, datos), `${id} va en Mis cambios`);
    }
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

  it('los estilos nuevos: todo el ancho como las demás páginas, barra que se desplaza, mensajes y movimiento reducido', () => {
    // Todo el ancho (pedido del usuario el 16/10/2026): sin tope en .main-content; min-width: 0 para que la barra de
    // pestañas no ensanche la página en el celular
    assert.match(PAGINA, /\.main-content\s*\{\s*min-width:\s*0;\s*\}/);
    assert.doesNotMatch(PAGINA, /\.main-content\s*\{[^}]*max-width/);
    // El texto de la comparación se corta en un ancho cómodo de leer aunque la fila ocupe todo el ancho
    assert.match(PAGINA, /\.pf-diff dd\s*\{[^}]*padding-right:\s*max\(0px,\s*calc\(100% - 88ch\)\)/);
    assert.match(PAGINA, /\.pf-pestanas\s*\{[^}]*overflow-x:\s*auto/);
    assert.match(PAGINA, /\.pf-pestana\.activa\s*\{[^}]*border-bottom-color:\s*var\(--primary\)/);
    assert.match(PAGINA, /\.pf-pestana:focus-visible/);
    assert.match(PAGINA, /\.alert-success\s*\{[^}]*#EAF6EF[^}]*#C7E6D3[^}]*#2E6B4C/i);
    assert.match(PAGINA, /\.alert-error\s*\{[^}]*#FBEEEE[^}]*#EFCACA[^}]*#8A3434/i);
    assert.match(PAGINA, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it('una región fija anuncia lo que pasó al aprobar o rechazar, y la lista de Para revisar puede recibir el foco', () => {
    assert.ok(PAGINA.includes('<div id="anuncio-cambios" class="pf-solo-lector" aria-live="polite"></div>'));
    // Fuera de los paneles, que se ocultan: siempre está en la página
    assert.ok(posicion('id="anuncio-cambios"') > posicion('id="message-container"'));
    assert.ok(posicion('id="anuncio-cambios"') < posicion('id="pestanas-perfil"'));
    // Visualmente oculta, pero la leen los lectores de pantalla
    assert.match(PAGINA, /\.pf-solo-lector\s*\{[^}]*position:\s*absolute;[^}]*width:\s*1px;[^}]*height:\s*1px;[^}]*overflow:\s*hidden;[^}]*clip:/);
    assert.match(etiqueta('lista-para-revisar'), /tabindex="-1"/);
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
    const teclear = (desde, key, modificadores = {}) => {
      const { elementos, estado, contexto } = armar();
      contexto.mostrarPestana(desde);
      let frenada = false;
      contexto.teclaEnPestanas({ key, ...modificadores, target: elementos[`pestana-${desde}`], preventDefault() { frenada = true; } });
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

    it('con Alt, Ctrl o Cmd no hace nada ni frena la tecla: son atajos del navegador (Alt+flecha izquierda vuelve atrás)', () => {
      for (const modificador of ['altKey', 'ctrlKey', 'metaKey']) {
        for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
          const { elementos, estado, frenada } = teclear('mis-datos', key, { [modificador]: true });
          assert.deepEqual(activas(elementos), ['mis-datos'], `${modificador} ${key}`);
          assert.equal(estado.enfocada, null, `${modificador} ${key}`);
          assert.equal(frenada, false, `${modificador} ${key}`);
        }
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

  it('las cuentas: Para revisar con el contador y Mis cambios con los pendientes propios de la lista ya cargada, sin pedirla otra vez', async () => {
    const elementos = { 'cuenta-para-revisar': { textContent: '', hidden: true }, 'cuenta-mis-cambios': { textContent: '', hidden: true } };
    const pedidos = [];
    const propio = (id, estado) => ({ id, tipo_cambio: 'eliminar', usuario_id: 1, estado, created_at: '2026-10-16T13:32:00Z', revisado_at: '2026-10-16T14:00:00Z' });
    const API = {
      getContadorPendientes: async () => ({ cantidad: 4 }),
      getMisCambios: async (filtros) => { pedidos.push(plano(filtros)); return [propio(1, 'pendiente'), propio(2, 'pendiente'), propio(3, 'aprobado')]; }
    };
    const contexto = cargarPerfil({ elementos, API, globales: { Auth: { getUser: () => ({ id: 1, rol: 'admin' }) } } });
    await contexto.cargarMisCambios();
    await contexto.actualizarCuentas();
    assert.equal(elementos['cuenta-para-revisar'].textContent, '4');
    assert.equal(elementos['cuenta-para-revisar'].hidden, false);
    assert.equal(elementos['cuenta-mis-cambios'].textContent, '2');
    assert.equal(elementos['cuenta-mis-cambios'].hidden, false);
    assert.deepEqual(pedidos, [{ estado: 'todos' }], 'Mis cambios se pide una sola vez, con todos los estados');
  });
});

// El arranque de la página (DOMContentLoaded), con los datos del perfil todavía en camino: la página no queda en blanco
describe('perfil.js: al abrir la página', () => {
  const NOMBRES = ['para-revisar', 'mis-cambios', 'mis-datos', 'mi-firma'];
  const abrir = (esAdmin) => {
    const elementos = { 'pestanas-perfil': { hidden: true, addEventListener() {} } };
    for (const n of NOMBRES) {
      elementos[`pestana-${n}`] = { attrs: {}, setAttribute(nombre, valor) { this.attrs[nombre] = valor; }, classList: { toggle() {} }, addEventListener() {} };
      elementos[`vista-${n}`] = { hidden: true };
    }
    let arranque = null;
    const historial = [];
    cargarPerfil({
      elementos,
      // El perfil no termina de llegar
      API: { getProfile: () => new Promise(() => {}) },
      globales: {
        document: { addEventListener: (tipo, funcion) => { if (tipo === 'DOMContentLoaded') arranque = funcion; }, getElementById: (id) => elementos[id] ?? { style: {} } },
        Auth: { isAuthenticated: () => true, isAdmin: () => esAdmin },
        location: { hash: '' }, history: { replaceState: (...argumentos) => historial.push(argumentos[2]) }
      }
    });
    arranque();
    return { elementos, historial, visibles: NOMBRES.filter(n => !elementos[`vista-${n}`].hidden) };
  };

  it('quien administra ya ve la barra y Para revisar (con el rol guardado) mientras se cargan sus datos', () => {
    const { elementos, historial, visibles } = abrir(true);
    assert.equal(elementos['pestanas-perfil'].hidden, false);
    assert.deepEqual(visibles, ['para-revisar']);
    assert.equal(elementos['pestana-para-revisar'].attrs['aria-selected'], 'true');
    assert.deepEqual(historial, ['#para-revisar']);
  });

  it('un lector ya ve sus datos, sin la barra', () => {
    const { elementos, visibles } = abrir(false);
    assert.equal(elementos['pestanas-perfil'].hidden, true);
    assert.deepEqual(visibles, ['mis-datos']);
  });
});

// Gestión de cambios rediseñada (spec 2026-10-16-perfil-pestanas-gestion-cambios, 5 y 6): cada cambio es una fila que se
// despliega en el lugar, con la comparación "control de cambios" y los botones de aprobar y rechazar en la fila
describe('perfil.js: filas de la gestión de cambios', () => {
  const EDITAR = {
    id: 7, tipo_cambio: 'editar', usuario_id: 2, usuario_nombre: 'Ana <b>Gómez</b>', dataset_titulo: 'Comercios <script>', estado: 'pendiente',
    created_at: '2026-10-16T13:32:00Z',
    campos_modificados: [{ campo: 'Frecuencia', antes: 'Anualmente', despues: 'Cada medio año' }],
    auditoria: { puede: true, respaldo: false, mensaje: null, auditan: ['Laura'] }
  };
  const MENSAJE_EDITOR = 'Este cambio lo auditan Laura. Podés auditarlo solo si ninguno está disponible.';
  const AUDITOR = { abierto: true, esEditor: false, idUsuario: 1 };

  it('pendiente con permiso: los botones de aprobar y rechazar, la comparación y los datos escapados', () => {
    const html = cargarPerfil().htmlDeFila(EDITAR, 'revisar', AUDITOR);
    assert.ok(html.includes('onclick="aprobarCambio(7)"'));
    assert.ok(html.includes('abrirModalRechazo(7)'));
    assert.ok(html.includes('<del>Anualmente</del>'));
    assert.ok(html.includes('<ins>Cada medio año</ins>'));
    assert.ok(html.includes('Comercios &lt;script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('Ana &lt;b&gt;Gómez&lt;/b&gt;'));
    assert.ok(html.includes('aria-expanded="true"'));
    assert.match(html, /^\s*<li class="pf-cambio[^"]*" data-id="7"/);
    assert.ok(html.includes('id="acciones-7"'));
  });

  it('un editor sin permiso: los botones deshabilitados, quiénes lo auditan y el motivo', () => {
    const contexto = cargarPerfil();
    const cambio = { ...EDITAR, auditoria: { puede: false, respaldo: false, mensaje: MENSAJE_EDITOR, auditan: ['Laura'] } };
    const html = contexto.htmlDeFila(cambio, 'revisar', { ...AUDITOR, esEditor: true });
    assert.equal(html.match(/disabled/g).length, 2);
    assert.ok(html.includes('Lo auditan Laura'));
    assert.ok(html.includes(contexto.avisoNoCorresponde(MENSAJE_EDITOR)));
    assert.doesNotMatch(html, /aprobarCambio/);
  });

  it('un cambio propio no tiene botones', () => {
    const html = cargarPerfil().htmlDeFila({ ...EDITAR, usuario_id: 1 }, 'mio', AUDITOR);
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo|disabled/);
  });

  it('en Mis cambios nunca hay botones ni nota, aunque el cambio figure como de otra persona', () => {
    const contexto = cargarPerfil();
    for (const auditoria of [EDITAR.auditoria, { puede: false, respaldo: false, mensaje: MENSAJE_EDITOR, auditan: ['Laura'] }]) {
      const html = contexto.htmlDeFila({ ...EDITAR, usuario_id: 2, auditoria }, 'mio', AUDITOR);
      assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo|disabled|acciones-7|no-corresponde/);
    }
  });

  it('sin saber quién mira, no hay botones (falla cerrado)', () => {
    const html = cargarPerfil().htmlDeFila(EDITAR, 'revisar', { abierto: true, esEditor: false, idUsuario: NaN });
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo/);
  });

  it('revisado y rechazado: el motivo, quién lo rechazó y la fecha, sin botones', () => {
    const cambio = {
      ...EDITAR, estado: 'rechazado', comentario_rechazo: 'Falta <i>x</i>', revisor_nombre: 'Pablo', revisado_como_respaldo: 1, revisado_at: '2026-10-15T12:00:00Z'
    };
    const html = cargarPerfil().htmlDeFila(cambio, 'revisado', AUDITOR);
    assert.ok(html.includes('Motivo del rechazo'));
    assert.ok(html.includes('Falta &lt;i&gt;x&lt;/i&gt;'));
    assert.ok(html.includes('Rechazado por Pablo (respaldo)'));
    assert.ok(html.includes('15/10/2026'));
    assert.ok(html.includes('Propuesto por Ana &lt;b&gt;Gómez&lt;/b&gt;'));
    assert.doesNotMatch(html, /aprobarCambio|abrirModalRechazo/);
  });

  it('cerrada: el cuerpo oculto y la cabecera con aria-expanded="false" que lo controla', () => {
    const html = cargarPerfil().htmlDeFila(EDITAR, 'revisar', { ...AUDITOR, abierto: false });
    assert.match(html, /<div [^>]*id="cuerpo-7"[^>]*\bhidden\b/);
    assert.match(html, /<button [^>]*aria-expanded="false"[^>]*aria-controls="cuerpo-7"/);
  });

  it('el link al portal solo si la URL es segura', () => {
    const contexto = cargarPerfil();
    const conUrl = contexto.htmlDeFila({ ...EDITAR, dataset_url: 'https://datos.comodoro.gov.ar/dataset/x' }, 'revisar', AUDITOR);
    assert.ok(conUrl.includes('href="https://datos.comodoro.gov.ar/dataset/x"'));
    assert.ok(conUrl.includes('Ver en el portal'));
    const peligrosa = contexto.htmlDeFila({ ...EDITAR, dataset_url: 'javascript:alert(1)' }, 'revisar', AUDITOR);
    assert.ok(!peligrosa.includes('javascript:') && !peligrosa.includes('Ver en el portal'));
  });

  it('htmlDeComparacion: la baja, el alta y la edición palabra por palabra', () => {
    const contexto = cargarPerfil();
    const baja = contexto.htmlDeComparacion({ tipo_cambio: 'eliminar', datos_anteriores: { titulo: 'X', area_nombre: 'Deportes' } });
    assert.ok(baja.includes('deja de figurar en el registro'));
    assert.ok(baja.includes('Deportes'));
    assert.ok(baja.includes('Área responsable'));
    const alta = contexto.htmlDeComparacion({ tipo_cambio: 'crear', datos_nuevos: { titulo: 'Arbolado', descripcion: 'Censo' } });
    assert.ok(alta.includes('Censo'));
    assert.ok(!alta.includes('<del>'));
    const edicion = contexto.htmlDeComparacion({
      tipo_cambio: 'editar', campos_modificados: [{ campo: 'Descripcion', antes: 'corte semestral.', despues: 'corte trimestral.' }]
    });
    assert.ok(edicion.includes('<del>semestral</del>'));
    assert.ok(edicion.includes('<ins>trimestral</ins>'));
    assert.ok(edicion.includes('Descripción'));
  });

  it('htmlDeComparacion: el valor vacío en cursiva, los valores escapados y una edición sin campos', () => {
    const contexto = cargarPerfil();
    const html = contexto.htmlDeComparacion({ tipo_cambio: 'editar', campos_modificados: [{ campo: 'Tema Secundario', antes: '-', despues: '<b>Salud</b>' }] });
    assert.ok(html.includes('<span class="pf-vacio">vacío</span>'));
    assert.ok(html.includes('<ins>&lt;b&gt;Salud&lt;/b&gt;</ins>'));
    assert.ok(contexto.htmlDeComparacion({ tipo_cambio: 'editar', campos_modificados: [] }).includes('No se detectaron cambios en los campos principales.'));
    // Un elemento nulo en la lista del servidor no rompe la comparación
    const conNulo = contexto.htmlDeComparacion({ tipo_cambio: 'editar', campos_modificados: [null, { campo: 'Frecuencia', antes: 'A', despues: 'B' }] });
    assert.ok(conNulo.includes('<del>A</del><ins>B</ins>'));
    assert.ok(contexto.htmlDeComparacion({ tipo_cambio: 'editar', campos_modificados: [null] }).includes('No se detectaron cambios en los campos principales.'));
  });

  // Aprobar y rechazar con un DOM falso: cada etiqueta con id del HTML que la página escribe pasa a ser un elemento, con sus
  // atributos (hidden y disabled incluidos). Repintar la lista de Para revisar borra lo que había en las filas (como un motivo
  // a medio escribir). Registra el foco, los desplazamientos, los mensajes y lo que dice la región de anuncios.
  const pendiente = (id, auditoria = { puede: true, respaldo: false, mensaje: null, auditan: [] }) => ({
    id, tipo_cambio: 'eliminar', usuario_id: 2, usuario_nombre: 'Ana', dataset_titulo: `Dataset ${id}`, estado: 'pendiente',
    created_at: '2026-10-16T13:32:00Z', auditoria
  });
  const armarAcciones = ({ API = {}, globales = {}, paraRevisar = [pendiente(7), pendiente(8)] } = {}) => {
    const registro = { foco: null, desplazamientos: [], errores: [], exitos: [], paraRevisar };
    const elementos = {};
    const filas = {};
    const crear = (id, attrs = {}) => {
      let html = '';
      const elemento = {
        id, attrs, value: '', textContent: '', hidden: 'hidden' in attrs, disabled: 'disabled' in attrs,
        setAttribute(nombre, valor) { this.attrs[nombre] = String(valor); },
        removeAttribute(nombre) { delete this.attrs[nombre]; },
        getAttribute(nombre) { return this.attrs[nombre] ?? null; },
        focus(opciones) { registro.foco = { id, opciones: plano(opciones ?? null) }; },
        scrollIntoView(opciones) { registro.desplazamientos.push({ id, opciones: plano(opciones) }); },
        querySelectorAll: () => [],
        querySelector: () => null,
        remove() { delete elementos[id]; },
        // La fila (li) de una cabecera o de un cuerpo
        closest: () => {
          const numero = id.replace(/^\D+/, '');
          if (!filas[numero]) {
            const fila = { innerHTML: '', clases: new Set() };
            fila.classList = { toggle: (clase, activa) => fila.clases[activa ? 'add' : 'delete'](clase) };
            filas[numero] = fila;
          }
          return filas[numero];
        },
        insertAdjacentHTML(_, agregado) { crearDesde(agregado); }
      };
      Object.defineProperty(elemento, 'innerHTML', { configurable: true, get: () => html, set(valor) { html = valor; crearDesde(valor); } });
      return (elementos[id] = elemento);
    };
    const crearDesde = (html) => {
      for (const [, antes, id, despues] of html.matchAll(/<[a-z]+\b([^>]*?)\sid="([^"]+)"([^>]*)>/g)) {
        crear(id, Object.fromEntries([...`${antes} ${despues}`.matchAll(/([a-z-]+)(?:="([^"]*)")?/g)].map(([, nombre, valor]) => [nombre, valor ?? ''])));
      }
    };
    for (const id of [
      'message-container', 'anuncio-cambios', 'filtro-revisar-tipo', 'mas-para-revisar', 'grupo-mios-pendientes', 'lista-mios-pendientes',
      'lista-mios-resueltos', 'mas-mios', 'cuenta-para-revisar', 'cuenta-mis-cambios'
    ]) crear(id);
    // La lista de Para revisar: al repintarla se van las filas que había; su primera cabecera es la de la primera fila
    const lista = crear('lista-para-revisar', { tabindex: '-1' });
    let htmlLista = '';
    Object.defineProperty(lista, 'innerHTML', {
      get: () => htmlLista,
      set(valor) {
        htmlLista = valor;
        for (const id of Object.keys(elementos)) if (/-\d+$/.test(id)) delete elementos[id];
        crearDesde(valor);
      }
    });
    lista.querySelector = (selector) => {
      assert.equal(selector, '.pf-cambio-cabeza');
      const primera = htmlLista.match(/id="(cabeza-\d+)"/)?.[1];
      return primera ? elementos[primera] : null;
    };
    const contexto = cargarPerfil({
      elementos,
      API: {
        getCambiosPendientesParaRevisar: async () => registro.paraRevisar, getMisCambios: async () => [], getContadorPendientes: async () => ({ cantidad: 0 }),
        ...API
      },
      globales: {
        // Como en el navegador: un id que no está da null
        document: { addEventListener() {}, getElementById: (id) => elementos[id] ?? null },
        Auth: { getUser: () => ({ id: 1, rol: 'admin' }) }, setTimeout: (funcion) => funcion(), ...globales
      }
    });
    contexto.Utils.showError = (mensaje) => registro.errores.push(mensaje);
    contexto.Utils.showSuccess = (mensaje) => registro.exitos.push(mensaje);
    return { contexto, elementos, registro, filas };
  };
  const AL_MENSAJE = { id: 'message-container', opciones: { block: 'nearest', behavior: 'smooth' } };

  it('aprobar pide la confirmación en la fila, anunciada: la pregunta describe los botones y "Sí, aprobar" se ve deshabilitado medio segundo', async () => {
    const temporizadores = [];
    let aprobados = 0;
    const { contexto, elementos, registro } = armarAcciones({
      API: { aprobarCambio: async () => { aprobados++; } }, globales: { setTimeout: (funcion, ms) => temporizadores.push({ funcion, ms }) }
    });
    await contexto.cargarCambiosParaRevisar();
    contexto.aprobarCambio(7);
    const acciones = elementos['acciones-7'];
    const confirmacion = acciones.innerHTML;
    assert.ok(confirmacion.includes('¿Aprobar? El cambio se aplica al dataset ahora.'));
    assert.ok(confirmacion.includes('onclick="cancelarAccion(7)"'));
    assert.ok(confirmacion.includes('onclick="confirmarAprobacion(7)"'));
    assert.ok(confirmacion.includes('Sí, aprobar'));
    assert.equal(registro.foco.id, 'cancelar-7');
    // El grupo y la pregunta, que describe los dos botones
    assert.equal(acciones.attrs.role, 'group');
    assert.match(confirmacion, /<span class="pf-pregunta" id="pregunta-7">¿Aprobar\? El cambio se aplica al dataset ahora\.<\/span>/);
    assert.equal(elementos['cancelar-7'].attrs['aria-describedby'], 'pregunta-7');
    assert.equal(elementos['confirmar-7'].attrs['aria-describedby'], 'pregunta-7');
    // "Sí, aprobar" aparece donde estaba Aprobar, deshabilitado: un doble clic en Aprobar no aprueba
    assert.equal(elementos['confirmar-7'].disabled, true);
    await contexto.confirmarAprobacion(7);
    assert.equal(aprobados, 0);
    // A los 500 ms se habilita
    assert.deepEqual(temporizadores.map(t => t.ms), [500]);
    temporizadores[0].funcion();
    assert.equal(elementos['confirmar-7'].disabled, false);
  });

  it('cancelar y volver a pedir la confirmación: la espera vuelve a empezar (la anterior no habilita la nueva)', async () => {
    const temporizadores = [];
    const { contexto, elementos } = armarAcciones({ globales: { setTimeout: (funcion, ms) => temporizadores.push({ funcion, ms }) } });
    await contexto.cargarCambiosParaRevisar();
    contexto.aprobarCambio(7);
    contexto.cancelarAccion(7);
    assert.equal(elementos['acciones-7'].attrs.role, undefined, 'sin la confirmación, ya no es un grupo');
    assert.ok(elementos['acciones-7'].innerHTML.includes('onclick="aprobarCambio(7)"'));
    contexto.aprobarCambio(7);
    temporizadores[0].funcion();
    assert.equal(elementos['confirmar-7'].disabled, true);
    temporizadores[1].funcion();
    assert.equal(elementos['confirmar-7'].disabled, false);
  });

  it('confirmar una aprobación que no se pidió no hace nada', async () => {
    let aprobados = 0;
    await cargarPerfil({ API: { aprobarCambio: async () => { aprobados++; } } }).confirmarAprobacion(7);
    assert.equal(aprobados, 0);
  });

  it('rechazar sin motivo: el error de siempre, a la vista y anunciado, el foco en el motivo, y no se envía', async () => {
    let enviados = 0;
    const { contexto, elementos, registro } = armarAcciones({ API: { rechazarCambio: async () => { enviados++; } } });
    await contexto.cargarCambiosParaRevisar();
    contexto.abrirModalRechazo(7);
    elementos['motivo-7'].value = '   ';
    await contexto.confirmarRechazo(7);
    assert.deepEqual(registro.errores, ['Debe proporcionar un motivo de rechazo']);
    assert.equal(enviados, 0);
    assert.deepEqual(registro.desplazamientos, [AL_MENSAJE]);
    // El foco vuelve al motivo sin desplazar la página (el mensaje queda a la vista)
    assert.deepEqual(registro.foco, { id: 'motivo-7', opciones: { preventScroll: true } });
    assert.equal(elementos['anuncio-cambios'].textContent, 'Debe proporcionar un motivo de rechazo');
  });

  for (const [accion, anuncio] of [['aprobar', 'Cambio aprobado correctamente'], ['rechazar', 'Cambio rechazado correctamente']]) {
    it(`${accion} bien: se anuncia y, después de recargar, el foco va a la primera fila de Para revisar (o a la lista, si quedó vacía)`, async () => {
      for (const despues of [[pendiente(8)], []]) {
        const { contexto, elementos, registro } = armarAcciones({
          API: { aprobarCambio: async () => { registro.paraRevisar = despues; }, rechazarCambio: async () => { registro.paraRevisar = despues; } }
        });
        await contexto.cargarCambiosParaRevisar();
        if (accion === 'aprobar') {
          contexto.aprobarCambio(7);
          await contexto.confirmarAprobacion(7);
        } else {
          contexto.abrirModalRechazo(7);
          elementos['motivo-7'].value = 'Falta la fuente';
          await contexto.confirmarRechazo(7);
        }
        assert.deepEqual(registro.exitos, [anuncio]);
        assert.equal(elementos['anuncio-cambios'].textContent, anuncio);
        assert.deepEqual(registro.foco, { id: despues.length ? 'cabeza-8' : 'lista-para-revisar', opciones: null });
      }
    });

    it(`${accion} con un error del servidor: el mensaje a la vista y anunciado, y el foco en Para revisar sin desplazar la página`, async () => {
      const fallar = async () => { registro.paraRevisar = [pendiente(8)]; throw new Error('El cambio ya fue procesado'); };
      const { contexto, elementos, registro } = armarAcciones({ API: { aprobarCambio: fallar, rechazarCambio: fallar } });
      await contexto.cargarCambiosParaRevisar();
      if (accion === 'aprobar') {
        contexto.aprobarCambio(7);
        await contexto.confirmarAprobacion(7);
      } else {
        contexto.abrirModalRechazo(7);
        elementos['motivo-7'].value = 'Falta la fuente';
        await contexto.confirmarRechazo(7);
      }
      assert.deepEqual(registro.errores, ['El cambio ya fue procesado']);
      assert.deepEqual(registro.desplazamientos, [AL_MENSAJE]);
      assert.deepEqual(registro.foco, { id: 'cabeza-8', opciones: { preventScroll: true } });
      assert.equal(elementos['anuncio-cambios'].textContent, 'El cambio ya fue procesado');
    });
  }

  it('con movimiento reducido, el mensaje se trae a la vista sin animación', async () => {
    const { contexto, registro } = armarAcciones({
      API: { aprobarCambio: async () => { throw new Error('No se pudo aprobar'); } },
      globales: { matchMedia: (consulta) => ({ matches: consulta === '(prefers-reduced-motion: reduce)' }) }
    });
    await contexto.cargarCambiosParaRevisar();
    contexto.aprobarCambio(7);
    await contexto.confirmarAprobacion(7);
    assert.deepEqual(registro.desplazamientos, [{ id: 'message-container', opciones: { block: 'nearest', behavior: 'auto' } }]);
  });

  it('un rechazo que falla y el cambio sigue pendiente: vuelve a abrir su fila y el motivo, con lo que se había escrito', async () => {
    const { contexto, elementos, registro } = armarAcciones({ API: { rechazarCambio: async () => { throw new Error('No se pudo conectar con el servidor'); } } });
    await contexto.cargarCambiosParaRevisar();
    // La segunda fila (cerrada al cargar): se abre, se escribe el motivo y el envío falla
    contexto.abrirModalRechazo(8);
    const campoAnterior = elementos['motivo-8'];
    campoAnterior.value = '  Falta la fuente de los datos.  ';
    await contexto.confirmarRechazo(8);
    assert.deepEqual(registro.errores, ['No se pudo conectar con el servidor']);
    assert.deepEqual(registro.desplazamientos, [AL_MENSAJE]);
    // La lista se repintó (el campo es otro) y el motivo volvió tal cual, con la fila abierta y el foco en el campo
    assert.notEqual(elementos['motivo-8'], campoAnterior);
    assert.equal(elementos['motivo-8'].value, '  Falta la fuente de los datos.  ');
    assert.equal(elementos['cabeza-8'].attrs['aria-expanded'], 'true');
    assert.equal(elementos['cuerpo-8'].hidden, false);
    assert.equal(elementos['acciones-8'].hidden, true);
    assert.equal(registro.foco.id, 'motivo-8');
    assert.equal(elementos['anuncio-cambios'].textContent, 'No se pudo conectar con el servidor');
  });

  it('un rechazo que falla porque ya no está pendiente (o ya no le corresponde): no se restaura nada', async () => {
    const sinPermiso = { puede: false, respaldo: false, mensaje: MENSAJE_EDITOR, auditan: ['Laura'] };
    for (const [error, despues] of [['El cambio ya fue procesado', [pendiente(7)]], ['No le corresponde auditar este cambio', [pendiente(7), pendiente(8, sinPermiso)]]]) {
      const { contexto, elementos, registro } = armarAcciones({
        API: { rechazarCambio: async () => { registro.paraRevisar = despues; throw new Error(error); } }
      });
      await contexto.cargarCambiosParaRevisar();
      contexto.abrirModalRechazo(8);
      elementos['motivo-8'].value = 'Falta la fuente';
      await contexto.confirmarRechazo(8);
      assert.equal(elementos['motivo-8'], undefined, error);
      assert.deepEqual(registro.foco, { id: 'cabeza-7', opciones: { preventScroll: true } }, error);
      // Y lo escrito se descartó: si el cambio vuelve a aparecer, el motivo empieza vacío
      registro.paraRevisar = [pendiente(7), pendiente(8)];
      await contexto.cargarCambiosParaRevisar();
      contexto.abrirModalRechazo(8);
      assert.equal(elementos['motivo-8'].value, '', error);
    }
  });

  it('Revisados y Resueltos: los revisados más recientes primero (el servidor los manda por fecha de propuesta); los pendientes, como vienen', async () => {
    const cambio = (id, estado, revisado_at) => ({ ...pendiente(id), usuario_id: 1, estado, revisado_at });
    const delServidor = [
      cambio(1, 'pendiente', null), cambio(2, 'aprobado', '2026-10-10T10:00:00Z'), cambio(3, 'pendiente', null),
      cambio(4, 'rechazado', '2026-10-15T10:00:00Z'), cambio(5, 'aprobado', null), cambio(6, 'aprobado', '2026-10-12T10:00:00Z')
    ];
    const { contexto, elementos } = armarAcciones({ API: { getMisCambios: async () => delServidor }, paraRevisar: delServidor });
    const orden = (id) => [...elementos[id].innerHTML.matchAll(/data-id="(\d+)"/g)].map(m => Number(m[1]));
    await contexto.cargarMisCambios();
    assert.deepEqual(orden('lista-mios-pendientes'), [1, 3]);
    assert.deepEqual(orden('lista-mios-resueltos'), [4, 6, 2, 5], 'sin fecha de revisión, al final');
    vm.runInContext("vistaParaRevisar.segmento = 'revisados'", contexto);
    await contexto.cargarCambiosParaRevisar();
    assert.deepEqual(orden('lista-para-revisar'), [4, 6, 2, 5]);
  });

  it('las listas vacías dicen qué pasa (y qué filtro está puesto)', () => {
    const contexto = cargarPerfil();
    const pendientes = contexto.htmlDeVacioParaRevisar('pendientes', '');
    assert.ok(pendientes.includes('No hay cambios esperando revisión.') && pendientes.includes('Cuando alguien proponga uno, aparece acá.'));
    assert.ok(contexto.htmlDeVacioParaRevisar('revisados', '').includes('Todavía no hay cambios revisados.'));
    assert.ok(contexto.htmlDeVacioParaRevisar('pendientes', 'crear').includes('No hay cambios de tipo Crear.'));
    assert.ok(contexto.htmlDeVacioParaRevisar('revisados', 'eliminar').includes('No hay cambios de tipo Eliminar.'));
    assert.ok(contexto.htmlDeVacioMisCambios('todos', false).includes('Todavía no propusiste cambios.'));
    assert.ok(contexto.htmlDeVacioMisCambios('aprobado', false).includes('Todavía no propusiste cambios.'));
    assert.ok(contexto.htmlDeVacioMisCambios('aprobado', true).includes('No hay cambios aprobados.'));
    assert.ok(contexto.htmlDeVacioMisCambios('rechazado', true).includes('No hay cambios rechazados.'));
    assert.ok(contexto.htmlDeVacioMisCambios('todos', true).includes('Todavía no hay cambios resueltos.'));
  });

  it('la página y el código viejo: sin los modales, el filtro de estado ni la opción "actualizar"; sin el confirm nativo ni el detalle viejo', () => {
    const PAGINA = fs.readFileSync(new URL('../public/perfil.html', import.meta.url), 'utf8');
    const CODIGO = fs.readFileSync(new URL('../public/js/perfil.js', import.meta.url), 'utf8');
    for (const texto of ['modal-detalle', 'modal-rechazo', 'filtro-mis-estado', 'value="actualizar"']) assert.ok(!PAGINA.includes(texto), texto);
    for (const texto of ['confirm(', 'verDetalle', 'renderComparador', 'nav-badge-admin']) assert.ok(!CODIGO.includes(texto), texto);
  });

  it('la página: el selector Pendientes / Revisados, el filtro de tipo y los grupos de Mis cambios', () => {
    const PAGINA = fs.readFileSync(new URL('../public/perfil.html', import.meta.url), 'utf8');
    assert.match(PAGINA, /<button type="button" data-segmento="pendientes" aria-pressed="true">Pendientes<\/button>/);
    assert.match(PAGINA, /<button type="button" data-segmento="revisados" aria-pressed="false">Revisados<\/button>/);
    for (const [valor, texto] of [['', 'Todos los tipos'], ['crear', 'Crear'], ['editar', 'Editar'], ['eliminar', 'Eliminar']]) {
      assert.ok(PAGINA.includes(`<option value="${valor}">${texto}</option>`), texto);
    }
    assert.match(PAGINA, /<ul class="pf-lista" id="lista-para-revisar"/);
    assert.match(PAGINA, /<button type="button" [^>]*id="mas-para-revisar" hidden>Ver 20 más<\/button>/);
    assert.match(PAGINA, /<button type="button" [^>]*id="mas-mios" hidden>Ver 20 más<\/button>/);
    assert.match(PAGINA, /id="grupo-mios-pendientes" hidden>\s*<h2[^>]*>Esperando auditoría<\/h2>/);
    assert.match(PAGINA, /<h2[^>]*>Resueltos<\/h2>/);
    for (const filtro of ['todos', 'aprobado', 'rechazado']) assert.ok(PAGINA.includes(`data-filtro="${filtro}"`), filtro);
    // La comparación: dos columnas que pasan a una en 760 px, el tachado y el resaltador
    assert.match(PAGINA, /\.pf-diff\s*\{[^}]*grid-template-columns/);
    assert.match(PAGINA, /@media \(max-width: 760px\)\s*\{[^@]*\.pf-diff\s*\{\s*grid-template-columns:\s*1fr;/);
    assert.match(PAGINA, /--pf-tachado:\s*#B5524C/);
    assert.match(PAGINA, /\.pf-diff ins\s*\{[^}]*var\(--pf-resaltador\)/);
  });
});

// "Datos al", "Cargado en el portal" y las actualizaciones registradas (spec 2026-10-17-fechas-datasets, 10.1): los rótulos
// nuevos, el título de un registro de actualización y la marca de la próxima que no es fin de mes
describe('perfil.js: las fechas de los datasets', () => {
  const MARCA = 'No es el último día del mes';
  const PROXIMA = (despues, antes = '2026-03-31') => ({ campo: 'Proxima Actualizacion', antes, despues });
  const editar = (campos, datosNuevos = {}) => ({
    id: 9, tipo_cambio: 'editar', usuario_id: 2, usuario_nombre: 'Ana', dataset_titulo: 'Arbolado urbano', estado: 'pendiente',
    created_at: '2026-10-16T13:32:00Z', campos_modificados: campos, datos_nuevos: datosNuevos
  });
  const AUDITOR = { abierto: true, esEditor: false, idUsuario: 1 };

  it('los rótulos nuevos se muestran tal cual y los de siempre no cambian', () => {
    const contexto = cargarPerfil();
    for (const rotulo of ['Cargado en el portal', 'Datos al', 'Tipo de pedido', 'Recibido el']) assert.equal(contexto.etiquetaDeCampo(rotulo), rotulo);
    assert.equal(contexto.etiquetaDeCampo('Proxima Actualizacion'), 'Próxima actualización');
    assert.equal(contexto.etiquetaDeCampo('registro_actualizacion'), 'registro_actualizacion');
  });

  describe('esFinDeMesTexto', () => {
    const fin = (texto) => cargarPerfil().esFinDeMesTexto(texto);

    it('el último día de cada mes sí; cualquier otro día no', () => {
      for (const dia of ['2026-01-31', '2026-04-30', '2026-05-31', '2026-12-31']) assert.equal(fin(dia), true, dia);
      for (const dia of ['2026-05-29', '2026-05-30', '2026-04-31', '2026-01-01', '2026-06-15']) assert.equal(fin(dia), false, dia);
    });

    it('febrero va siempre en 28, también en los años bisiestos', () => {
      assert.equal(fin('2026-02-28'), true);
      assert.equal(fin('2028-02-28'), true);
      assert.equal(fin('2028-02-29'), false);
      assert.equal(fin('2026-02-29'), false);
    });

    it('una fecha con hora cuenta por su día; lo que no es una fecha no es fin de mes (y no tira error)', () => {
      assert.equal(fin('2026-05-31T03:00:00.000Z'), true);
      assert.equal(fin('2026-05-29T03:00:00.000Z'), false);
      for (const nada of [null, undefined, '', '-', 'abc', '2026-5-31', '31/05/2026', '0000-00-00', '2026-13-31', 20260531]) assert.equal(fin(nada), false, String(nada));
    });
  });

  describe('la marca "No es el último día del mes"', () => {
    const comparacion = (campos) => cargarPerfil().htmlDeComparacion(editar(campos));

    it('aparece con una próxima nueva que no es fin de mes, y no con 2026-05-31 ni con 2028-02-28', () => {
      assert.ok(comparacion([PROXIMA('2026-05-29')]).includes(MARCA));
      assert.ok(!comparacion([PROXIMA('2026-05-31')]).includes(MARCA));
      assert.ok(!comparacion([PROXIMA('2028-02-28')]).includes(MARCA));
      // Febrero va en 28: el 29 de un año bisiesto tampoco es fin de mes
      assert.ok(comparacion([PROXIMA('2028-02-29')]).includes(MARCA));
    });

    it('va dentro de la comparación de la próxima, junto al valor nuevo', () => {
      const html = comparacion([PROXIMA('2026-05-29')]);
      assert.match(html, /<del>31\/03\/2026<\/del><ins>29\/05\/2026<\/ins><span class="pf-fecha-aviso">[^]*No es el último día del mes<\/span><\/div>/);
    });

    it('una próxima con hora cuenta por su día; sin próxima nueva (se vació) no hay marca', () => {
      assert.ok(!comparacion([PROXIMA('2027-01-31T03:00:00.000Z', '2026-07-31T03:00:00.000Z')]).includes(MARCA));
      assert.ok(comparacion([PROXIMA('2027-01-30T03:00:00.000Z', '2026-07-31T03:00:00.000Z')]).includes(MARCA));
      assert.ok(!comparacion([PROXIMA('-')]).includes(MARCA));
    });

    it('solo marca la próxima: ningún otro campo lleva la marca', () => {
      const html = comparacion([
        { campo: 'Datos al', antes: '2026-02-28', despues: '2026-03-29' },
        { campo: 'Cargado en el portal', antes: '2026-02-28', despues: '2026-03-29' },
        { campo: 'Recibido el', antes: '-', despues: '2026-03-29' }
      ]);
      assert.ok(!html.includes(MARCA));
      assert.ok(!html.includes('pf-fecha-aviso'));
    });

    it('en un dataset nuevo, la próxima que no es fin de mes también lleva la marca; en una baja no', () => {
      const contexto = cargarPerfil();
      const alta = (proxima) => contexto.htmlDeComparacion({ tipo_cambio: 'crear', datos_nuevos: { titulo: 'Nuevo', proxima_actualizacion: proxima } });
      assert.ok(alta('2026-05-29').includes(MARCA));
      assert.ok(!alta('2026-05-31').includes(MARCA));
      assert.ok(!alta(null).includes(MARCA));
      assert.ok(!contexto.htmlDeComparacion({ tipo_cambio: 'eliminar', datos_anteriores: { titulo: 'X', proxima_actualizacion: '2026-05-29' } }).includes(MARCA));
    });

    it('la página tiene el estilo de la marca', () => {
      const PAGINA = fs.readFileSync(new URL('../public/perfil.html', import.meta.url), 'utf8');
      assert.match(PAGINA, /\.pf-fecha-aviso\s*\{[^}]*var\(--pf-aviso-fondo\)/);
    });
  });

  describe('una actualización registrada', () => {
    const REGISTRO = editar([
      { campo: 'Datos al', antes: '2026-02-28', despues: '2026-03-31' },
      { campo: 'Cargado en el portal', antes: '2026-03-13', despues: '2026-04-03' },
      { campo: 'Recibido el', antes: '-', despues: '2026-04-02' },
      PROXIMA('2026-06-30')
    ], { ultima_actualizacion: '2026-04-03', datos_al: '2026-03-31', proxima_actualizacion: '2026-06-30', recibido_el: '2026-04-02', notas: 'Llegó por mail', registro_actualizacion: true });

    it('se titula "Actualización registrada" en vez de resumir un campo', () => {
      assert.equal(cargarPerfil().resumenDelCambio(REGISTRO), 'Actualización registrada');
      const html = cargarPerfil().htmlDeFila(REGISTRO, 'revisar', AUDITOR);
      assert.match(html, /<span class="pf-cambio-resumen">Actualización registrada<\/span>/);
      // La fila sigue diciendo de qué dataset se trata
      assert.match(html, /<span class="pf-cambio-titulo">Arbolado urbano<\/span>/);
    });

    it('también en Mis cambios', () => {
      assert.match(cargarPerfil().htmlDeFila(REGISTRO, 'mio', AUDITOR), /<span class="pf-cambio-resumen">Actualización registrada<\/span>/);
    });

    it('la comparación muestra las fechas con sus rótulos, y la marca registro_actualizacion no se muestra como un campo', () => {
      const html = cargarPerfil().htmlDeFila(REGISTRO, 'revisar', AUDITOR);
      assert.ok(html.includes('<dt>Datos al</dt>'));
      assert.ok(html.includes('<del>28/02/2026</del><ins>31/03/2026</ins>'));
      assert.ok(html.includes('<dt>Cargado en el portal</dt>'));
      assert.ok(html.includes('<del>13/03/2026</del><ins>03/04/2026</ins>'));
      assert.ok(html.includes('<dt>Recibido el</dt>'));
      assert.ok(html.includes('<del><span class="pf-vacio">vacío</span></del><ins>02/04/2026</ins>'));
      assert.ok(html.includes('<dt>Próxima actualización</dt>'));
      assert.ok(html.includes('<del>31/03/2026</del><ins>30/06/2026</ins>'));
      assert.ok(!/registro[_ ]actualizaci/i.test(html));
      assert.ok(!html.includes(MARCA));
    });

    it('si la próxima elegida no es fin de mes, la comparación lo marca', () => {
      const cambio = { ...REGISTRO, campos_modificados: [...REGISTRO.campos_modificados.slice(0, 3), PROXIMA('2026-06-29')] };
      assert.ok(cargarPerfil().htmlDeFila(cambio, 'revisar', AUDITOR).includes(MARCA));
    });

    it('solo la marca verdadera (true) la titula: sin la marca o en false, el resumen es el de siempre', () => {
      const contexto = cargarPerfil();
      const DE_SIEMPRE = '<b>Datos al</b> de 28/02/2026 a 31/03/2026, y 3 campos más';
      for (const marca of [undefined, false, null, 'true', 1]) {
        assert.equal(contexto.resumenDelCambio(editar(REGISTRO.campos_modificados, { registro_actualizacion: marca })), DE_SIEMPRE, String(marca));
      }
      assert.equal(contexto.resumenDelCambio({ ...REGISTRO, datos_nuevos: undefined }), DE_SIEMPRE);
      assert.equal(contexto.resumenDelCambio({ ...REGISTRO, datos_nuevos: null }), DE_SIEMPRE);
    });

    it('un registro sin ninguna fecha que cambie sigue titulándose "Actualización registrada"', () => {
      assert.equal(cargarPerfil().resumenDelCambio({ ...REGISTRO, campos_modificados: [] }), 'Actualización registrada');
    });
  });

  describe('un cambio con la forma vieja (sin las claves nuevas)', () => {
    // Como lo arma el servidor para un cambio propuesto antes del despliegue: fechas con hora, sin Datos al ni registro
    const VIEJO = editar([
      { campo: 'Cargado en el portal', antes: '2026-03-13T03:00:00.000Z', despues: '2026-03-20' },
      PROXIMA('2026-07-31', '2026-05-31T03:00:00.000Z')
    ], { ultima_actualizacion: '2026-03-20', proxima_actualizacion: '2026-07-31', notas: 'x' });

    it('se muestra como antes: su resumen de campos, las fechas dd/mm/aaaa, sin título de registro ni marca', () => {
      const contexto = cargarPerfil();
      assert.equal(contexto.resumenDelCambio(VIEJO), '<b>Cargado en el portal</b> de 13/03/2026 a 20/03/2026, y 1 campo más');
      const html = contexto.htmlDeFila(VIEJO, 'revisar', AUDITOR);
      assert.ok(html.includes('<del>13/03/2026</del><ins>20/03/2026</ins>'));
      assert.ok(html.includes('<del>31/05/2026</del><ins>31/07/2026</ins>'));
      assert.ok(!html.includes('Actualización registrada'));
      assert.ok(!html.includes(MARCA));
      assert.ok(!html.includes('Datos al') && !html.includes('Recibido el') && !html.includes('Tipo de pedido'));
    });

    it('un cambio sin datos_nuevos ni campos no se rompe', () => {
      const contexto = cargarPerfil();
      assert.equal(contexto.resumenDelCambio({ tipo_cambio: 'editar' }), 'Sin cambios en los campos principales');
      assert.doesNotThrow(() => contexto.htmlDeFila({ id: 1, tipo_cambio: 'editar', estado: 'pendiente' }, 'revisar', AUDITOR));
    });
  });

  describe('un dataset nuevo con las fechas nuevas', () => {
    it('lista Tipo de pedido (con su nombre), Datos al, Cargado en el portal y la próxima', () => {
      const html = cargarPerfil().htmlDeComparacion({
        tipo_cambio: 'crear',
        datos_nuevos: {
          titulo: 'Nuevo', tipo_pedido: 'foto', tipo_pedido_nombre: 'Foto al corte', datos_al: '2026-03-31',
          ultima_actualizacion: '2026-04-03', proxima_actualizacion: '2026-06-30'
        }
      });
      assert.ok(html.includes('<dt>Tipo de pedido</dt><dd>Foto al corte</dd>'));
      assert.ok(html.includes('<dt>Datos al</dt><dd>31/03/2026</dd>'));
      assert.ok(html.includes('<dt>Cargado en el portal</dt><dd>03/04/2026</dd>'));
      assert.ok(html.includes('<dt>Próxima actualización</dt><dd>30/06/2026</dd>'));
    });

    it('sin las claves nuevas, no las inventa', () => {
      const html = cargarPerfil().htmlDeComparacion({ tipo_cambio: 'crear', datos_nuevos: { titulo: 'Viejo', proxima_actualizacion: '2026-07-31T03:00:00.000Z' } });
      assert.ok(!html.includes('Tipo de pedido') && !html.includes('Datos al'));
      assert.ok(html.includes('<dd>31/07/2026</dd>'));
    });
  });
});
