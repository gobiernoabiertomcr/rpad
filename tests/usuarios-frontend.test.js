// Panel de usuarios (public/js/usuarios.js), ejecutado en Node con un DOM mínimo:
// no se envía un link ni se cambia el estado mientras el formulario tenga cambios sin guardar
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const MENSAJE = 'Guardá los cambios antes de continuar.';
const USUARIO = {
  id: 7, nombre_completo: 'Persona de Prueba', username: 'PPRUEBA', email: 'pprueba@rpad.test',
  cargo: 'Cargo de prueba', vinculo: 'contrato', rol: 'lector', estado: 'activo', email_valido: true
};

// usuarios.js es un script de navegador: se ejecuta en un contexto aislado. El formulario parte igual al usuario abierto.
const cargarPanel = (abierto = USUARIO, alPedir = () => {}) => {
  const elementos = new Map();
  const elemento = (id) => {
    if (!elementos.has(id)) {
      elementos.set(id, { id, value: '', textContent: '', hidden: true, disabled: false, setAttribute() {}, removeAttribute() {} });
    }
    return elementos.get(id);
  };
  const document = { addEventListener() {}, getElementById: elemento, querySelectorAll: () => [], querySelector: () => null };
  const llamadas = [];
  // Cualquier API.* queda registrado y responde vacío; alPedir ve el estado de la pantalla en el momento del pedido
  const API = new Proxy({}, { get: (_, nombre) => async () => { alPedir(nombre); llamadas.push(nombre); return { message: '', data: { usuarios: [], resumen: {} } }; } });
  const contexto = vm.createContext({
    document,
    window: { location: {} },
    Utils: { escapeHtml: (texto) => texto },
    Auth: { getUser: () => ({ id: 1 }) },
    API,
    showToast() {},
    confirm: () => { llamadas.push('confirm'); return true; },
    console
  });
  vm.runInContext(fs.readFileSync(new URL('../public/js/usuarios.js', import.meta.url), 'utf8'), contexto);

  const formulario = (datos) => {
    elemento('u-nombre').value = datos.nombre_completo ?? '';
    elemento('u-username').value = datos.username ?? '';
    elemento('u-email').value = datos.email ?? '';
    elemento('u-cargo').value = datos.cargo ?? '';
    elemento('u-vinculo').value = datos.vinculo ?? '';
  };
  vm.runInContext('abierto = null', contexto);
  contexto.__abierto = abierto;
  vm.runInContext('abierto = __abierto', contexto);
  if (abierto) formulario(abierto);
  return { contexto, elemento, formulario, llamadas };
};

describe('hayCambiosSinGuardar', () => {
  it('un formulario igual al usuario abierto no tiene cambios', () => {
    assert.equal(cargarPanel().contexto.hayCambiosSinGuardar(), false);
  });

  it('no cuenta lo que el servidor normaliza: espacios, mayúsculas del usuario, minúsculas del email, cargo y vínculo vacíos', () => {
    const { contexto, formulario } = cargarPanel();
    formulario({ ...USUARIO, nombre_completo: '  Persona de Prueba ', username: ' pprueba ', email: ' PPrueba@RPAD.test ' });
    assert.equal(contexto.hayCambiosSinGuardar(), false);

    const sinCargo = cargarPanel({ ...USUARIO, cargo: null, vinculo: null });
    sinCargo.formulario({ ...USUARIO, cargo: '   ', vinculo: '' });
    assert.equal(sinCargo.contexto.hayCambiosSinGuardar(), false);
  });

  it('detecta un cambio en el nombre, el usuario, el email, el cargo o el vínculo', () => {
    const cambios = [
      { nombre_completo: 'Otro Nombre' },
      { username: 'OTRO' },
      { email: 'otro@rpad.test' },
      { cargo: 'Otro cargo' },
      { cargo: '' },
      { vinculo: 'planta_permanente' },
      { vinculo: '' }
    ];
    for (const cambio of cambios) {
      const { contexto, formulario } = cargarPanel();
      formulario({ ...USUARIO, ...cambio });
      assert.equal(contexto.hayCambiosSinGuardar(), true, JSON.stringify(cambio));
    }
  });

  it('un usuario sin cargo ni vínculo que se completan tiene cambios', () => {
    const { contexto, formulario } = cargarPanel({ ...USUARIO, cargo: null, vinculo: null });
    formulario({ ...USUARIO, cargo: 'Nuevo cargo', vinculo: '' });
    assert.equal(contexto.hayCambiosSinGuardar(), true);
  });

  it('en el alta (sin usuario abierto) no aplica', () => {
    const { contexto, formulario } = cargarPanel(null);
    formulario({ nombre_completo: 'Alguien' });
    assert.equal(contexto.hayCambiosSinGuardar(), false);
  });
});

