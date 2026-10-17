// Pantalla de Correos (public/js/correos.js), ejecutada en Node con un DOM mínimo
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

// correos.js es un script de navegador: se ejecuta en un contexto aislado con los elementos y la API que usa la vista
// previa. El pedido del anexo queda pendiente hasta que el test lo resuelve.
// api: métodos de API que el test quiere sumar o reemplazar
// globales: lo demás que el test quiere en el contexto (por ejemplo history para las pestañas)
const cargarCorreos = (api = {}, globales = {}) => {
  const elementos = {};
  // Los ids de los elementos que recibieron el foco, en orden
  const enfocados = [];
  const elemento = (id) => {
    if (!elementos[id]) {
      const clases = new Set();
      elementos[id] = {
        id, value: '', disabled: false, title: '', hidden: false, textContent: '',
        // Los oyentes que la página les puso, por tipo de evento: el test los dispara a mano
        escuchas: {},
        addEventListener(tipo, funcion) { (this.escuchas[tipo] ??= []).push(funcion); },
        // Lo que las pestañas les hacen: atributos, clases y foco
        attrs: {},
        setAttribute(nombre, valor) { this.attrs[nombre] = String(valor); },
        clases,
        classList: {
          add: (clase) => clases.add(clase),
          remove: (clase) => clases.delete(clase),
          toggle: (clase, activa) => {
            const poner = activa ?? !clases.has(clase);
            if (poner) clases.add(clase); else clases.delete(clase);
            return poner;
          },
          contains: (clase) => clases.has(clase)
        },
        focus() { enfocados.push(id); }
      };
    }
    return elementos[id];
  };
  elemento('preview-tipo').value = 'aviso';
  elemento('preview-gestion').value = 'interna';
  const pendientes = [];
  const contexto = vm.createContext({
    document: { getElementById: elemento, addEventListener() {}, createElement: () => ({ click() {} }) },
    API: { previewNotaAnexo: () => new Promise(resolve => pendientes.push(resolve)), ...api },
    URL: { createObjectURL: () => 'blob:anexo', revokeObjectURL() {} },
    Utils: { escapeHtml: (texto) => texto },
    showToast() {},
    setTimeout: () => 0,
    console,
    ...globales
  });
  vm.runInContext(fs.readFileSync(new URL('../public/js/correos.js', import.meta.url), 'utf8'), contexto);
  // Lo que hace el navegador cuando cambia el tipo de nota de la vista previa
  const elegirTipo = (tipo) => {
    elemento('preview-tipo').value = tipo;
    contexto.actualizarBotonAnexo();
  };
  return { contexto, elemento, enfocados, boton: elemento('btn-preview-anexo'), elegirTipo, terminarPedido: () => pendientes.shift()({}) };
};

describe('correos.js: botón "Ver anexo" de la vista previa', () => {
  it('cambiar el tipo mientras se pide el anexo no lo vuelve a habilitar; al terminar queda según el tipo', async () => {
    const { contexto, boton, elegirTipo, terminarPedido } = cargarCorreos();
    const pedido = contexto.verAnexoDeVistaPrevia();
    assert.equal(boton.disabled, true);
    elegirTipo('reiteracion');
    elegirTipo('aviso');
    assert.equal(boton.disabled, true, 'el cambio de tipo habilitó el botón con el pedido en curso');
    terminarPedido();
    await pedido;
    assert.equal(boton.disabled, false);
  });

  it('si al terminar el pedido el tipo elegido es una reiteración, el botón queda deshabilitado', async () => {
    const { contexto, boton, elegirTipo, terminarPedido } = cargarCorreos();
    const pedido = contexto.verAnexoDeVistaPrevia();
    elegirTipo('reiteracion');
    terminarPedido();
    await pedido;
    assert.equal(boton.disabled, true);
    assert.equal(boton.title, 'Solo los avisos llevan anexo');
    elegirTipo('aviso');
    assert.equal(boton.disabled, false);
  });
});

