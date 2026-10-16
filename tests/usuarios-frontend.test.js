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
      elementos.set(id, {
        id, value: '', textContent: '', hidden: true, disabled: false, oyentes: {}, setAttribute() {}, removeAttribute() {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        addEventListener(tipo, fn) { (this.oyentes[tipo] ??= []).push(fn); }
      });
    }
    return elementos.get(id);
  };
  let alCargar = () => {};
  const document = {
    addEventListener(tipo, fn) { if (tipo === 'DOMContentLoaded') alCargar = fn; },
    getElementById: elemento, querySelectorAll: () => [], querySelector: (selector) => elemento(selector)
  };
  const llamadas = [];
  const pedidos = [];
  // Cualquier API.* queda registrado (con sus argumentos en pedidos) y responde vacío; alPedir ve el estado de la
  // pantalla en el momento del pedido
  const API = new Proxy({}, {
    get: (_, nombre) => async (...args) => {
      alPedir(nombre);
      llamadas.push(nombre);
      pedidos.push({ nombre, args: JSON.parse(JSON.stringify(args)) });
      return { message: '', data: { usuarios: [], resumen: {} } };
    }
  });
  const contexto = vm.createContext({
    document,
    window: { location: {} },
    Utils: { escapeHtml: (texto) => texto },
    Auth: { getUser: () => ({ id: 1 }), isAuthenticated: () => true, isAdmin: () => true },
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
  // alCargar: corre lo que la página hace al cargar (registra los oyentes)
  return { contexto, elemento, formulario, llamadas, pedidos, alCargar: () => alCargar() };
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

  it('efecto de una licencia en curso: lo que pasa ahora, sin el anticipo de una víspera pasada', () => {
    const { contexto } = cargarPanel();
    const licencia = "{ desde: '2026-11-26', vispera: '2026-11-25' }";
    const conAutorizado = evaluar(contexto, `efectoEnNotas(${licencia}, 'Persona Autorizada', '2026-12-02')`);
    assert.match(conAutorizado, /Licencia en curso: Persona Autorizada presenta las notas con las dos firmas/);
    const sinAutorizado = evaluar(contexto, `efectoEnNotas(${licencia}, null, '2026-12-02')`);
    assert.match(sinAutorizado, /no se generan notas hasta la vuelta/);
    assert.match(sinAutorizado, /las reiteraciones salen el primer día hábil después de la licencia/);
    for (const texto of [conAutorizado, sinAutorizado]) assert.doesNotMatch(texto, /por adelantado|Cargá la licencia/);
    // Una licencia que empieza hoy ya está en curso; una futura, como siempre
    assert.match(evaluar(contexto, `efectoEnNotas(${licencia}, null, '2026-11-26')`), /Licencia en curso/);
    assert.match(evaluar(contexto, `efectoEnNotas(${licencia}, null, '2026-11-10')`), /por adelantado el 25\/11\/2026/);
  });

  const TITULAR = 1;
  const LICENCIA = {
    id: 9, usuario_id: TITULAR, usuario_nombre: 'Persona Titular', desde: '2026-11-26', hasta: '2027-01-14', estado: 'futura',
    vispera: '2026-11-25', autorizado_id: 8, autorizado_nombre: 'Persona Vieja'
  };
  // La pantalla de Licencias con el titular conectado; licencia: la del modal (null = alta)
  const prepararLicencias = (panel, licencia, hoy = '2026-11-10') => {
    panel.contexto.__datos = {
      hoy, firmante_titular_id: TITULAR, soy_titular: true, licencias: [], usuarios: [],
      autorizables: [{ id: 5, nombre_completo: 'Persona Nueva' }]
    };
    panel.contexto.__licencia = licencia;
    evaluar(panel.contexto, 'datosLicencias = __datos; licenciaAbierta = __licencia');
    panel.elemento('l-usuario').value = String(TITULAR);
    panel.elemento('l-desde').value = licencia?.desde ?? '';
    panel.elemento('l-hasta').value = licencia?.hasta ?? '';
  };
  const guardar = async (panel) => {
    await panel.contexto.guardarLicencia({ preventDefault() {} });
    return panel.pedidos.find(p => p.nombre === 'editarLicencia' || p.nombre === 'crearLicencia');
  };

  it('la persona autorizada que ya no cumple las condiciones sigue elegida y marcada, y no se manda si no se cambia', async () => {
    const panel = cargarPanel();
    prepararLicencias(panel, LICENCIA);
    panel.contexto.prepararAutorizado();
    const selector = panel.elemento('l-autorizado');
    assert.ok(selector.innerHTML.includes('<option value="8">Persona Vieja (ya no cumple las condiciones)</option>'));
    assert.ok(selector.innerHTML.includes('<option value="5">Persona Nueva</option>'));
    assert.equal(selector.value, '8');
    panel.elemento('l-hasta').value = '2027-01-20';
    assert.deepEqual((await guardar(panel)).args, [9, { desde: '2026-11-26', hasta: '2027-01-20' }]);
  });

  it('la persona autorizada se manda cuando cambia: otra persona o nadie; en el alta, solo si se eligió una', async () => {
    const casos = [
      { licencia: LICENCIA, elegido: '5', esperado: [9, { desde: '2026-11-26', hasta: '2027-01-14', autorizado_id: '5' }] },
      { licencia: LICENCIA, elegido: '', esperado: [9, { desde: '2026-11-26', hasta: '2027-01-14', autorizado_id: null }] },
      { licencia: null, elegido: '', esperado: [{ desde: '2026-12-01', hasta: '2026-12-10', usuario_id: TITULAR }] },
      { licencia: null, elegido: '5', esperado: [{ desde: '2026-12-01', hasta: '2026-12-10', autorizado_id: '5', usuario_id: TITULAR }] }
    ];
    for (const { licencia, elegido, esperado } of casos) {
      const panel = cargarPanel();
      prepararLicencias(panel, licencia);
      if (!licencia) {
        panel.elemento('l-desde').value = '2026-12-01';
        panel.elemento('l-hasta').value = '2026-12-10';
      }
      panel.contexto.prepararAutorizado();
      panel.elemento('l-autorizado').value = elegido;
      assert.deepEqual((await guardar(panel)).args, esperado, JSON.stringify({ licencia: licencia?.id ?? null, elegido }));
    }
  });

  it('el efecto se actualiza al cambiar la fecha de inicio', () => {
    const panel = cargarPanel();
    panel.alCargar();
    prepararLicencias(panel, null, '2026-12-02');
    const desde = panel.elemento('l-desde');
    assert.ok(desde.oyentes.input?.length, 'l-desde tiene un oyente');
    const cambiarDesde = (valor) => {
      desde.value = valor;
      for (const oyente of desde.oyentes.input) oyente({ target: desde });
      return panel.elemento('licencia-efecto').textContent;
    };
    assert.match(cambiarDesde('2026-12-02'), /Licencia en curso sin persona autorizada/);
    assert.match(cambiarDesde('2026-12-20'), /por adelantado el último día hábil anterior/);
  });

  it('después de guardar o anular, recarga las terminadas y anuladas si ese grupo está abierto', async () => {
    const panel = cargarPanel();
    panel.elemento('grupo-licencias-pasadas').open = true;
    const recargoPasadas = () => panel.pedidos.some(p => p.nombre === 'getLicencias' && p.args[0] === true);
    prepararLicencias(panel, LICENCIA);
    await guardar(panel);
    assert.ok(recargoPasadas(), 'al guardar');
    panel.pedidos.length = 0;
    prepararLicencias(panel, LICENCIA);
    await panel.contexto.anularLicencia();
    assert.ok(panel.pedidos.some(p => p.nombre === 'anularLicencia'));
    assert.ok(recargoPasadas(), 'al anular');
  });

  it('historial de una edición de licencia: el cambio de fechas y el de la persona autorizada', () => {
    const { contexto } = cargarPanel();
    contexto.__usuarios = [{ id: 5, nombre_completo: 'Persona Nueva' }, { id: 8, nombre_completo: 'Persona Vieja' }];
    evaluar(contexto, 'usuarios = __usuarios');
    const detalle = (antes, despues) => contexto.describirDetalle({ accion: 'licencia_editada', detalle: { licencia_id: 9, antes, despues } });
    const fechas = { desde: '2026-11-26', hasta: '2027-01-14' };
    const otras = { desde: '2026-11-26', hasta: '2027-01-20' };
    assert.equal(detalle({ ...fechas, autorizado_id: null }, { ...fechas, autorizado_id: 5 }), 'Persona autorizada: nadie → Persona Nueva');
    assert.equal(detalle({ ...fechas, autorizado_id: 5 }, { ...otras, autorizado_id: 5 }), 'Del 26/11/2026 al 14/01/2027 → Del 26/11/2026 al 20/01/2027');
    assert.equal(
      detalle({ ...fechas, autorizado_id: 8 }, { ...otras, autorizado_id: 99 }),
      'Del 26/11/2026 al 14/01/2027 → Del 26/11/2026 al 20/01/2027; Persona autorizada: Persona Vieja → otro usuario'
    );
    assert.equal(detalle({ ...fechas, autorizado_id: 5 }, { ...fechas, autorizado_id: null }), 'Persona autorizada: Persona Nueva → nadie');
  });
});