describe('enviar link y cambiar estado con cambios sin guardar', () => {
  it('enviarAcceso muestra el aviso arriba del modal y no hace el pedido', async () => {
    const { contexto, elemento, formulario, llamadas } = cargarPanel();
    formulario({ ...USUARIO, email: 'otro@rpad.test' });
    await contexto.enviarAcceso();
    const caja = elemento('usuario-error');
    assert.equal(caja.textContent, MENSAJE);
    assert.equal(caja.hidden, false);
    assert.deepEqual(llamadas, []);
  });

  it('cambiarEstado muestra el aviso, no pregunta si desactivar y no hace el pedido', async () => {
    const { contexto, elemento, formulario, llamadas } = cargarPanel();
    formulario({ ...USUARIO, cargo: 'Cargo sin guardar' });
    await contexto.cambiarEstado();
    const caja = elemento('usuario-error');
    assert.equal(caja.textContent, MENSAJE);
    assert.equal(caja.hidden, false);
    assert.deepEqual(llamadas, []);
  });

  it('sin cambios, las dos acciones siguen funcionando y borran el aviso anterior', async () => {
    let cajaAlPedir;
    let panel;
    panel = cargarPanel(USUARIO, (nombre) => {
      if (nombre === 'enviarAccesoUsuario') cajaAlPedir = panel.elemento('usuario-error').hidden;
    });
    const { contexto, elemento, llamadas } = panel;
    const caja = elemento('usuario-error');
    caja.textContent = MENSAJE;
    caja.hidden = false;
    await contexto.enviarAcceso();
    assert.ok(llamadas.includes('enviarAccesoUsuario'));
    assert.equal(cajaAlPedir, true, 'el aviso anterior ya no se muestra cuando se hace el pedido');

    const desactivado = cargarPanel({ ...USUARIO, estado: 'desactivado' });
    await desactivado.contexto.cambiarEstado();
    assert.ok(desactivado.llamadas.includes('reactivarUsuario'));
  });
});

describe('licencias (spec 2026-10-15-dias-habiles-licencias-auditoria, 5.5)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);

  it('período y marca de la lista, sin pasar por Date', () => {
    const { contexto } = cargarPanel();
    assert.equal(evaluar(contexto, "textoPeriodo({ desde: '2026-11-26', hasta: '2027-01-14' })"), 'Del 26/11/2026 al 14/01/2027');
    assert.match(evaluar(contexto, "etiquetaLicencia({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: true })"), /De licencia hasta 14\/01/);
    assert.match(evaluar(contexto, "etiquetaLicencia({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: false })"), /Licencia desde 26\/11/);
    assert.equal(evaluar(contexto, 'etiquetaLicencia(null)'), '');
  });

  it('efecto en las notas: con autorizado, y sin autorizado con la víspera', () => {
    const { contexto } = cargarPanel();
    const conAutorizado = evaluar(contexto, "efectoEnNotas({ vispera: '2026-11-25' }, 'Persona Autorizada')");
    assert.match(conAutorizado, /comunica la autorización a Persona Autorizada/);
    assert.match(conAutorizado, /Persona Autorizada presenta las demás notas/);
    assert.match(evaluar(contexto, "efectoEnNotas({ vispera: '2026-11-25' }, null)"), /por adelantado el 25\/11\/2026/);
    assert.match(evaluar(contexto, 'efectoEnNotas(null, null)'), /último día hábil anterior/);
  });
});