describe('correos.js: firmante titular (spec 2026-10-15-dias-habiles-licencias-auditoria, 6.2)', () => {
  it('con firmante, los campos de firma muestran los suyos, no se editan y no se envían al guardar', () => {
    const { contexto } = cargarCorreos();
    vm.runInContext("configActual = { firmante: { nombre_completo: 'Persona Titular', nombre: 'Téc. Titular', cargo: 'Director' } }", contexto);
    contexto.aplicarFirmante();
    const elemento = (id) => vm.runInContext(`document.getElementById('${id}')`, contexto);
    assert.equal(elemento('firma_nombre').disabled, true);
    assert.equal(elemento('firma_nombre').value, 'Téc. Titular');
    assert.equal(elemento('firma_cargo').value, 'Director');
    assert.equal(elemento('firma-archivo').disabled, true);
    assert.match(elemento('firma-ayuda').textContent, /Persona Titular/);
    assert.deepEqual(Object.keys(vm.runInContext('datosDelFormulario()', contexto)).filter(c => c.startsWith('firma')), []);
  });

  it('sin firmante, todo como antes', () => {
    const { contexto } = cargarCorreos();
    vm.runInContext('configActual = { firmante: null }', contexto);
    contexto.aplicarFirmante();
    const elemento = (id) => vm.runInContext(`document.getElementById('${id}')`, contexto);
    assert.equal(elemento('firma_nombre').disabled, false);
    assert.ok(Object.keys(vm.runInContext('datosDelFormulario()', contexto)).includes('firma_nombre'));
  });

  it('texto de la licencia del firmante para el Estado', () => {
    const { contexto } = cargarCorreos();
    const texto = (l) => vm.runInContext(`textoLicenciaFirmante(${JSON.stringify(l)})`, contexto);
    assert.equal(texto(null), '');
    assert.match(texto({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: false, autorizado: null, vispera: '2026-11-25', vuelta: '2027-01-15' }),
      /los avisos se anticipan el 25\/11\/2026 y las reiteraciones se postergan al 15\/01\/2027/);
    assert.match(texto({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: false, autorizado: 'Persona Autorizada', vispera: '2026-11-25' }),
      /los avisos se anticipan el 25\/11\/2026 con la autorización a Persona Autorizada/);
    assert.match(texto({ desde: '2026-11-26', hasta: '2027-01-14', en_curso: true, autorizado: 'Persona Autorizada', nota_autorizacion: { numero: 15, anio: 2026 } }),
      /Persona Autorizada presenta las notas por autorización, con las dos firmas \(autorización comunicada en la Nota Digital N° 15\/26\)/);
  });

  it('si la persona autorizada está de licencia, el texto dice hasta cuándo (junto a su nombre)', () => {
    const { contexto } = cargarCorreos();
    const texto = (l) => vm.runInContext(`textoLicenciaFirmante(${JSON.stringify(l)})`, contexto);
    const base = { desde: '2027-03-01', hasta: '2027-03-31', autorizado: 'Persona Autorizada', autorizado_de_licencia_hasta: '2027-03-03' };
    assert.equal(texto({ ...base, en_curso: false, vispera: '2027-02-26' }),
      'Licencia del firmante del 01/03/2027 al 31/03/2027: los avisos se anticipan el 26/02/2027 con la autorización a '
      + 'Persona Autorizada (de licencia hasta el 03/03/2027), que presenta las demás notas durante la licencia.');
    assert.equal(texto({ ...base, en_curso: true, nota_autorizacion: { numero: 15, anio: 2027 } }),
      'Licencia del firmante del 01/03/2027 al 31/03/2027: Persona Autorizada (de licencia hasta el 03/03/2027) presenta las notas '
      + 'por autorización, con las dos firmas (autorización comunicada en la Nota Digital N° 15/27).');
  });

  it('sin autorizado_de_licencia_hasta (null o ausente), el texto no cambia', () => {
    const { contexto } = cargarCorreos();
    const texto = (l) => vm.runInContext(`textoLicenciaFirmante(${JSON.stringify(l)})`, contexto);
    const base = { desde: '2027-03-01', hasta: '2027-03-31', autorizado: 'Persona Autorizada', vispera: '2027-02-26', en_curso: false };
    const esperado = 'Licencia del firmante del 01/03/2027 al 31/03/2027: los avisos se anticipan el 26/02/2027 con la autorización a '
      + 'Persona Autorizada, que presenta las demás notas durante la licencia.';
    assert.equal(texto(base), esperado);
    assert.equal(texto({ ...base, autorizado_de_licencia_hasta: null }), esperado);
  });

  it('el libro muestra las notas de autorización, sin gestión ni datasets', () => {
    const { contexto } = cargarCorreos();
    assert.equal(vm.runInContext("ETIQUETAS.autorizacion", contexto), 'Autorización');
    assert.equal(vm.runInContext("textoGestion(null)", contexto), '—');
    assert.equal(vm.runInContext("textoGestion('interna')", contexto), 'Interna');
  });
});

