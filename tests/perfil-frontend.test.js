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
    Utils: { escapeHtml: escaparHtml, textoCargo: (cargo) => cargo ?? '', textoVinculo: (vinculo) => vinculo ?? '', showError: (m) => { throw new Error(m); } },
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
