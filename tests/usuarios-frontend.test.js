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
// respuestas: { nombreDelMetodo: (...args) => respuesta } para los métodos de API que el test quiere contestar
const cargarPanel = (abierto = USUARIO, alPedir = () => {}, rol = 'admin', respuestas = {}) => {
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
      if (respuestas[nombre]) return respuestas[nombre](...args);
      return { message: '', data: { usuarios: [], resumen: {} } };
    }
  });
  // Los temporizadores no corren solos: el test decide cuándo vence cada uno
  const programados = [];
  const contexto = vm.createContext({
    document,
    window: { location: {} },
    Utils: { escapeHtml: (texto) => texto },
    Auth: { getUser: () => ({ id: 1 }), getRole: () => rol, isAuthenticated: () => true, isAdmin: () => true },
    API,
    showToast() {},
    confirm: () => { llamadas.push('confirm'); return true; },
    setTimeout: (fn, ms) => { programados.push({ fn, ms, activo: true }); return programados.length; },
    clearTimeout: (id) => { if (programados[id - 1]) programados[id - 1].activo = false; },
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
  // vencen los temporizadores que siguen activos y espera lo que ellos disparan
  const vencerProgramados = () => Promise.all(programados.filter(p => p.activo).map(p => { p.activo = false; return p.fn(); }));
  // alCargar: corre lo que la página hace al cargar (registra los oyentes)
  return { contexto, elemento, formulario, llamadas, pedidos, programados, vencerProgramados, alCargar: () => alCargar() };
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
    assert.match(conAutorizado, /vuelve a presentar cada aviso en su fecha/);
    assert.match(evaluar(contexto, "efectoEnNotas({ vispera: '2026-11-25' }, null)"), /por adelantado el 25\/11\/2026/);
    assert.match(evaluar(contexto, 'efectoEnNotas(null, null)'), /último día hábil anterior/);
  });

  it('efecto de una licencia en curso: lo que pasa ahora, sin el anticipo de una víspera pasada', () => {
    const { contexto } = cargarPanel();
    const licencia = "{ desde: '2026-11-26', vispera: '2026-11-25' }";
    const conAutorizado = evaluar(contexto, `efectoEnNotas(${licencia}, 'Persona Autorizada', '2026-12-02')`);
    assert.match(conAutorizado, /Licencia en curso: Persona Autorizada presenta las notas con las dos firmas/);
    assert.match(conAutorizado, /vuelve a presentar en su fecha cada aviso que se adelantó/);
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

  describe('persona autorizada con licencia propia dentro de la del titular (spec 6.3)', () => {
    const NOMBRE = 'Persona Autorizada';
    // El titular tiene licencia del 01/03/2027 al 31/03/2027
    const DESDE = '2027-03-01';
    const HASTA = '2027-03-31';
    // La lista sale del contexto aislado (otro Array): se copia para poder compararla con deepEqual. ausencias: como llegan
    // en autorizables, ya unidas por el servidor y con vuelve, el primer día hábil después de cada una
    const textos = (contexto, ausencias, desde = DESDE, hasta = HASTA, nombre = NOMBRE) => JSON.parse(JSON.stringify(
      vm.runInContext(`textoAusenciasAutorizado(${JSON.stringify(nombre)}, ${JSON.stringify(ausencias)}, ${JSON.stringify(desde)}, ${JSON.stringify(hasta)})`, contexto)));
    const ausencia = (desde, hasta, vuelve) => ({ desde, hasta, vuelve });

    describe('textoAusenciasAutorizado', () => {
      it('superposición en el medio: avisa que no hay notas y desde cuándo las presenta, el día hábil en que vuelve', () => {
        const { contexto } = cargarPanel();
        // Termina el viernes 12/03: vuelve el lunes 15/03, no el sábado
        assert.deepEqual(textos(contexto, [ausencia('2027-03-08', '2027-03-12', '2027-03-15')]), [
          `${NOMBRE} va a estar de licencia del 08/03/2027 al 12/03/2027: esos días no se generan notas. Desde el 15/03/2027 las presenta en tu nombre.`
        ]);
      });

      it('al principio de la licencia del titular: se recorta al inicio de la licencia del titular', () => {
        const { contexto } = cargarPanel();
        assert.deepEqual(textos(contexto, [ausencia('2027-02-22', '2027-03-03', '2027-03-04')]), [
          `${NOMBRE} va a estar de licencia del 01/03/2027 al 03/03/2027: esos días no se generan notas. Desde el 04/03/2027 las presenta en tu nombre.`
        ]);
      });

      it('al final de la licencia del titular: sin "Desde el", porque no vuelve antes de que termine', () => {
        const { contexto } = cargarPanel();
        assert.deepEqual(textos(contexto, [ausencia('2027-03-25', '2027-04-10', '2027-04-12')]), [
          `${NOMBRE} va a estar de licencia del 25/03/2027 al 31/03/2027: esos días no se generan notas.`
        ]);
        // Que termine justo el último día también cuenta como "hasta el final"
        assert.deepEqual(textos(contexto, [ausencia('2027-03-25', '2027-03-31', '2027-04-01')]), [
          `${NOMBRE} va a estar de licencia del 25/03/2027 al 31/03/2027: esos días no se generan notas.`
        ]);
        // Y que termine el viernes con la licencia del titular hasta el domingo: vuelve el lunes, ya sin licencia del titular
        assert.deepEqual(textos(contexto, [ausencia('2027-03-01', '2027-03-05', '2027-03-08')], DESDE, '2027-03-07'), [
          `${NOMBRE} va a estar de licencia del 01/03/2027 al 05/03/2027: esos días no se generan notas.`
        ]);
        // Si vuelve justo el último día de la licencia del titular, ese día las presenta
        assert.deepEqual(textos(contexto, [ausencia('2027-03-01', '2027-03-05', '2027-03-08')], DESDE, '2027-03-08'), [
          `${NOMBRE} va a estar de licencia del 01/03/2027 al 05/03/2027: esos días no se generan notas. Desde el 08/03/2027 las presenta en tu nombre.`
        ]);
      });

      it('de un solo día: "el dd/mm/aaaa: ese día", con el "Desde el" si corresponde', () => {
        const { contexto } = cargarPanel();
        assert.deepEqual(textos(contexto, [ausencia('2027-03-10', '2027-03-10', '2027-03-11')]), [
          `${NOMBRE} va a estar de licencia el 10/03/2027: ese día no se generan notas. Desde el 11/03/2027 las presenta en tu nombre.`
        ]);
        // Un solo día de una licencia más larga, justo el último de la del titular
        assert.deepEqual(textos(contexto, [ausencia('2027-03-31', '2027-04-05', '2027-04-06')]), [
          `${NOMBRE} va a estar de licencia el 31/03/2027: ese día no se generan notas.`
        ]);
        // Un solo día por el borde del titular (la licencia de la persona autorizada empieza antes y termina el primer día)
        assert.deepEqual(textos(contexto, [ausencia('2027-02-20', '2027-03-01', '2027-03-02')]), [
          `${NOMBRE} va a estar de licencia el 01/03/2027: ese día no se generan notas. Desde el 02/03/2027 las presenta en tu nombre.`
        ]);
      });

      it('varias ausencias: un texto por superposición, en orden de fecha', () => {
        const { contexto } = cargarPanel();
        assert.deepEqual(textos(contexto, [
          ausencia('2027-03-22', '2027-03-24', '2027-03-25'),
          ausencia('2027-03-03', '2027-03-05', '2027-03-08')
        ]), [
          `${NOMBRE} va a estar de licencia del 03/03/2027 al 05/03/2027: esos días no se generan notas. Desde el 08/03/2027 las presenta en tu nombre.`,
          `${NOMBRE} va a estar de licencia del 22/03/2027 al 24/03/2027: esos días no se generan notas. Desde el 25/03/2027 las presenta en tu nombre.`
        ]);
      });

      it('las ausencias llegan unidas del servidor (separadas solo por días no hábiles): el formulario no las vuelve a unir', () => {
        const { contexto } = cargarPanel();
        // Del lunes 01/03 al viernes 05/03 y del lunes 08/03 al viernes 12/03: el servidor manda una sola, hasta el 12/03
        assert.deepEqual(textos(contexto, [ausencia('2027-03-01', '2027-03-12', '2027-03-15')]), [
          `${NOMBRE} va a estar de licencia del 01/03/2027 al 12/03/2027: esos días no se generan notas. Desde el 15/03/2027 las presenta en tu nombre.`
        ]);
        // Con un día hábil libre en el medio (el lunes 08/03), dos: ese día las presenta
        assert.deepEqual(textos(contexto, [
          ausencia('2027-03-03', '2027-03-05', '2027-03-08'),
          ausencia('2027-03-09', '2027-03-10', '2027-03-11')
        ]), [
          `${NOMBRE} va a estar de licencia del 03/03/2027 al 05/03/2027: esos días no se generan notas. Desde el 08/03/2027 las presenta en tu nombre.`,
          `${NOMBRE} va a estar de licencia del 09/03/2027 al 10/03/2027: esos días no se generan notas. Desde el 11/03/2027 las presenta en tu nombre.`
        ]);
      });

      it('el "Desde el" es el día hábil en que vuelve, que calcula el servidor: después de un feriado, o el día siguiente', () => {
        const { contexto } = cargarPanel();
        // Hasta el jueves 31/12/2026: el 01/01 es feriado y el 02 y el 03, fin de semana
        assert.match(textos(contexto, [ausencia('2026-12-28', '2026-12-31', '2027-01-04')], '2026-12-20', '2027-01-15')[0], /Desde el 04\/01\/2027 las presenta/);
        assert.match(textos(contexto, [ausencia('2027-03-29', '2027-03-30', '2027-03-31')])[0], /Desde el 31\/03\/2027 las presenta/);
      });

      it('sin superposición no hay texto: ninguna ausencia, o ausencias fuera de las fechas elegidas', () => {
        const { contexto } = cargarPanel();
        assert.deepEqual(textos(contexto, []), []);
        assert.deepEqual(textos(contexto, [ausencia('2027-02-01', '2027-02-26', '2027-03-01'), ausencia('2027-04-01', '2027-04-09', '2027-04-12')]), []);
        assert.deepEqual(textos(contexto, undefined), []);
      });

      it('sin la persona o sin alguna de las fechas no hay texto', () => {
        const { contexto } = cargarPanel();
        const ausencias = [ausencia('2027-03-08', '2027-03-12', '2027-03-15')];
        assert.equal(textos(contexto, ausencias).length, 1);
        assert.deepEqual(textos(contexto, ausencias, '', HASTA), []);
        assert.deepEqual(textos(contexto, ausencias, DESDE, ''), []);
        assert.deepEqual(textos(contexto, ausencias, DESDE, HASTA, ''), []);
        assert.deepEqual(textos(contexto, ausencias, DESDE, HASTA, null), []);
      });

      it('con las fechas al revés (hasta antes de desde) no hay texto', () => {
        const { contexto } = cargarPanel();
        assert.deepEqual(textos(contexto, [ausencia('2027-03-08', '2027-03-12', '2027-03-15')], HASTA, DESDE), []);
      });
    });

    describe('aviso del formulario', () => {
      const TITULAR = 1;
      const AUTORIZABLES = [
        {
          id: 5, nombre_completo: NOMBRE,
          licencias: [{ desde: '2027-02-22', hasta: '2027-03-03' }], ausencias: [ausencia('2027-02-22', '2027-03-03', '2027-03-04')]
        },
        { id: 6, nombre_completo: 'Persona Sin Licencia', licencias: [], ausencias: [] },
        {
          id: 7, nombre_completo: 'Persona Con Otra',
          licencias: [{ desde: '2027-03-10', hasta: '2027-03-12' }], ausencias: [ausencia('2027-03-10', '2027-03-12', '2027-03-15')]
        }
      ];
      // El formulario del titular (puede autorizar); licencia: la del modal (null = alta). Devuelve el panel con los
      // oyentes de la página registrados
      const abrir = (panel, { licencia = null, soyTitular = true, desde = DESDE, hasta = HASTA } = {}) => {
        panel.alCargar();
        panel.contexto.__datos = {
          hoy: '2027-02-15', firmante_titular_id: TITULAR, soy_titular: soyTitular, licencias: [], usuarios: [], autorizables: AUTORIZABLES
        };
        panel.contexto.__licencia = licencia;
        evaluar(panel.contexto, 'datosLicencias = __datos; licenciaAbierta = __licencia');
        panel.elemento('l-usuario').value = String(TITULAR);
        panel.elemento('l-desde').value = desde;
        panel.elemento('l-hasta').value = hasta;
        panel.contexto.prepararAutorizado();
        panel.pedidos.length = 0;
      };
      const caja = (panel) => panel.elemento('l-ausencias-autorizado');
      const disparar = (panel, id, tipo) => {
        assert.ok(panel.elemento(id).oyentes[tipo]?.length, `${id} tiene un oyente de ${tipo}`);
        for (const oyente of panel.elemento(id).oyentes[tipo]) oyente({ target: panel.elemento(id) });
      };
      const elegir = (panel, id) => {
        panel.elemento('l-autorizado').value = id;
        disparar(panel, 'l-autorizado', 'change');
      };

      it('sin persona elegida ("Nadie") no hay aviso', () => {
        const panel = cargarPanel();
        abrir(panel);
        assert.equal(panel.elemento('l-autorizado').value, '');
        assert.equal(caja(panel).hidden, true);
        assert.equal(caja(panel).innerHTML ?? '', '');
      });

      it('al elegir a la persona autorizada con una licencia superpuesta, muestra el aviso', () => {
        const panel = cargarPanel();
        abrir(panel);
        elegir(panel, '5');
        assert.equal(caja(panel).hidden, false);
        assert.equal(caja(panel).innerHTML,
          `<p>${NOMBRE} va a estar de licencia del 01/03/2027 al 03/03/2027: esos días no se generan notas. Desde el 04/03/2027 las presenta en tu nombre.</p>`);
      });

      it('usa las ausencias que calcula el servidor, no las licencias una por una', () => {
        const panel = cargarPanel();
        abrir(panel);
        // Dos licencias con un fin de semana en el medio: el servidor las manda como una sola ausencia
        panel.contexto.__datos.autorizables = [{
          id: 5, nombre_completo: NOMBRE,
          licencias: [{ desde: '2027-03-01', hasta: '2027-03-05' }, { desde: '2027-03-08', hasta: '2027-03-12' }],
          ausencias: [ausencia('2027-03-01', '2027-03-12', '2027-03-15')]
        }];
        elegir(panel, '5');
        assert.equal(caja(panel).innerHTML,
          `<p>${NOMBRE} va a estar de licencia del 01/03/2027 al 12/03/2027: esos días no se generan notas. Desde el 15/03/2027 las presenta en tu nombre.</p>`);
      });

      it('al cambiar de persona, el aviso cambia o se oculta', () => {
        const panel = cargarPanel();
        abrir(panel);
        elegir(panel, '5');
        elegir(panel, '7');
        assert.equal(caja(panel).hidden, false);
        assert.match(caja(panel).innerHTML, /Persona Con Otra va a estar de licencia del 10\/03\/2027 al 12\/03\/2027/);
        elegir(panel, '6');
        assert.equal(caja(panel).hidden, true);
        elegir(panel, '5');
        assert.equal(caja(panel).hidden, false);
        elegir(panel, '');
        assert.equal(caja(panel).hidden, true);
      });

      it('al cambiar "desde" o "hasta" se vuelve a calcular, sin llamar a la API', () => {
        const panel = cargarPanel();
        abrir(panel);
        elegir(panel, '5');
        assert.equal(caja(panel).hidden, false);
        // Un "desde" posterior a la licencia de la persona autorizada: ya no se superponen
        panel.elemento('l-desde').value = '2027-03-04';
        disparar(panel, 'l-desde', 'input');
        assert.equal(caja(panel).hidden, true);
        panel.elemento('l-desde').value = '2027-03-02';
        disparar(panel, 'l-desde', 'input');
        assert.match(caja(panel).innerHTML, /del 02\/03\/2027 al 03\/03\/2027: esos días no se generan notas\. Desde el 04\/03\/2027/);
        // Un "hasta" que termina antes de que vuelva: su licencia cubre hasta el final
        panel.elemento('l-hasta').value = '2027-03-03';
        disparar(panel, 'l-hasta', 'input');
        assert.equal(caja(panel).innerHTML, `<p>${NOMBRE} va a estar de licencia del 02/03/2027 al 03/03/2027: esos días no se generan notas.</p>`);
        // Fecha incompleta: nada
        panel.elemento('l-hasta').value = '';
        disparar(panel, 'l-hasta', 'input');
        assert.equal(caja(panel).hidden, true);
        assert.deepEqual(panel.pedidos.filter(p => p.nombre !== 'getSinAuditor'), []);
      });

      it('al abrir una licencia guardada con persona autorizada, el aviso aparece enseguida', () => {
        const panel = cargarPanel();
        const licencia = { id: 9, usuario_id: TITULAR, usuario_nombre: 'Persona Titular', desde: DESDE, hasta: HASTA, estado: 'futura', vispera: '2027-02-26', autorizado_id: 5, autorizado_nombre: NOMBRE };
        panel.alCargar();
        panel.contexto.__datos = {
          hoy: '2027-02-15', firmante_titular_id: TITULAR, soy_titular: true, licencias: [], usuarios: [{ id: TITULAR, nombre_completo: 'Persona Titular' }], autorizables: AUTORIZABLES
        };
        evaluar(panel.contexto, 'datosLicencias = __datos');
        panel.contexto.abrirModalLicencia(licencia);
        assert.equal(caja(panel).hidden, false);
        assert.match(caja(panel).innerHTML, /Persona Autorizada va a estar de licencia del 01\/03\/2027 al 03\/03\/2027/);
      });

      it('si quien edita no es el titular (no elige a la persona autorizada), no hay aviso', () => {
        const panel = cargarPanel();
        abrir(panel, { soyTitular: false });
        assert.equal(panel.elemento('grupo-autorizado').hidden, true);
        assert.equal(caja(panel).hidden, true);
      });

      it('se oculta al pasar a una licencia de otra persona', () => {
        const panel = cargarPanel();
        abrir(panel);
        elegir(panel, '5');
        assert.equal(caja(panel).hidden, false);
        panel.elemento('l-usuario').value = '99';
        disparar(panel, 'l-usuario', 'change');
        assert.equal(caja(panel).hidden, true);
      });

      it('todo dato pasa por escapeHtml', () => {
        const panel = cargarPanel();
        panel.contexto.Utils.escapeHtml = (t) => String(t).replace(/</g, '&lt;').replace(/>/g, '&gt;');
        abrir(panel);
        panel.contexto.__datos.autorizables = [{
          id: 5, nombre_completo: '<b>Persona</b>',
          licencias: [{ desde: '2027-03-08', hasta: '2027-03-12' }], ausencias: [ausencia('2027-03-08', '2027-03-12', '2027-03-15')]
        }];
        elegir(panel, '5');
        assert.ok(caja(panel).innerHTML.includes('&lt;b&gt;Persona&lt;/b&gt; va a estar de licencia'));
        assert.ok(!caja(panel).innerHTML.includes('<b>'));
      });

      it('no bloquea el guardado: guarda con el aviso a la vista', async () => {
        const panel = cargarPanel();
        abrir(panel);
        elegir(panel, '5');
        assert.equal(caja(panel).hidden, false);
        await panel.contexto.guardarLicencia({ preventDefault() {} });
        assert.deepEqual(panel.pedidos.find(p => p.nombre === 'crearLicencia').args,
          [{ desde: DESDE, hasta: HASTA, autorizado_id: '5', usuario_id: TITULAR }]);
        assert.equal(panel.elemento('btn-guardar-licencia').disabled, false);
      });

      it('si el servidor responde el 409 de la licencia que cubre todos los días hábiles, se muestra como cualquier error del formulario', async () => {
        const mensaje = 'La persona autorizada está de licencia todos los días hábiles de tu licencia: no podría presentar ninguna nota.';
        const panel = cargarPanel(USUARIO, () => {}, 'admin', { crearLicencia: () => { throw new Error(mensaje); } });
        abrir(panel);
        elegir(panel, '5');
        await panel.contexto.guardarLicencia({ preventDefault() {} });
        assert.equal(panel.elemento('licencia-error').textContent, mensaje);
        assert.equal(panel.elemento('licencia-error').hidden, false);
        assert.equal(panel.elemento('btn-guardar-licencia').disabled, false);
      });
    });
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

describe('editor (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);
  const aviso = (contexto, u) => evaluar(contexto, `avisoSoloLectura(${JSON.stringify(u)})`);

  it('un editor solo modifica lectores y colaboradores: los demás se ven con el aviso y sin acciones', () => {
    const { contexto } = cargarPanel(USUARIO, () => {}, 'editor');
    assert.equal(aviso(contexto, { id: 7, rol: 'lector' }), null);
    assert.equal(aviso(contexto, { id: 11, rol: 'colaborador' }), null);
    assert.equal(aviso(contexto, { id: 8, rol: 'admin' }), 'Como editor, solo podés modificar usuarios lectores y colaboradores.');
    assert.equal(aviso(contexto, { id: 9, rol: 'editor' }), 'Como editor, solo podés modificar usuarios lectores y colaboradores.');
    assert.equal(aviso(contexto, { id: 10, rol: 'superadmin' }), 'Esta cuenta solo la modifica su titular.');
    assert.equal(aviso(contexto, null), null);
  });

  it('un admin modifica a todos, salvo la cuenta del superadmin', () => {
    const { contexto } = cargarPanel();
    assert.equal(aviso(contexto, { id: 8, rol: 'admin' }), null);
    assert.equal(aviso(contexto, { id: 9, rol: 'editor' }), null);
    assert.equal(aviso(contexto, { id: 10, rol: 'superadmin' }), 'Esta cuenta solo la modifica su titular.');
  });

  it('en el alta, el rol va siempre, aunque el selector esté deshabilitado', async () => {
    const panel = cargarPanel(null, () => {}, 'editor');
    panel.formulario({ nombre_completo: 'Persona Nueva', username: 'PNUEVA', email: 'pnueva@rpad.test' });
    panel.elemento('u-rol').value = 'lector';
    panel.elemento('u-rol').disabled = true;
    await panel.contexto.guardarUsuario({ preventDefault() {} });
    const pedido = panel.pedidos.find(p => p.nombre === 'crearUsuario');
    assert.equal(pedido.args[0].rol, 'lector');
  });

  it('textos de la confirmación al cambiar el rol', () => {
    const { contexto } = cargarPanel();
    const texto = (u, rol) => evaluar(contexto, `textoCambioDeRol(${JSON.stringify(u)}, '${rol}')`);
    const otro = { id: 7, nombre_completo: 'Persona de Prueba' };
    // El editor audita de respaldo y, los cambios de los auditores, sin responsabilidad (spec 2026-10-20-editor-sin-responsabilidad)
    assert.equal(texto(otro, 'editor'), 'Persona de Prueba va a pasar a Editor: podrá proponer cambios y auditarlos de respaldo, '
      + 'cuando no haya auditores disponibles, y sin responsabilidad por la auditoría los de los auditores. ¿Continuar?');
    assert.match(texto(otro, 'admin'), /va a pasar a Admin: podrá proponer y aprobar cambios/);
    assert.match(texto(otro, 'lector'), /va a pasar a Lector/);
    assert.equal(texto({ id: 1 }, 'editor'), 'Vas a pasar a Editor: dejás de ser auditor. Vas a poder auditar de respaldo, cuando no '
      + 'haya auditores disponibles, y sin responsabilidad por la auditoría los cambios de los auditores. ¿Continuar?');
    assert.match(texto({ id: 1 }, 'lector'), /^Vas a perder el acceso de administrador/);
  });

  it('el grupo Editores dice que auditan de respaldo o sin responsabilidad', () => {
    const PAGINA = fs.readFileSync(new URL('../public/usuarios.html', import.meta.url), 'utf8');
    assert.ok(PAGINA.includes('<span class="grupo-contador">Proponen cambios y auditan de respaldo o sin responsabilidad</span>'));
  });
});

describe('colaborador (spec 2026-10-24-notas-dgmit, 1)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);
  const PAGINA = fs.readFileSync(new URL('../public/usuarios.html', import.meta.url), 'utf8');
  const AYUDAS = {
    lector: '<b>Lector:</b> Ve los datos públicos y usa las Herramientas (Reportes, Notas, Gestión y Seguimiento). No modifica nada.',
    colaborador: '<b>Colaborador:</b> Ve todo lo que ve un lector y, además, carga las notas DGMIT en el Seguimiento (y corrige o anula '
      + 'las que cargó). No modifica datasets ni audita cambios.',
    editor: '<b>Editor:</b> Todo lo de un administrador, pero audita cambios de respaldo y en Usuarios solo crea y modifica lectores y '
      + 'colaboradores.',
    admin: '<b>Admin:</b> Propone y audita cambios en los datasets, maneja áreas, usuarios, reportes y notificaciones. También carga '
      + 'notas DGMIT.'
  };
  // El selector de rol con sus opciones, en el orden de la página (abrirModal las muestra u oculta). Devuelve las visibles; las
  // ocultas, además, quedan deshabilitadas
  const conSelectorDeRol = (panel) => {
    const opciones = [...PAGINA.matchAll(/<option value="(lector|colaborador|editor|admin|superadmin)"/g)]
      .map(m => ({ value: m[1], hidden: false, disabled: false }));
    panel.elemento('u-rol').options = opciones;
    return () => {
      for (const o of opciones) assert.equal(o.disabled, o.hidden, `${o.value}: oculta y deshabilitada, o ninguna de las dos`);
      return opciones.filter(o => !o.hidden).map(o => o.value);
    };
  };
  // Las filas de la lista llaman a estas ayudas de api.js y main.js
  const conAyudasDeLaLista = (panel) => {
    Object.assign(panel.contexto.Utils, { textoCargo: (cargo) => cargo ?? '', textoVinculo: (vinculo) => vinculo ?? '' });
    panel.contexto.getInitials = (nombre) => nombre.slice(0, 2);
  };

  it('los colaboradores tienen su grupo, entre Editores y Solo lectura, y no aparecen entre los de solo lectura', () => {
    const posicion = (texto) => PAGINA.indexOf(texto);
    assert.ok(PAGINA.includes('<h2 id="titulo-colaboradores">Colaboradores</h2>'));
    assert.ok(posicion('id="titulo-editores"') < posicion('id="titulo-colaboradores"'), 'después de Editores');
    assert.ok(posicion('id="titulo-colaboradores"') < posicion('id="titulo-lectores"'), 'antes de Solo lectura');
    assert.match(PAGINA, /<section class="grupo-usuarios" aria-labelledby="titulo-colaboradores">[\s\S]*?<span class="grupo-contador" id="contador-colaboradores"><\/span>[\s\S]*?<div id="lista-colaboradores"><\/div>\s*<\/section>/);

    const panel = cargarPanel(null);
    conAyudasDeLaLista(panel);
    panel.contexto.__usuarios = [
      { id: 1, nombre_completo: 'Persona Lectora', username: 'PLECTORA', rol: 'lector', estado: 'activo', email_valido: true },
      { id: 2, nombre_completo: 'Persona Colaboradora', username: 'PCOLAB', rol: 'colaborador', estado: 'activo', email_valido: true },
      { id: 3, nombre_completo: 'Persona Dada de Baja', username: 'PBAJA', rol: 'colaborador', estado: 'desactivado', email_valido: true },
      { id: 4, nombre_completo: 'Persona Editora', username: 'PEDITORA', rol: 'editor', estado: 'activo', email_valido: true }
    ];
    evaluar(panel.contexto, 'usuarios = __usuarios');
    panel.contexto.renderLista();
    const lista = (id) => panel.elemento(id).innerHTML;
    assert.match(lista('lista-colaboradores'), /Persona Colaboradora/);
    assert.match(lista('lista-colaboradores'), /<span class="etiqueta rol-colaborador">Colaborador<\/span>/);
    assert.doesNotMatch(lista('lista-colaboradores'), /Persona Lectora|Persona Dada de Baja|Persona Editora/);
    assert.match(lista('lista-lectores'), /Persona Lectora/);
    assert.doesNotMatch(lista('lista-lectores'), /Persona Colaboradora/);
    assert.doesNotMatch(lista('lista-editores'), /Persona Colaboradora/);
    assert.match(lista('lista-desactivados'), /Persona Dada de Baja/);
    assert.equal(panel.elemento('contador-colaboradores').textContent, '1 activo');
    assert.equal(panel.elemento('contador-lectores').textContent, '1 activo');

    // Sin colaboradores, o con una búsqueda que no encuentra ninguno
    panel.elemento('buscar-usuario').value = 'lectora';
    panel.contexto.renderLista();
    assert.equal(lista('lista-colaboradores'), '<p class="lista-vacia">Ningún colaborador coincide con la búsqueda.</p>');
    panel.elemento('buscar-usuario').value = '';
    evaluar(panel.contexto, 'usuarios = __usuarios.filter(u => u.rol !== "colaborador")');
    panel.contexto.renderLista();
    assert.equal(lista('lista-colaboradores'), '<p class="lista-vacia">No hay colaboradores.</p>');
    assert.equal(panel.elemento('contador-colaboradores').textContent, '0 activos');
  });

  it('la ayuda de cada rol', () => {
    const panel = cargarPanel(null);
    assert.deepEqual(JSON.parse(JSON.stringify(evaluar(panel.contexto, 'Object.keys(AYUDA_DEL_ROL)'))), ['lector', 'colaborador', 'editor', 'admin']);
    for (const [rol, html] of Object.entries(AYUDAS)) assert.equal(evaluar(panel.contexto, `htmlDeAyudaDelRol('${rol}')`), html, rol);
    // La cuenta del superadmin solo la modifica su titular: no lleva línea
    assert.equal(evaluar(panel.contexto, "htmlDeAyudaDelRol('superadmin')"), '');
    assert.equal(evaluar(panel.contexto, "htmlDeAyudaDelRol('constructor')"), '');

    // En la página: debajo del selector, unida por aria-describedby, y el selector con Colaborador entre Lector y Editor
    assert.match(PAGINA, /<select id="u-rol" class="form-input" aria-describedby="u-rol-ayuda">/);
    assert.match(PAGINA, /<\/select>[\s\S]*?<p class="rol-ayuda" id="u-rol-ayuda"><\/p>/);
    assert.deepEqual([...PAGINA.matchAll(/<option value="(lector|colaborador|editor|admin|superadmin)"[^>]*>([^<]+)</g)].map(m => `${m[1]}:${m[2]}`),
      ['lector:Lector', 'colaborador:Colaborador', 'editor:Editor', 'admin:Admin', 'superadmin:Superadmin']);

    // Cambia al elegir otro rol
    panel.alCargar();
    const selector = panel.elemento('u-rol');
    const ayuda = panel.elemento('u-rol-ayuda');
    assert.ok(selector.oyentes.change?.length, 'u-rol tiene un oyente de change');
    const elegir = (rol) => {
      selector.value = rol;
      for (const oyente of selector.oyentes.change) oyente({ target: selector });
    };
    elegir('colaborador');
    assert.equal(ayuda.innerHTML, AYUDAS.colaborador);
    assert.equal(ayuda.hidden, false);
    elegir('superadmin');
    assert.equal(ayuda.innerHTML, '');
    assert.equal(ayuda.hidden, true);

    // Y al abrir a un usuario, la del rol que tiene
    const visibles = conSelectorDeRol(panel);
    panel.contexto.abrirModal({ ...USUARIO, rol: 'editor' });
    assert.equal(ayuda.innerHTML, AYUDAS.editor);
    assert.equal(ayuda.hidden, false);
    assert.deepEqual(visibles(), ['lector', 'colaborador', 'editor', 'admin'], 'el admin ve los cuatro roles, sin Superadmin');
  });

  it('el editor puede modificar un colaborador y solo ofrece Lector y Colaborador', async () => {
    const { ROLES_DEL_EDITOR } = await import('../services/usuariosReglas.js');
    const colaborador = { ...USUARIO, id: 11, rol: 'colaborador' };
    const panel = cargarPanel(colaborador, () => {}, 'editor');
    assert.deepEqual(JSON.parse(JSON.stringify(evaluar(panel.contexto, 'ROLES_DEL_EDITOR'))), ROLES_DEL_EDITOR, 'copia de la regla del servidor');
    const visibles = conSelectorDeRol(panel);

    for (const u of [colaborador, USUARIO, null]) {
      panel.contexto.abrirModal(u);
      const que = u ? u.rol : 'alta';
      assert.equal(panel.elemento('aviso-protegida').hidden, true, que);
      assert.equal(panel.elemento('u-rol').disabled, false, que);
      assert.equal(panel.elemento('acciones-form').hidden, false, que);
      assert.deepEqual(visibles(), ['lector', 'colaborador'], que);
      assert.equal(panel.elemento('u-rol').value, u ? u.rol : 'lector', que);
    }

    // Pasa a un lector a colaborador: confirma y manda el rol
    panel.contexto.abrirModal(USUARIO);
    panel.formulario(USUARIO);
    panel.elemento('u-rol').value = 'colaborador';
    await panel.contexto.guardarUsuario({ preventDefault() {} });
    assert.ok(panel.llamadas.includes('confirm'));
    assert.deepEqual(panel.pedidos.find(p => p.nombre === 'actualizarUsuario').args, [7, {
      nombre_completo: USUARIO.nombre_completo, username: USUARIO.username, email: USUARIO.email, cargo: USUARIO.cargo,
      vinculo: USUARIO.vinculo, rol: 'colaborador'
    }]);

    // La confirmación nombra el rol nuevo y lo que cambia
    const texto = (u, rol) => evaluar(panel.contexto, `textoCambioDeRol(${JSON.stringify(u)}, '${rol}')`);
    assert.equal(texto(USUARIO, 'colaborador'),
      'Persona de Prueba va a pasar a Colaborador: podrá cargar notas DGMIT en el Seguimiento, pero no proponer ni aprobar cambios. ¿Continuar?');
    assert.equal(texto(colaborador, 'lector'), 'Persona de Prueba va a pasar a Lector: deja de poder cargar notas DGMIT. ¿Continuar?');
  });

  it('el editor no puede modificar un editor ni un admin', () => {
    const panel = cargarPanel(null, () => {}, 'editor');
    const visibles = conSelectorDeRol(panel);
    for (const rol of ['editor', 'admin']) {
      panel.contexto.abrirModal({ ...USUARIO, id: 20, rol });
      assert.equal(panel.elemento('aviso-protegida').hidden, false, rol);
      assert.equal(panel.elemento('aviso-protegida').textContent, 'Como editor, solo podés modificar usuarios lectores y colaboradores.', rol);
      assert.equal(panel.elemento('u-rol').disabled, true, rol);
      assert.equal(panel.elemento('u-nombre').disabled, true, rol);
      assert.equal(panel.elemento('acciones-form').hidden, true, rol);
      // El selector, deshabilitado, muestra el rol que tiene
      assert.equal(panel.elemento('u-rol').value, rol);
      assert.deepEqual(visibles(), ['lector', 'colaborador', rol], rol);
    }
  });

  it('quien se pasa a sí mismo a colaborador deja la administración', async () => {
    const yo = { ...USUARIO, id: 1, rol: 'admin' };
    const panel = cargarPanel(yo);
    conSelectorDeRol(panel);
    panel.contexto.abrirModal(yo);
    panel.formulario(yo);
    panel.elemento('u-rol').value = 'colaborador';
    await panel.contexto.guardarUsuario({ preventDefault() {} });
    assert.ok(panel.pedidos.some(p => p.nombre === 'actualizarUsuario'));
    assert.equal(panel.contexto.window.location.href, 'index.html');
  });
});

describe('días sin auditor (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.5)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);
  const texto = (contexto, periodo) => evaluar(contexto, `textoSinAuditor(${JSON.stringify(periodo)})`);
  const PERIODO = { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: [] };

  describe('textoSinAuditor', () => {
    it('varios días: el período, el aviso y hasta cuándo quedan pendientes', () => {
      const { contexto } = cargarPanel();
      assert.equal(texto(contexto, PERIODO),
        'Del 28/12/2026 al 08/01/2027 no va a haber ningún auditor disponible: los cambios que se propongan en esos días van a quedar pendientes hasta el 11/01/2027.');
    });

    it('un solo día: "El … no va a haber" y "ese día"', () => {
      const { contexto } = cargarPanel();
      assert.equal(texto(contexto, { desde: '2026-12-28', hasta: '2026-12-28', vuelve: '2026-12-29', respaldo: [] }),
        'El 28/12/2026 no va a haber ningún auditor disponible: los cambios que se propongan ese día van a quedar pendientes hasta el 29/12/2026.');
    });

    it('sin fecha de vuelta (vuelve null): hasta que haya un auditor disponible', () => {
      const { contexto } = cargarPanel();
      assert.equal(texto(contexto, { ...PERIODO, vuelve: null }),
        'Del 28/12/2026 al 08/01/2027 no va a haber ningún auditor disponible: los cambios que se propongan en esos días van a quedar pendientes hasta que haya un auditor disponible.');
      assert.equal(texto(contexto, { desde: '2026-12-28', hasta: '2026-12-28', vuelve: null, respaldo: [] }),
        'El 28/12/2026 no va a haber ningún auditor disponible: los cambios que se propongan ese día van a quedar pendientes hasta que haya un auditor disponible.');
    });

    it('con respaldo: nombres separados por coma y "y", con "esos días" o "ese día"', () => {
      const { contexto } = cargarPanel();
      const base = 'Del 28/12/2026 al 08/01/2027 no va a haber ningún auditor disponible: los cambios que se propongan en esos días van a quedar pendientes hasta el 11/01/2027.';
      assert.equal(texto(contexto, { ...PERIODO, respaldo: ['Persona Editora'] }),
        `${base} En esos días solo pueden auditar de respaldo: Persona Editora (nunca un cambio propio).`);
      assert.equal(texto(contexto, { ...PERIODO, respaldo: ['Persona Editora', 'Persona Editor'] }),
        `${base} En esos días solo pueden auditar de respaldo: Persona Editora y Persona Editor (nunca un cambio propio).`);
      assert.equal(texto(contexto, { ...PERIODO, respaldo: ['Persona A', 'Persona B', 'Persona C'] }),
        `${base} En esos días solo pueden auditar de respaldo: Persona A, Persona B y Persona C (nunca un cambio propio).`);
      assert.equal(texto(contexto, { desde: '2026-12-28', hasta: '2026-12-28', vuelve: '2026-12-29', respaldo: ['Persona Editora'] }),
        'El 28/12/2026 no va a haber ningún auditor disponible: los cambios que se propongan ese día van a quedar pendientes hasta el 29/12/2026. En ese día solo pueden auditar de respaldo: Persona Editora (nunca un cambio propio).');
      assert.match(texto(contexto, { ...PERIODO, vuelve: null, respaldo: ['Persona Editora'] }),
        /hasta que haya un auditor disponible\. En esos días solo pueden auditar de respaldo: Persona Editora \(nunca un cambio propio\)\.$/);
    });

    it('sin la lista de respaldo (la API no la mandó), el texto no la menciona', () => {
      const { contexto } = cargarPanel();
      assert.doesNotMatch(texto(contexto, { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11' }), /respaldo/);
    });
  });

  describe('parametrosSinAuditor: lo que se le pide a la API', () => {
    // El objeto sale de otro contexto (vm): para compararlo con deepEqual se pasa por JSON
    const parametros = (pedido) => JSON.parse(JSON.stringify(evaluar(cargarPanel().contexto, `parametrosSinAuditor(${JSON.stringify(pedido)})`)));
    const COMPLETO = { usuarioId: 7, desde: '2026-12-09', hasta: '2027-01-08' };

    it('una licencia nueva: las fechas y la persona, sin excluir', () => {
      assert.deepEqual(parametros(COMPLETO), { desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7 });
    });

    it('al editar, suma excluir con el id de la licencia abierta', () => {
      assert.deepEqual(parametros({ ...COMPLETO, excluir: 9 }), { desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7, excluir: 9 });
    });

    it('fechas incompletas o inválidas, o sin persona: no se pide nada', () => {
      for (const cambio of [
        { desde: '' }, { hasta: '' }, { desde: undefined }, { desde: '2026-02-30' }, { hasta: '2027-13-01' }, { desde: '26-12-09' },
        { desde: '0026-12-09' }, { desde: '2027-01-09' }, { usuarioId: 0 }, { usuarioId: NaN }
      ]) {
        assert.equal(parametros({ ...COMPLETO, ...cambio }), null, JSON.stringify(cambio));
      }
    });

    it('un rango de más de 366 días no se pide (la API lo rechazaría); 366 sí', () => {
      assert.equal(parametros({ ...COMPLETO, desde: '2026-01-01', hasta: '2027-01-02' }), null);
      assert.deepEqual(parametros({ ...COMPLETO, desde: '2026-01-01', hasta: '2027-01-01' }).hasta, '2027-01-01');
    });

    it('los días que ya pasaron no se consultan: el rango empieza hoy', () => {
      assert.deepEqual(parametros({ ...COMPLETO, desde: '2026-12-01', hoy: '2026-12-09' }), { desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7 });
      assert.equal(parametros({ ...COMPLETO, desde: '2026-12-01', hasta: '2026-12-08', hoy: '2026-12-09' }), null);
      assert.equal(parametros({ ...COMPLETO, hoy: '2026-12-01' }).desde, '2026-12-09');
    });
  });

  describe('aviso del formulario de licencias', () => {
    const HOY = '2026-11-10';
    const PERIODOS = [
      PERIODO,
      { desde: '2027-02-01', hasta: '2027-02-01', vuelve: null, respaldo: ['Persona Editora'] }
    ];
    // El formulario con una persona y fechas; licencia: la del modal (null = alta)
    const abrir = (panel, licencia, valores = {}) => {
      panel.contexto.__datos = { hoy: HOY, firmante_titular_id: 1, soy_titular: false, licencias: [], usuarios: [], autorizables: [] };
      panel.contexto.__licencia = licencia;
      evaluar(panel.contexto, 'datosLicencias = __datos; licenciaAbierta = __licencia');
      panel.elemento('l-usuario').value = String(valores.usuario ?? 7);
      panel.elemento('l-desde').value = valores.desde ?? '2026-12-09';
      panel.elemento('l-hasta').value = valores.hasta ?? '2027-01-08';
    };
    const sinAuditor = (panel) => panel.pedidos.filter(p => p.nombre === 'getSinAuditor');
    const caja = (panel) => panel.elemento('l-sin-auditor');

    it('muestra un párrafo por período, con el texto de textoSinAuditor', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      abrir(panel, null);
      await panel.contexto.actualizarSinAuditor();
      assert.deepEqual(sinAuditor(panel).map(p => p.args), [[{ desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7 }]]);
      assert.equal(caja(panel).hidden, false);
      assert.equal(caja(panel).innerHTML, PERIODOS.map(p => `<p>${texto(panel.contexto, p)}</p>`).join(''));
    });

    it('todo dato pasa por escapeHtml', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => [{ ...PERIODO, respaldo: ['<b>Persona</b>'] }] });
      panel.contexto.Utils.escapeHtml = (t) => String(t).replace(/</g, '&lt;').replace(/>/g, '&gt;');
      abrir(panel, null);
      await panel.contexto.actualizarSinAuditor();
      assert.ok(caja(panel).innerHTML.includes('&lt;b&gt;Persona&lt;/b&gt;'));
      assert.ok(!caja(panel).innerHTML.includes('<b>'));
    });

    it('sin períodos, el aviso se oculta', async () => {
      let periodos = PERIODOS;
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => periodos });
      abrir(panel, null);
      await panel.contexto.actualizarSinAuditor();
      assert.equal(caja(panel).hidden, false);
      periodos = [];
      await panel.contexto.actualizarSinAuditor();
      assert.equal(caja(panel).hidden, true);
    });

    it('al editar manda excluir con el id de la licencia abierta', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => [] });
      abrir(panel, { id: 9, usuario_id: 7, desde: '2026-12-09', hasta: '2027-01-08', estado: 'futura' });
      await panel.contexto.actualizarSinAuditor();
      assert.deepEqual(sinAuditor(panel).map(p => p.args), [[{ desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7, excluir: 9 }]]);
    });

    it('con las fechas incompletas o inválidas no llama y oculta el aviso que hubiera', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      abrir(panel, null);
      await panel.contexto.actualizarSinAuditor();
      assert.equal(caja(panel).hidden, false);
      panel.pedidos.length = 0;
      for (const hasta of ['', '2026-12-01']) {
        panel.elemento('l-hasta').value = hasta;
        await panel.contexto.actualizarSinAuditor();
        assert.equal(caja(panel).hidden, true, `hasta ${hasta || 'vacío'}`);
      }
      assert.deepEqual(sinAuditor(panel), []);
    });

    it('si la API falla, el aviso se oculta y no se interrumpe nada', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => { throw new Error('sin conexión'); } });
      abrir(panel, null);
      caja(panel).hidden = false;
      await panel.contexto.actualizarSinAuditor();
      assert.equal(caja(panel).hidden, true);
    });

    it('ignora la respuesta vieja que llega después de la nueva', async () => {
      const resolver = [];
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => new Promise(resolve => resolver.push(resolve)) });
      abrir(panel, null);
      const primera = panel.contexto.actualizarSinAuditor();
      panel.elemento('l-hasta').value = '2027-01-20';
      const segunda = panel.contexto.actualizarSinAuditor();
      resolver[1]([{ ...PERIODO, hasta: '2027-01-20' }]);
      await segunda;
      resolver[0](PERIODOS);
      await primera;
      assert.equal(caja(panel).innerHTML, `<p>${texto(panel.contexto, { ...PERIODO, hasta: '2027-01-20' })}</p>`);
    });

    it('una respuesta que llega con el formulario ya cerrado no lo vuelve a mostrar', async () => {
      const resolver = [];
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => new Promise(resolve => resolver.push(resolve)) });
      abrir(panel, null);
      const pedido = panel.contexto.actualizarSinAuditor();
      panel.contexto.cerrarModalLicencia();
      resolver[0](PERIODOS);
      await pedido;
      assert.equal(caja(panel).hidden, true);
    });

    it('al abrir el formulario de una licencia consulta enseguida, sin esperar el debounce', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      const licencia = { id: 9, usuario_id: 7, usuario_nombre: 'Persona de Prueba', desde: '2026-12-09', hasta: '2027-01-08', estado: 'futura' };
      abrir(panel, null);
      panel.contexto.__datos.usuarios = [{ id: 7, nombre_completo: 'Persona de Prueba' }];
      panel.contexto.abrirModalLicencia(licencia);
      assert.deepEqual(sinAuditor(panel).map(p => p.args), [[{ desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7, excluir: 9 }]]);
      assert.equal(panel.programados.filter(p => p.activo).length, 0, 'no queda ningún temporizador');
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(caja(panel).hidden, false);
    });

    it('cambiar la persona o las fechas lo actualiza con un debounce: varios cambios seguidos, un solo pedido', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      panel.alCargar();
      await panel.vencerProgramados();
      abrir(panel, null);
      panel.pedidos.length = 0;
      const disparar = (id, tipo) => {
        assert.ok(panel.elemento(id).oyentes[tipo]?.length, `${id} tiene un oyente de ${tipo}`);
        for (const oyente of panel.elemento(id).oyentes[tipo]) oyente({ target: panel.elemento(id) });
      };
      disparar('l-usuario', 'change');
      panel.elemento('l-desde').value = '2026-12-10';
      disparar('l-desde', 'input');
      panel.elemento('l-hasta').value = '2027-01-15';
      disparar('l-hasta', 'input');
      assert.deepEqual(sinAuditor(panel), [], 'todavía no pidió nada');
      assert.equal(panel.programados.filter(p => p.activo).length, 1, 'un solo temporizador activo');
      assert.ok(panel.programados.at(-1).ms > 0 && panel.programados.at(-1).ms <= 500, 'debounce corto');
      await panel.vencerProgramados();
      assert.deepEqual(sinAuditor(panel).map(p => p.args), [[{ desde: '2026-12-10', hasta: '2027-01-15', usuario_id: 7 }]]);
    });

    it('no bloquea el guardado: guarda aunque la consulta falle o siga pendiente', async () => {
      // La consulta del formulario no termina nunca; la de la pestaña (sin parámetros) sí
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: (params) => (params ? new Promise(() => {}) : []) });
      abrir(panel, null);
      panel.contexto.actualizarSinAuditor();
      await panel.contexto.guardarLicencia({ preventDefault() {} });
      assert.deepEqual(panel.pedidos.find(p => p.nombre === 'crearLicencia').args, [{ desde: '2026-12-09', hasta: '2027-01-08', usuario_id: 7 }]);
      assert.equal(panel.elemento('btn-guardar-licencia').disabled, false);
    });
  });

  describe('aviso de la pestaña Licencias', () => {
    const PERIODOS = [PERIODO, { desde: '2027-02-01', hasta: '2027-02-01', vuelve: null, respaldo: ['Persona Editora'] }];
    const caja = (panel) => panel.elemento('licencias-sin-auditor');

    it('pide los próximos períodos sin parámetros (la API usa hoy + 60 días) y los lista bajo el encabezado', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      await panel.contexto.cargarLicencias();
      assert.deepEqual(panel.pedidos.filter(p => p.nombre === 'getSinAuditor').map(p => p.args), [[]]);
      assert.equal(caja(panel).hidden, false);
      assert.equal(caja(panel).innerHTML,
        '<strong>Próximos días sin auditores disponibles:</strong><ul>'
        + PERIODOS.map(p => `<li>${texto(panel.contexto, p)}</li>`).join('') + '</ul>');
    });

    it('sin períodos, o si la API falla, no se muestra', async () => {
      const vacio = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => [] });
      vacio.elemento('licencias-sin-auditor').hidden = false;
      await vacio.contexto.cargarLicencias();
      assert.equal(caja(vacio).hidden, true);

      const roto = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => { throw new Error('sin conexión'); } });
      roto.elemento('licencias-sin-auditor').hidden = false;
      await roto.contexto.cargarLicencias();
      assert.equal(caja(roto).hidden, true);
    });

    it('se recarga al guardar y al anular una licencia', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      const licencia = { id: 9, usuario_id: 7, usuario_nombre: 'Persona de Prueba', desde: '2026-12-09', hasta: '2027-01-08', estado: 'futura' };
      panel.contexto.__licencia = licencia;
      evaluar(panel.contexto, "datosLicencias = { hoy: '2026-11-10', licencias: [], usuarios: [], autorizables: [] }; licenciaAbierta = __licencia");
      panel.elemento('l-usuario').value = '7';
      panel.elemento('l-desde').value = licencia.desde;
      panel.elemento('l-hasta').value = licencia.hasta;
      await panel.contexto.guardarLicencia({ preventDefault() {} });
      const recargas = () => panel.pedidos.filter(p => p.nombre === 'getSinAuditor' && p.args.length === 0).length;
      assert.equal(recargas(), 1, 'al guardar');
      evaluar(panel.contexto, 'licenciaAbierta = __licencia');
      await panel.contexto.anularLicencia();
      assert.ok(panel.pedidos.some(p => p.nombre === 'anularLicencia'));
      assert.equal(recargas(), 2, 'al anular');
    });

    it('al mostrar la pestaña Licencias lo carga', async () => {
      const panel = cargarPanel(USUARIO, () => {}, 'admin', { getSinAuditor: () => PERIODOS });
      panel.contexto.mostrarVista('licencias');
      await new Promise(resolve => setImmediate(resolve));
      assert.ok(panel.pedidos.some(p => p.nombre === 'getSinAuditor'));
      assert.equal(caja(panel).hidden, false);
    });
  });
});