describe('correos.js: nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10.4)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);

  it('el libro muestra el tipo Auditoría, sin gestión y con la cantidad de cambios', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, 'ETIQUETAS.auditoria'), 'Auditoría');
    assert.equal(evaluar(contexto, 'textoGestion(null)'), '—');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'auditoria', cantidad_cambios: 3, es_prueba: 0 })"), '3 cambio(s)');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'aviso', cantidad_datasets: 2, es_prueba: 0 })"), '2');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'reiteracion', cantidad_datasets: 1, seccion_dataset: 'vencido', es_prueba: 0 })"), '1 (vencido)');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'autorizacion', es_prueba: 0 })"), '—');
    assert.equal(evaluar(contexto, "celdaCantidad({ tipo: 'auditoria', cantidad_cambios: 0, es_prueba: 1 })"), '—');
  });

  it('el detalle de la nota lista los cambios incluidos', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'editar', titulo: 'Presupuesto', seccion: 'nuevo', estado: 'pendiente' })"),
      'Modificación: Presupuesto (nuevo)');
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'crear', titulo: 'Nuevo', seccion: 'reiterado', estado: 'aprobado' })"),
      'Alta: Nuevo (reiterado, aprobado)');
  });

  it('el Estado dice cuántos cambios van por nota y cuándo sale la próxima', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "textoAuditoria({ canal_nota: 2, proxima: '2026-10-26' })"),
      'Auditoría de cambios: 2 cambio(s) para pedir por nota; próxima nota de auditoría: 26/10/2026.');
    assert.equal(evaluar(contexto, 'textoAuditoria({ canal_nota: 0, proxima: null })'),
      'Auditoría de cambios: no hay cambios para pedir por nota.');
    assert.equal(evaluar(contexto, 'textoAuditoria(undefined)'), 'Auditoría de cambios: no hay cambios para pedir por nota.');
  });

  it('la vista previa de auditoría no usa la gestión', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "nombreVistaPrevia('auditoria', 'interna')"), 'Nota-Digital-vista-previa-auditoria.pdf');
    assert.equal(evaluar(contexto, "nombreVistaPrevia('aviso', 'externa')"), 'Nota-Digital-vista-previa-aviso-externa.pdf');
    evaluar(contexto, "document.getElementById('preview-tipo').value = 'auditoria'");
    contexto.actualizarSelectorGestion();
    assert.equal(evaluar(contexto, "document.getElementById('preview-gestion').disabled"), true);
    evaluar(contexto, "document.getElementById('preview-tipo').value = 'aviso'");
    contexto.actualizarSelectorGestion();
    assert.equal(evaluar(contexto, "document.getElementById('preview-gestion').disabled"), false);
  });
});

describe('correos.js: días sin auditor en el Estado (spec 2026-10-15-dias-habiles-licencias-auditoria, 9.5)', () => {
  const evaluar = (contexto, expresion) => vm.runInContext(expresion, contexto);
  const sinQuien = (contexto, auditoria) => evaluar(contexto, `textoSinQuienAudite(${JSON.stringify(auditoria)})`);
  const periodos = (contexto, auditoria) => evaluar(contexto, `textoPeriodosSinAuditor(${JSON.stringify(auditoria)})`);

  it('cambios que hoy no tienen a nadie que pueda auditarlos: singular, plural y ninguno', () => {
    const { contexto } = cargarCorreos();
    assert.equal(sinQuien(contexto, { sin_quien_audite: 1 }), 'Hoy 1 cambio no tiene ningún auditor ni editor de respaldo disponible.');
    assert.equal(sinQuien(contexto, { sin_quien_audite: 2 }), 'Hoy 2 cambios no tienen ningún auditor ni editor de respaldo disponible.');
    assert.equal(sinQuien(contexto, { sin_quien_audite: 14 }), 'Hoy 14 cambios no tienen ningún auditor ni editor de respaldo disponible.');
    assert.equal(sinQuien(contexto, { sin_quien_audite: 0 }), '');
    assert.equal(sinQuien(contexto, { canal_nota: 0, proxima: null }), '', 'una respuesta sin el campo');
    assert.equal(sinQuien(contexto, undefined), '');
  });

  it('próximos períodos sin auditores: uno por período, separados por "; " y terminados en punto', () => {
    const { contexto } = cargarCorreos();
    assert.equal(periodos(contexto, { periodos_sin_auditor: [{ desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: [] }] }),
      'Próximos días sin auditores disponibles: del 28/12/2026 al 08/01/2027 (vuelve a haber auditor el 11/01/2027).');
    assert.equal(periodos(contexto, {
      periodos_sin_auditor: [
        { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: ['Persona Editora'] },
        { desde: '2027-02-01', hasta: '2027-02-03', vuelve: '2027-02-04', respaldo: [] }
      ]
    }), 'Próximos días sin auditores disponibles: del 28/12/2026 al 08/01/2027 (vuelve a haber auditor el 11/01/2027); '
      + 'del 01/02/2027 al 03/02/2027 (vuelve a haber auditor el 04/02/2027).');
  });

  it('un período sin fecha de vuelta dice "(sin fecha de vuelta)"', () => {
    const { contexto } = cargarCorreos();
    assert.equal(periodos(contexto, { periodos_sin_auditor: [{ desde: '2026-12-28', hasta: '2027-01-08', vuelve: null, respaldo: [] }] }),
      'Próximos días sin auditores disponibles: del 28/12/2026 al 08/01/2027 (sin fecha de vuelta).');
    assert.equal(periodos(contexto, {
      periodos_sin_auditor: [
        { desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: [] },
        { desde: '2027-02-01', hasta: '2027-02-03', vuelve: null, respaldo: [] }
      ]
    }), 'Próximos días sin auditores disponibles: del 28/12/2026 al 08/01/2027 (vuelve a haber auditor el 11/01/2027); '
      + 'del 01/02/2027 al 03/02/2027 (sin fecha de vuelta).');
  });

  it('sin períodos (o sin el campo), no hay línea', () => {
    const { contexto } = cargarCorreos();
    assert.equal(periodos(contexto, { periodos_sin_auditor: [] }), '');
    assert.equal(periodos(contexto, { canal_nota: 0, proxima: null }), '');
    assert.equal(periodos(contexto, undefined), '');
  });

  describe('cargarEstado: las dos líneas debajo de la de auditoría', () => {
    const ESTADO = {
      envio_activo: true, configuracion_faltante: [], fallidas: 0, alertas: [], ultima_corrida: null, licencia_firmante: null,
      proximas: {}, auditoria: { canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] }
    };
    const cargar = async (auditoria) => {
      const panel = cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, auditoria }) });
      await panel.contexto.cargarEstado();
      return panel;
    };

    it('con cambios sin quién los audite y períodos, muestra las dos', async () => {
      const { elemento } = await cargar({
        canal_nota: 0, proxima: null, sin_quien_audite: 2,
        periodos_sin_auditor: [{ desde: '2026-12-28', hasta: '2027-01-08', vuelve: '2027-01-11', respaldo: [] }]
      });
      assert.equal(elemento('nd-sin-quien-audite').hidden, false);
      assert.equal(elemento('nd-sin-quien-audite').textContent, 'Hoy 2 cambios no tienen ningún auditor ni editor de respaldo disponible.');
      assert.equal(elemento('nd-periodos-sin-auditor').hidden, false);
      assert.equal(elemento('nd-periodos-sin-auditor').textContent,
        'Próximos días sin auditores disponibles: del 28/12/2026 al 08/01/2027 (vuelve a haber auditor el 11/01/2027).');
      assert.equal(elemento('nd-auditoria').textContent, 'Auditoría de cambios: no hay cambios para pedir por nota.');
    });

    it('sin nada de eso, las dos líneas quedan ocultas y vacías', async () => {
      const { elemento } = await cargar({ canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] });
      for (const id of ['nd-sin-quien-audite', 'nd-periodos-sin-auditor']) {
        assert.equal(elemento(id).hidden, true, id);
        assert.equal(elemento(id).textContent, '', id);
      }
    });

    it('la alerta de la persona autorizada de licencia se dibuja como advertencia, y el error de siempre como error', async () => {
      const ADVERTENCIA = 'La persona autorizada está de licencia hasta el 03/03/2027: hasta entonces no se generan notas.';
      const ERROR = 'La persona autorizada para la licencia del firmante (del 01/03/2027 al 31/03/2027) ya no está activa, no tiene su firma cargada o está de licencia todos los días hábiles de esa licencia: esos días no se generan notas.';
      const dibujar = async (alerta) => {
        const panel = cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, alertas: [alerta] }) });
        await panel.contexto.cargarEstado();
        return panel.elemento('nd-alertas').innerHTML;
      };
      assert.equal(await dibujar({ tipo: 'autorizado-de-licencia', nivel: 'advertencia', mensaje: ADVERTENCIA }),
        `<div class="nd-alerta nd-advertencia">${ADVERTENCIA}</div>`);
      assert.equal(await dibujar({ tipo: 'autorizado-no-vigente', nivel: 'error', mensaje: ERROR }),
        `<div class="nd-alerta">${ERROR}</div>`);
    });

    it('al volver a cargar el Estado, lo que ya no corresponde se oculta', async () => {
      let auditoria = { canal_nota: 0, proxima: null, sin_quien_audite: 1, periodos_sin_auditor: [{ desde: '2026-12-28', hasta: '2026-12-28', vuelve: null, respaldo: [] }] };
      const { contexto, elemento } = cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, auditoria }) });
      await contexto.cargarEstado();
      assert.equal(elemento('nd-sin-quien-audite').hidden, false);
      assert.equal(elemento('nd-periodos-sin-auditor').textContent, 'Próximos días sin auditores disponibles: del 28/12/2026 al 28/12/2026 (sin fecha de vuelta).');
      auditoria = { canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] };
      await contexto.cargarEstado();
      assert.equal(elemento('nd-sin-quien-audite').hidden, true);
      assert.equal(elemento('nd-periodos-sin-auditor').hidden, true);
    });
  });
});

// Correos en pestañas (spec 2026-10-17-correos-pestanas, 4): la estructura de la página
describe('correos.html: pestañas (spec 2026-10-17-correos-pestanas, 4)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const NOMBRES = ['libro', 'estado', 'pruebas', 'configuracion'];
  // La etiqueta de apertura del elemento con ese id
  const etiqueta = (id) => PAGINA.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  const posicion = (texto) => PAGINA.indexOf(texto);

  it('hay una barra de pestañas (tablist) debajo de los mensajes, visible desde el arranque', () => {
    assert.ok(posicion('role="tablist"') > posicion('id="message-container"'), 'la barra va después de #message-container');
    const barra = etiqueta('pestanas-correos');
    assert.match(barra, /class="pf-pestanas"/);
    assert.match(barra, /role="tablist"/);
    assert.match(barra, /aria-label="Secciones de Correos"/);
    assert.doesNotMatch(barra, /\bhidden\b/, 'a Correos entra solo quien administra: la barra no arranca oculta');
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
      assert.match(panel, /^<section\b/);
      assert.match(panel, /role="tabpanel"/);
      assert.match(panel, new RegExp(`aria-labelledby="pestana-${n}"`));
      assert.match(panel, /\bhidden\b/);
    });
  }

  it('las pestañas y los paneles van en este orden: Libro, Estado, Vista previa y pruebas, Configuración', () => {
    for (const prefijo of ['pestana', 'vista']) {
      const lugares = NOMBRES.map(n => posicion(`id="${prefijo}-${n}"`));
      assert.ok(lugares.every(lugar => lugar > 0), prefijo);
      assert.deepEqual([...lugares].sort((a, b) => a - b), lugares, prefijo);
    }
    // El texto de cada pestaña, sin las marcas (los puntos de Estado) que lleva dentro
    const textos = NOMBRES.map(n => PAGINA.match(new RegExp(`id="pestana-${n}"[^>]*>([\\s\\S]*?)</button>`))?.[1].replace(/<[^>]+>/g, '').trim());
    assert.deepEqual(textos, ['Libro de Notas Digitales', 'Estado', 'Vista previa y pruebas', 'Configuración']);
  });

  it('solo hay cuatro <section (los paneles) y el modal de la nota va después del último', () => {
    assert.equal(PAGINA.match(/<section\b/g).length, 4);
    assert.ok(posicion('id="modal-nota"') > PAGINA.lastIndexOf('</section>'), '#modal-nota queda fuera de los paneles');
  });

  it('el título, el encabezado y el pie dicen Correos y RPAD v1.5.0', () => {
    assert.ok(PAGINA.includes('<title>Correos - RPAD</title>'));
    const encabezado = PAGINA.match(/<h1 class="page-title">([\s\S]*?)<\/h1>/)?.[1] ?? '';
    assert.equal(encabezado.replace(/<[^>]+>/g, '').trim(), 'Correos');
    assert.ok(PAGINA.includes('<span>RPAD v1.5.0</span>'));
    assert.ok(!PAGINA.includes('RPAD v1.4.0'));
  });
});

describe('correos.js: pestañas', () => {
  const NOMBRES = ['libro', 'estado', 'pruebas', 'configuracion'];
  const armar = () => {
    const historial = [];
    const panel = cargarCorreos({}, { history: { replaceState: (...argumentos) => historial.push(argumentos[2]) } });
    // Cada pestaña es un botón con su dataset, como en la página
    for (const n of NOMBRES) panel.elemento(`pestana-${n}`).dataset = { vista: n };
    return { ...panel, historial };
  };
  const activas = (elemento) => NOMBRES.filter(n => elemento(`pestana-${n}`).attrs['aria-selected'] === 'true');

  it('pestanaInicial: el nombre de una pestaña, con o sin #; lo demás abre el Libro', () => {
    const { contexto } = armar();
    for (const [hash, esperada] of [
      ['', 'libro'], ['#estado', 'estado'], ['estado', 'estado'], ['#configuracion', 'configuracion'], ['#pruebas', 'pruebas'],
      ['#libro', 'libro'], ['#', 'libro'], ['#ESTADO', 'libro'], ['#estado/x', 'libro'], ['#cualquiera', 'libro'], [undefined, 'libro'], [null, 'libro']
    ]) {
      assert.equal(contexto.pestanaInicial(hash), esperada, String(hash));
    }
  });

  it('mostrarPestana: activa la pestaña, muestra su panel, oculta los demás y deja el hash', () => {
    const { contexto, elemento, historial } = armar();
    contexto.mostrarPestana('estado');
    assert.deepEqual(activas(elemento), ['estado']);
    for (const n of NOMBRES) {
      const activa = n === 'estado';
      const pestana = elemento(`pestana-${n}`);
      assert.equal(pestana.attrs['aria-selected'], String(activa), n);
      assert.equal(pestana.tabIndex, activa ? 0 : -1, n);
      assert.equal(pestana.clases.has('activa'), activa, n);
      assert.equal(elemento(`vista-${n}`).hidden, !activa, n);
    }
    assert.equal(historial.at(-1), '#estado');
    // Cambiar a otra deja una sola activa
    contexto.mostrarPestana('configuracion');
    assert.deepEqual(activas(elemento), ['configuracion']);
    assert.deepEqual(NOMBRES.filter(n => !elemento(`vista-${n}`).hidden), ['configuracion']);
    assert.equal(historial.at(-1), '#configuracion');
    assert.equal(historial.length, 2);
  });

  it('conectarPestanas: el clic en una pestaña la activa y la tecla Inicio en la barra vuelve al Libro', () => {
    const { elemento, contexto } = armar();
    contexto.conectarPestanas();
    for (const n of NOMBRES) assert.equal(elemento(`pestana-${n}`).escuchas.click?.length, 1, `un solo oyente de clic en ${n}`);
    assert.equal(elemento('pestanas-correos').escuchas.keydown?.length, 1, 'un solo oyente de teclado en la barra');
    // El clic, disparado a mano: lo que el navegador hace al tocar la pestaña
    elemento('pestana-configuracion').escuchas.click[0]();
    assert.deepEqual(activas(elemento), ['configuracion']);
    // El teclado: Inicio con el foco en la última pestaña
    let frenada = false;
    elemento('pestanas-correos').escuchas.keydown[0]({
      key: 'Home', target: elemento('pestana-configuracion'), preventDefault() { frenada = true; }
    });
    assert.deepEqual(activas(elemento), ['libro']);
    assert.equal(frenada, true);
  });

  describe('teclado en la barra', () => {
    const teclear = (desde, key, modificadores = {}) => {
      const panel = armar();
      panel.contexto.mostrarPestana(desde);
      let frenada = false;
      panel.contexto.teclaEnPestanas({ key, ...modificadores, target: panel.elemento(`pestana-${desde}`), preventDefault() { frenada = true; } });
      return { ...panel, frenada };
    };

    it('flechas, inicio y fin mueven el foco y activan la pestaña de destino (con vuelta en las flechas)', () => {
      for (const [desde, key, hacia] of [
        ['libro', 'ArrowRight', 'estado'], ['configuracion', 'ArrowRight', 'libro'], ['libro', 'ArrowLeft', 'configuracion'],
        ['pruebas', 'Home', 'libro'], ['estado', 'End', 'configuracion']
      ]) {
        const { elemento, enfocados, frenada } = teclear(desde, key);
        assert.deepEqual(activas(elemento), [hacia], `${desde} ${key}`);
        assert.deepEqual(enfocados, [`pestana-${hacia}`], `${desde} ${key}`);
        assert.equal(elemento(`pestana-${hacia}`).tabIndex, 0, `${desde} ${key}`);
        assert.equal(frenada, true, `${desde} ${key}: no desplaza la página`);
      }
    });

    it('cualquier otra tecla no hace nada', () => {
      for (const key of ['Enter', 'Tab', 'ArrowDown']) {
        const { elemento, enfocados, frenada } = teclear('estado', key);
        assert.deepEqual(activas(elemento), ['estado'], key);
        assert.deepEqual(enfocados, [], key);
        assert.equal(frenada, false, key);
      }
    });

    it('con Alt, Ctrl o Cmd no hace nada ni frena la tecla: son atajos del navegador (Alt+flecha izquierda vuelve atrás)', () => {
      for (const modificador of ['altKey', 'ctrlKey', 'metaKey']) {
        for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
          const { elemento, enfocados, frenada } = teclear('estado', key, { [modificador]: true });
          assert.deepEqual(activas(elemento), ['estado'], `${modificador} ${key}`);
          assert.deepEqual(enfocados, [], `${modificador} ${key}`);
          assert.equal(frenada, false, `${modificador} ${key}`);
        }
      }
    });
  });
});

// Correos en pestañas (spec 2026-10-17-correos-pestanas, 5): las alertas arriba de la barra
describe('correos.html: alertas arriba de las pestañas (spec 2026-10-17-correos-pestanas, 5)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const etiqueta = (id) => PAGINA.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  const posicion = (texto) => PAGINA.indexOf(texto);

  it('#nd-alertas va debajo de los mensajes, antes de la barra y de todos los paneles, y es .co-alertas', () => {
    const alertas = posicion('id="nd-alertas"');
    assert.ok(alertas > 0, 'sigue existiendo');
    assert.equal(PAGINA.split('id="nd-alertas"').length, 2, 'una sola vez');
    assert.ok(alertas > posicion('id="message-container"'), 'debajo de los mensajes');
    assert.ok(alertas < posicion('role="tablist"'), 'antes de la barra');
    assert.ok(alertas < posicion('id="vista-libro"'), 'antes del primer panel');
    assert.match(etiqueta('nd-alertas'), /class="co-alertas"/);
    assert.match(etiqueta('nd-alertas'), /aria-live="polite"/);
  });

  it('#nd-alertas no queda dentro de ningún panel', () => {
    const paneles = [...PAGINA.matchAll(/<section\b[\s\S]*?<\/section>/g)].map(m => [m.index, m.index + m[0].length]);
    assert.equal(paneles.length, 4);
    const alertas = posicion('id="nd-alertas"');
    assert.ok(paneles.every(([desde, hasta]) => alertas < desde || alertas > hasta));
  });

  it('las dos marcas de Estado están dentro del botón de la pestaña Estado, después del texto, y arrancan ocultas', () => {
    const inicio = posicion('id="pestana-estado"');
    const boton = PAGINA.slice(inicio, PAGINA.indexOf('</button>', inicio));
    for (const [id, clase, texto] of [
      ['marca-estado-error', 'error', 'Hay alertas'], ['marca-estado-advertencia', 'advertencia', 'Hay advertencias']
    ]) {
      assert.ok(boton.includes(`id="${id}"`), `${id} dentro del botón`);
      const marca = etiqueta(id);
      assert.match(marca, new RegExp(`class="co-punto ${clase}"`), id);
      assert.match(marca, /role="img"/, id);
      assert.match(marca, new RegExp(`aria-label="${texto}"`), id);
      assert.match(marca, new RegExp(`title="${texto}"`), id);
      assert.match(marca, /\bhidden\b/, `${id} arranca oculta`);
    }
    assert.ok(boton.includes('>Estado<span'), 'las marcas van después del texto');
    assert.ok(boton.indexOf('marca-estado-error') < boton.indexOf('marca-estado-advertencia'));
    // Las demás pestañas no llevan marca
    for (const n of ['libro', 'pruebas', 'configuracion']) {
      const desde = posicion(`id="pestana-${n}"`);
      assert.doesNotMatch(PAGINA.slice(desde, PAGINA.indexOf('</button>', desde)), /co-punto/, n);
    }
  });

  it('el estilo trae .co-alertas (vacío no ocupa lugar) y los dos puntos', () => {
    assert.match(PAGINA, /\.co-alertas\s*\{[^}]*display:\s*grid[^}]*gap:\s*8px/);
    assert.match(PAGINA, /\.co-alertas:empty\s*\{\s*display:\s*none/);
    assert.match(PAGINA, /\.co-punto\s*\{[^}]*width:\s*8px[^}]*height:\s*8px[^}]*border-radius:\s*50%/);
    assert.match(PAGINA, /\.co-punto\.error\s*\{[^}]*#C0504D/i);
    assert.match(PAGINA, /\.co-punto\.advertencia\s*\{[^}]*#D9A33A/i);
  });

  it('.nd-alerta: error rojo pastel y advertencia ámbar, con el ícono por CSS', () => {
    const base = (PAGINA.match(/^\s*\.nd-alerta\s*\{([^}]*)\}/m)?.[1] ?? '').toLowerCase();
    for (const valor of ['#FBEEEE', '#EFCACA', '#8A3434', 'border-radius: 10px', 'padding: 11px 14px 11px 38px']) {
      assert.ok(base.includes(valor.toLowerCase()), `.nd-alerta lleva ${valor}`);
    }
    const advertencia = (PAGINA.match(/^\s*\.nd-alerta\.nd-advertencia\s*\{([^}]*)\}/m)?.[1] ?? '').toLowerCase();
    for (const valor of ['#FBF1DC', '#F0DDB0', '#7A5A14']) {
      assert.ok(advertencia.includes(valor.toLowerCase()), `.nd-alerta.nd-advertencia lleva ${valor}`);
    }
    // El ícono es solo CSS (data:), uno por variante, del color del texto
    assert.match(PAGINA, /\.nd-alerta::before\s*\{[^}]*content:\s*''[^}]*url\("data:image\/svg\+xml[^}]*stroke='%238A3434'/i);
    assert.match(PAGINA, /\.nd-alerta\.nd-advertencia::before\s*\{[^}]*url\("data:image\/svg\+xml[^}]*stroke='%237A5A14'/i);
    // Ya no quedan los colores de antes
    assert.doesNotMatch(PAGINA, /#fef2f2|#fecaca|#991b1b|#fffbeb|#fde68a|#92400e/i);
  });
});

// Correos en pestañas (spec 2026-10-17-correos-pestanas, 5): la marca de la pestaña Estado
describe('correos.js: marca de la pestaña Estado', () => {
  const marca = (contexto, alertas, auditoria) =>
    vm.runInContext(`marcaDelEstado(${JSON.stringify(alertas)}, ${JSON.stringify(auditoria)})`, contexto);

  it('marcaDelEstado: error si alguna alerta no es advertencia; si no, advertencia si hay advertencias o cambios sin auditor; si no, nada', () => {
    const { contexto } = cargarCorreos();
    assert.equal(marca(contexto, [{ nivel: 'error' }, { nivel: 'advertencia' }], undefined), 'error');
    assert.equal(marca(contexto, [{ nivel: 'advertencia' }, { nivel: 'error' }], { sin_quien_audite: 3 }), 'error', 'el error gana a todo');
    assert.equal(marca(contexto, [{ nivel: 'advertencia' }], undefined), 'advertencia');
    assert.equal(marca(contexto, [], { sin_quien_audite: 2 }), 'advertencia');
    assert.equal(marca(contexto, [], { sin_quien_audite: 0 }), '');
    assert.equal(marca(contexto, [], undefined), '');
    assert.equal(marca(contexto, [], { canal_nota: 0, proxima: null }), '', 'una respuesta sin el campo');
  });

  describe('cargarEstado: prende y apaga las marcas', () => {
    const ESTADO = {
      envio_activo: true, configuracion_faltante: [], fallidas: 0, alertas: [], ultima_corrida: null, licencia_firmante: null,
      proximas: {}, auditoria: { canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] }
    };
    const cargarCon = (cambios) => cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, ...cambios }) });
    // Lo que se ve: { error, advertencia } según el hidden de cada punto
    const visibles = (elemento) => ({
      error: elemento('marca-estado-error').hidden === false,
      advertencia: elemento('marca-estado-advertencia').hidden === false
    });

    it('con una nota fallida, el punto rojo se ve y el ámbar no', async () => {
      const { contexto, elemento } = cargarCon({ fallidas: 1 });
      await contexto.cargarEstado();
      assert.equal(elemento('marca-estado-error').hidden, false);
      assert.equal(elemento('marca-estado-advertencia').hidden, true);
    });

    it('con la configuración incompleta, también es error', async () => {
      const { contexto, elemento } = cargarCon({ configuracion_faltante: ['el remitente'] });
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: true, advertencia: false });
    });

    it('con una alerta del servidor de nivel advertencia, se ve el ámbar y no el rojo', async () => {
      const { contexto, elemento } = cargarCon({ alertas: [{ nivel: 'advertencia', mensaje: 'x' }] });
      await contexto.cargarEstado();
      assert.equal(elemento('marca-estado-error').hidden, true);
      assert.equal(elemento('marca-estado-advertencia').hidden, false);
    });

    it('una alerta del servidor de nivel error se ve como error', async () => {
      const { contexto, elemento } = cargarCon({ alertas: [{ nivel: 'error', mensaje: 'x' }] });
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: true, advertencia: false });
    });

    it('sin alertas pero con cambios sin ningún auditor, se ve el ámbar', async () => {
      const { contexto, elemento } = cargarCon({ auditoria: { ...ESTADO.auditoria, sin_quien_audite: 1 } });
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: false, advertencia: true });
    });

    it('con error y advertencia a la vez, solo el rojo', async () => {
      const { contexto, elemento } = cargarCon({ fallidas: 2, auditoria: { ...ESTADO.auditoria, sin_quien_audite: 1 } });
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: true, advertencia: false });
    });

    it('al volver a cargar con todo en cero, las dos marcas se apagan (también la ámbar de sin auditor)', async () => {
      let cambios = { fallidas: 1 };
      const { contexto, elemento } = cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, ...cambios }) });
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: true, advertencia: false });
      cambios = { alertas: [{ nivel: 'advertencia', mensaje: 'x' }] };
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: false, advertencia: true });
      cambios = { auditoria: { ...ESTADO.auditoria, sin_quien_audite: 4 } };
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: false, advertencia: true });
      cambios = {};
      await contexto.cargarEstado();
      assert.deepEqual(visibles(elemento), { error: false, advertencia: false });
    });

    it('las alertas se dibujan igual que siempre (mismo HTML, sin separador)', async () => {
      const { contexto, elemento } = cargarCon({ fallidas: 1, alertas: [{ nivel: 'advertencia', mensaje: 'x' }] });
      await contexto.cargarEstado();
      assert.equal(elemento('nd-alertas').innerHTML,
        '<div class="nd-alerta">Hay 1 nota(s) que no se pudieron enviar. Revisalas en el libro con el filtro "Fallida".</div><div class="nd-alerta nd-advertencia">x</div>');
    });
  });
});
