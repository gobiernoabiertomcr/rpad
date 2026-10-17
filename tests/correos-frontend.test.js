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

  it('el estilo trae .co-alertas (vacío no ocupa lugar, pero sigue en el árbol de accesibilidad) y los dos puntos', () => {
    assert.match(PAGINA, /\.co-alertas\s*\{[^}]*display:\s*grid[^}]*gap:\s*8px/);
    // Una grilla vacía mide cero de alto; solo se le quita el margen. Sin display:none, para que la región aria-live siga ahí
    const vacio = PAGINA.match(/\.co-alertas:empty\s*\{([^}]*)\}/)?.[1] ?? '';
    assert.match(vacio, /margin-bottom:\s*0/);
    assert.doesNotMatch(vacio, /display\s*:/);
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
    // Ya no quedan los colores de antes en las reglas de .nd-alerta (el resto de la página puede usarlos)
    const reglas = [...PAGINA.matchAll(/^\s*\.nd-alerta[^{]*\{[^}]*\}/gm)].map(m => m[0]).join('\n');
    assert.ok(reglas.includes('.nd-alerta.nd-advertencia::before'), 'se leyeron las cuatro reglas de .nd-alerta');
    assert.doesNotMatch(reglas, /#fef2f2|#fecaca|#991b1b|#fffbeb|#fde68a|#92400e/i);
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
    assert.equal(marca(contexto, [{ mensaje: 'x' }], undefined), 'error', 'una alerta sin nivel cuenta como error');
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

// Correos en pestañas (spec 2026-10-17-correos-pestanas, 6): el Libro de Notas Digitales como tabla renovada
describe('correos.html: el Libro (spec 2026-10-17-correos-pestanas, 6)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const LIBRO = PAGINA.slice(PAGINA.indexOf('id="vista-libro"'), PAGINA.indexOf('id="vista-estado"'));
  const etiqueta = (id) => LIBRO.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  // El cuerpo de la regla CSS cuyo selector es exactamente este (los espacios del selector valen por uno o más)
  const regla = (selector) => {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return PAGINA.match(new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
  };

  it('el panel ya no es una tarjeta .smtp-card con .table-container: filtros, marco de la tabla y tabla del Libro', () => {
    assert.doesNotMatch(LIBRO, /smtp-card|table-container|nd-filtros|nd-check|nd-acciones/);
    assert.match(LIBRO, /<div class="co-filtros">/);
    assert.match(LIBRO, /<div class="co-tabla-marco">\s*<table class="co-libro">/);
    assert.ok(LIBRO.indexOf('co-filtros') < LIBRO.indexOf('co-tabla-marco'), 'primero los filtros');
  });

  it('siguen los ids de los seis filtros: cinco select (sin form-select) y la casilla de pruebas', () => {
    for (const id of ['filtro-anio', 'filtro-tipo', 'filtro-gestion', 'filtro-estado', 'filtro-dataset']) {
      const select = etiqueta(id);
      assert.match(select, /^<select\b/, id);
      assert.doesNotMatch(select, /form-select/, `${id} sin form-select`);
      assert.match(select, /aria-label="/, id);
    }
    assert.match(etiqueta('filtro-dataset'), /class="ancho"/);
    for (const id of ['filtro-anio', 'filtro-tipo', 'filtro-gestion', 'filtro-estado']) {
      assert.doesNotMatch(etiqueta(id), /class="ancho"/, id);
    }
    assert.match(etiqueta('filtro-pruebas'), /^<input\b[^>]*type="checkbox"/);
    // Las mismas opciones de siempre
    assert.match(LIBRO, /<option value="">Todos los años<\/option>/);
    assert.match(LIBRO, /<option value="">Interna y externa<\/option>/);
    assert.match(LIBRO, /<option value="autorizacion">Autorización<\/option>/);
    assert.match(LIBRO, /<option value="pendiente">Pendiente<\/option>/);
    assert.match(LIBRO, /<label>\s*<input[^>]*id="filtro-pruebas"[^>]*> Incluir pruebas<\/label>/);
  });

  it('el encabezado: ocho columnas, y Para / CC es la única ocultable', () => {
    const encabezado = LIBRO.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    assert.ok(encabezado.includes('<th class="ocultable">Para / CC</th>'));
    const columnas = [...encabezado.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map(m => m[1]);
    assert.deepEqual(columnas, ['N°', 'Fecha', 'Tipo', 'Gestión', 'Datasets', 'Para / CC', 'Estado', '']);
    assert.equal(encabezado.match(/ocultable/g).length, 1, 'solo Para / CC');
  });

  it('el cuerpo arranca con Cargando… en una fila de ocho columnas, y el aviso de las 500 sigue oculto', () => {
    assert.ok(LIBRO.includes('<tbody id="libro-cuerpo"><tr><td colspan="8" class="co-sin-filas">Cargando…</td></tr></tbody>'));
    const aviso = etiqueta('libro-limite');
    assert.match(aviso, /class="test-hint"/);
    assert.match(aviso, /\bhidden\b/);
    assert.ok(LIBRO.includes('Se muestran las 500 notas más recientes; usá los filtros para ver otras.</p>'));
    assert.ok(LIBRO.indexOf('libro-limite') > LIBRO.indexOf('</table>'), 'debajo de la tabla');
  });

  it('estilo de los filtros y del marco: la tabla se desplaza dentro del marco', () => {
    assert.match(regla('.co-filtros'), /display:\s*flex[^}]*flex-wrap:\s*wrap/);
    assert.match(regla('.co-filtros select'), /border:\s*1px solid var\(--pf-linea\)[^}]*border-radius:\s*8px/);
    assert.match(regla('.co-filtros select.ancho'), /min-width:\s*240px/);
    const marco = regla('.co-tabla-marco');
    assert.match(marco, /border:\s*1px solid var\(--pf-linea\)/);
    assert.match(marco, /border-radius:\s*12px/);
    assert.match(marco, /overflow:\s*auto/);
    assert.match(regla('table.co-libro'), /width:\s*100%[^}]*border-collapse:\s*collapse/);
    assert.match(regla('.co-libro th'), /background:\s*var\(--pf-sutil\)[^}]*white-space:\s*nowrap/);
  });

  it('estilo de las celdas: número, fecha con cifras tabulares, chips por tipo, pastillas por estado', () => {
    assert.match(regla('.co-numero'), /font-weight:\s*700[^}]*tabular-nums/);
    assert.match(regla('.co-fecha'), /tabular-nums/);
    assert.match(regla('.co-cant'), /tabular-nums/);
    assert.match(regla('.co-gestion'), /border:\s*1px solid var\(--pf-linea\)[^}]*border-radius:\s*999px/);
    assert.match(regla('.co-para small'), /display:\s*block/);
    assert.match(regla('.co-estado'), /flex-direction:\s*column/);
    assert.match(regla('.co-estado small'), /tabular-nums[^}]*white-space:\s*nowrap/, 'el día y la hora no se parten en dos renglones');
    for (const [tipo, color] of [['aviso', 'azul'], ['reiteracion', 'ambar'], ['auditoria', 'violeta'], ['autorizacion', 'turquesa']]) {
      assert.match(regla(`.co-chip.${tipo}`), new RegExp(`background:\\s*var\\(--pf-${color}-fondo\\)[^}]*color:\\s*var\\(--pf-${color}\\)`), tipo);
    }
    for (const [estado, color] of [['enviada', 'verde'], ['fallida', 'rojo'], ['pendiente', 'ambar']]) {
      assert.match(regla(`.co-pastilla.${estado}`), new RegExp(`background:\\s*var\\(--pf-${color}-fondo\\)[^}]*color:\\s*var\\(--pf-${color}\\)`), estado);
    }
  });

  it('estilo de las acciones: botón, deshabilitado, primario, reintentar y foco visible', () => {
    assert.match(regla('.co-acciones'), /display:\s*flex[^}]*justify-content:\s*flex-end/);
    const boton = regla('.co-btn');
    assert.match(boton, /border:\s*1px solid var\(--pf-linea\)/);
    assert.match(boton, /border-radius:\s*8px/);
    assert.match(regla('.co-btn:hover'), /background:\s*var\(--pf-sutil\)/);
    assert.match(regla('.co-btn:disabled'), /opacity:\s*\.55[^}]*cursor:\s*not-allowed/);
    assert.match(regla('.co-btn.primario'), /background:\s*var\(--primary\)/);
    assert.match(regla('.co-btn.reintentar'), /color:\s*var\(--pf-rojo\)[^}]*border-color:\s*#E8C4C4/i);
    assert.match(regla('.co-btn:focus-visible'), /outline:\s*2px solid var\(--pf-acento\)/);
  });

  it('una fila sin datos: .co-sin-filas centrado y de color suave', () => {
    assert.match(regla('.co-libro td.co-sin-filas'), /text-align:\s*center[^}]*color:\s*var\(--pf-suave\)/);
  });

  it('hasta 860px se esconde Para / CC (encabezado y celdas)', () => {
    const desde = PAGINA.indexOf('@media (max-width: 860px)');
    assert.ok(desde > 0, 'hay una consulta de 860px');
    // El bloque de la consulta, hasta su llave de cierre
    let profundidad = 0;
    let hasta = PAGINA.indexOf('{', desde);
    for (; hasta < PAGINA.length; hasta++) {
      if (PAGINA[hasta] === '{') profundidad++;
      if (PAGINA[hasta] === '}' && --profundidad === 0) break;
    }
    assert.match(PAGINA.slice(desde, hasta), /\.co-libro \.ocultable\s*\{\s*display:\s*none;?\s*\}/);
  });

  it('ya no quedan estilos de lo que se reemplazó, ni el mapa CLASE_ESTADO', () => {
    assert.doesNotMatch(PAGINA, /\.nd-filtros|\.nd-check|\.nd-acciones/);
    const codigo = fs.readFileSync(new URL('../public/js/correos.js', import.meta.url), 'utf8');
    assert.doesNotMatch(codigo, /CLASE_ESTADO|nd-acciones|btn-sm|badge-danger|badge-warning/);
  });
});

describe('correos.js: filas del Libro (spec 2026-10-17-correos-pestanas, 6)', () => {
  // El escape de verdad (api.js), para ver qué pasa con los < y las comillas
  const utilsReal = () => {
    const contexto = vm.createContext({ CONFIG: { API_URL: '/api' }, console });
    vm.runInContext(`${fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8')}\n;globalThis.Utils = Utils;`, contexto);
    return contexto.Utils;
  };
  const AVISO = {
    id: 7, numero: 3, anio: 2026, fecha: '2026-10-21', tipo: 'aviso', gestion: 'externa', cantidad_datasets: 1,
    para: 'para@rpad.test', cc: 'cc@rpad.test', estado: 'enviada', enviada_at: '2026-10-21 08:15', tiene_anexo: 1, es_prueba: 0
  };
  const AUTORIZACION_FALLIDA = {
    id: 9, numero: 4, anio: 2026, fecha: '2026-10-22', tipo: 'autorizacion', gestion: null, cantidad_datasets: 0,
    para: 'para@rpad.test', cc: null, estado: 'fallida', enviada_at: null, ultimo_error: 'Error <421> "x"', tiene_anexo: 0, es_prueba: 0
  };
  const PRUEBA = {
    id: 11, numero: null, anio: 2026, fecha: '2026-10-23', tipo: 'aviso', gestion: 'interna', cantidad_datasets: 2,
    para: 'prueba@rpad.test', cc: null, estado: 'enviada', enviada_at: '2026-10-23 09:01', tiene_anexo: 0, es_prueba: 1
  };
  // Las filas del libro (el innerHTML del cuerpo) para esas notas
  const filas = async (notas, globales) => {
    const { contexto, elemento } = cargarCorreos({ getLibroNotas: async () => notas }, globales);
    await contexto.cargarLibro();
    return elemento('libro-cuerpo').innerHTML;
  };

  it('aviso enviado: número, fecha, chip, gestión, cantidad, Para con CC, pastilla con la hora y las tres acciones', async () => {
    const html = await filas([AVISO]);
    assert.ok(html.includes('<td><span class="co-numero">3/26</span></td>'));
    assert.ok(html.includes('<td class="co-fecha">21/10/2026</td>'));
    assert.ok(html.includes('<td><span class="co-chip aviso">Aviso</span></td>'));
    assert.ok(html.includes('<td><span class="co-gestion">Externa</span></td>'));
    assert.ok(html.includes('<td class="co-cant">1</td>'));
    assert.ok(html.includes('<td class="co-para ocultable">para@rpad.test<small>CC: cc@rpad.test</small></td>'));
    assert.ok(html.includes('<span class="co-estado"><span class="co-pastilla enviada" title="">Enviada</span><small>21/10/2026 08:15</small></span>'));
    assert.ok(html.includes('data-accion="ver" data-id="7"'));
    assert.ok(html.includes('data-accion="pdf" data-id="7" data-archivo="Nota-Digital-3-26.pdf"'));
    assert.ok(html.includes('data-accion="anexo" data-id="7" data-archivo="Anexo-Nota-Digital-3-26.pdf"'));
    assert.ok(!html.includes('data-accion="reintentar"'), 'enviada: sin Reintentar');
    assert.ok(!html.includes('badge'), 'ya no usa .badge');
  });

  it('cada fila tiene sus ocho celdas y los botones son .co-btn de tipo button', async () => {
    const html = await filas([AVISO, AUTORIZACION_FALLIDA, PRUEBA]);
    const lista = html.split('</tr>').filter(f => f.includes('<tr>'));
    assert.deepEqual(lista.map(fila => fila.match(/<td\b/g).length), [8, 8, 8]);
    const botones = html.match(/<button\b[^>]*>/g);
    assert.equal(botones.length, 3 + 3 + 2, 'aviso: ver, pdf y anexo; autorización: ver, pdf y reintentar; prueba: ver y pdf');
    for (const b of botones) assert.match(b, /^<button type="button" class="co-btn( reintentar)?" data-accion="(ver|pdf|anexo|reintentar)" data-id="\d+"/, b);
    assert.ok(html.includes('<div class="co-acciones">'));
  });

  it('el aviso sin CC no lleva la línea CC', async () => {
    const html = await filas([{ ...AVISO, cc: null }]);
    assert.ok(html.includes('<td class="co-para ocultable">para@rpad.test</td>'));
    assert.ok(!html.includes('CC:'));
  });

  it('autorización fallida sin gestión ni hora de envío: gestión "—" sin etiqueta, Reintentar, sin fecha debajo de la pastilla', async () => {
    const html = await filas([AUTORIZACION_FALLIDA]);
    assert.ok(html.includes('<td>—</td>'), 'la celda de gestión es solo —');
    assert.ok(!html.includes('co-gestion'));
    assert.ok(html.includes('<td><span class="co-chip autorizacion">Autorización</span></td>'));
    assert.ok(html.includes('<td class="co-cant">—</td>'));
    // El escape falso del helper devuelve el texto igual: el title es el ultimo_error
    assert.ok(html.includes('<span class="co-pastilla fallida" title="Error <421> "x"">Fallida</span></span>'));
    assert.ok(html.includes('<button type="button" class="co-btn reintentar" data-accion="reintentar" data-id="9">Reintentar</button>'));
    assert.ok(!html.includes('<small>'), 'sin cc ni enviada_at no hay nada chico');
    assert.ok(!html.includes('data-accion="anexo"'));
  });

  it('con el escape de verdad, el error del título sale escapado (< > y comillas)', async () => {
    const html = await filas([AUTORIZACION_FALLIDA], { Utils: utilsReal() });
    assert.ok(html.includes('<span class="co-pastilla fallida" title="Error &lt;421&gt; &quot;x&quot;">Fallida</span>'));
  });

  it('el detalle del estado sale de ultimo_error, o de respuesta_smtp si no hay, o queda vacío', async () => {
    const titulo = async (nota) => (await filas([nota])).match(/class="co-pastilla \w+" title="([^"]*)"/)[1];
    assert.equal(await titulo({ ...AVISO, ultimo_error: 'falló', respuesta_smtp: '250 ok' }), 'falló');
    assert.equal(await titulo({ ...AVISO, respuesta_smtp: '250 ok' }), '250 ok');
    assert.equal(await titulo(AVISO), '');
  });

  it('nota pendiente: pastilla pendiente y Reintentar', async () => {
    const html = await filas([{ ...AVISO, estado: 'pendiente', enviada_at: null }]);
    assert.ok(html.includes('<span class="co-pastilla pendiente" title="">Pendiente</span>'));
    assert.ok(html.includes('data-accion="reintentar"'));
  });

  it('nota de prueba: PRUEBA en lugar del número, datasets "—" y el PDF de prueba', async () => {
    const html = await filas([PRUEBA]);
    assert.ok(html.includes('<span class="co-numero">PRUEBA</span>'));
    assert.ok(html.includes('<td class="co-cant">—</td>'));
    assert.ok(html.includes('<span class="co-gestion">Interna</span>'));
    assert.ok(html.includes('data-archivo="Nota-Digital-PRUEBA-11.pdf"'));
    assert.ok(!html.includes('null'));
  });

  it('nota de auditoría: sin gestión y con la cantidad de cambios; reiteración con la sección del dataset', async () => {
    const auditoria = { ...AVISO, id: 21, tipo: 'auditoria', gestion: null, cantidad_cambios: 4, tiene_anexo: 0 };
    const reiteracion = { ...AVISO, id: 22, tipo: 'reiteracion', cantidad_datasets: 5, seccion_dataset: 'vencido', tiene_anexo: 0 };
    const html = await filas([auditoria, reiteracion]);
    assert.ok(html.includes('<span class="co-chip auditoria">Auditoría</span>'));
    assert.ok(html.includes('<td>—</td>'));
    assert.ok(html.includes('<td class="co-cant">4 cambio(s)</td>'));
    assert.ok(html.includes('<span class="co-chip reiteracion">Reiteración</span>'));
    assert.ok(html.includes('<td class="co-cant">5 (vencido)</td>'));
  });

  it('los datos de la nota salen escapados (Para, CC)', async () => {
    const html = await filas([{ ...AVISO, para: 'a<b>@x"y', cc: '<i>cc</i>' }], { Utils: utilsReal() });
    assert.ok(html.includes('<td class="co-para ocultable">a&lt;b&gt;@x&quot;y<small>CC: &lt;i&gt;cc&lt;/i&gt;</small></td>'));
    assert.ok(!html.includes('<b>') && !html.includes('<i>'));
  });

  it('la hora del envío sale en formato de día y hora, escapada', async () => {
    const html = await filas([{ ...AVISO, enviada_at: '2026-10-21 08:15' }], { Utils: utilsReal() });
    assert.ok(html.includes('<small>21/10/2026 08:15</small>'));
  });

  it('sin notas: una fila de ocho columnas con el texto de siempre', async () => {
    assert.equal(await filas([]), '<tr><td colspan="8" class="co-sin-filas">No hay notas con estos filtros.</td></tr>');
  });

  it('si el pedido falla: una fila de ocho columnas con el mensaje (escapado con el escape de verdad)', async () => {
    const { contexto, elemento } = cargarCorreos({ getLibroNotas: async () => { throw new Error('falló'); } });
    await contexto.cargarLibro();
    assert.equal(elemento('libro-cuerpo').innerHTML, '<tr><td colspan="8" class="co-sin-filas">falló</td></tr>');
    const real = cargarCorreos({ getLibroNotas: async () => { throw new Error('<mal>'); } }, { Utils: utilsReal() });
    await real.contexto.cargarLibro();
    assert.equal(real.elemento('libro-cuerpo').innerHTML, '<tr><td colspan="8" class="co-sin-filas">&lt;mal&gt;</td></tr>');
  });

  it('los seis filtros viajan a la API tal cual, y la casilla de pruebas manda "1" solo tildada', async () => {
    let recibido;
    const { contexto, elemento } = cargarCorreos({ getLibroNotas: async (filtros) => { recibido = filtros; return []; } });
    await contexto.cargarLibro();
    assert.deepEqual({ ...recibido }, { anio: '', tipo: '', gestion: '', estado: '', dataset_id: '', incluir_pruebas: '' });
    elemento('filtro-anio').value = '2026';
    elemento('filtro-tipo').value = 'aviso';
    elemento('filtro-gestion').value = 'externa';
    elemento('filtro-estado').value = 'enviada';
    elemento('filtro-dataset').value = '12';
    elemento('filtro-pruebas').checked = true;
    await contexto.cargarLibro();
    assert.deepEqual({ ...recibido }, { anio: '2026', tipo: 'aviso', gestion: 'externa', estado: 'enviada', dataset_id: '12', incluir_pruebas: '1' });
  });

  it('el aviso de las 500: se ve con 500 notas, se oculta con menos, con ninguna y si falla', async () => {
    const notas = (n) => Array.from({ length: n }, (_, i) => ({ ...AVISO, id: i + 1 }));
    let lista = notas(500);
    const { contexto, elemento } = cargarCorreos({ getLibroNotas: async () => lista });
    await contexto.cargarLibro();
    assert.equal(elemento('libro-limite').hidden, false);
    lista = notas(499);
    await contexto.cargarLibro();
    assert.equal(elemento('libro-limite').hidden, true);
    lista = notas(500);
    await contexto.cargarLibro();
    lista = [];
    await contexto.cargarLibro();
    assert.equal(elemento('libro-limite').hidden, true, 'sin notas');
    const fallo = cargarCorreos({ getLibroNotas: async () => { throw new Error('x'); } });
    fallo.elemento('libro-limite').hidden = false;
    await fallo.contexto.cargarLibro();
    assert.equal(fallo.elemento('libro-limite').hidden, true, 'si falla');
  });

  it('los botones traen lo que accionDelLibro lee: data-accion, data-id y, en PDF y Anexo, data-archivo', async () => {
    const html = await filas([AVISO]);
    const botones = [...html.matchAll(/<button\b([^>]*)>/g)]
      .map(m => Object.fromEntries([...m[1].matchAll(/data-(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
    assert.deepEqual(botones, [
      { accion: 'ver', id: '7' },
      { accion: 'pdf', id: '7', archivo: 'Nota-Digital-3-26.pdf' },
      { accion: 'anexo', id: '7', archivo: 'Anexo-Nota-Digital-3-26.pdf' }
    ]);
  });
});

// Correos en pestañas (spec 2026-10-17-correos-pestanas, 7): la pestaña Estado en tarjetas
describe('correos.html: la pestaña Estado (spec 2026-10-17-correos-pestanas, 7)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const ESTADO = PAGINA.slice(PAGINA.indexOf('id="vista-estado"'), PAGINA.indexOf('id="vista-pruebas"'));
  const etiqueta = (id) => ESTADO.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  const posicion = (texto) => ESTADO.indexOf(texto);
  // El cuerpo de la regla CSS cuyo selector es exactamente este (los espacios del selector valen por uno o más)
  const regla = (selector) => {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return PAGINA.match(new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
  };
  // Los bloques @media con esta condición, con todo lo que llevan dentro
  const bloquesDeMedia = (condicion) => {
    const bloques = [];
    for (let desde = PAGINA.indexOf(condicion); desde !== -1; desde = PAGINA.indexOf(condicion, desde + 1)) {
      let profundidad = 0;
      let hasta = PAGINA.indexOf('{', desde);
      for (; hasta < PAGINA.length; hasta++) {
        if (PAGINA[hasta] === '{') profundidad++;
        if (PAGINA[hasta] === '}' && --profundidad === 0) break;
      }
      bloques.push(PAGINA.slice(desde, hasta));
    }
    return bloques;
  };
  const REGLA_DE_AVISOS = 'Aviso de gestión interna 60 días antes del vencimiento y de gestión externa 40 días antes, junto con los demás datasets de esa gestión que vencen el mismo mes. Reiteración el primer día hábil de cada mes para los datasets avisados hace 20 días o más que siguen pendientes. Solo en días hábiles.';
  const REGLA_DE_AUDITORIA = 'Nota de auditoría: pide a la Dirección General que audite los cambios pendientes que el firmante no puede auditar y que ya tuvieron sus dos recordatorios por email (el primero fue hace dos días hábiles o más). Sale una por día y se reitera cada 5 días hábiles mientras sigan pendientes.';

  it('cuatro tarjetas, en este orden: Envío automático, Próximas notas, Conexión del correo y Cómo funcionan', () => {
    assert.equal(ESTADO.match(/<div class="co-tarjeta\b[^"]*">/g).length, 4);
    assert.deepEqual([...ESTADO.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1]),
      ['Envío automático de Notas Digitales', 'Próximas notas', 'Conexión del correo', 'Cómo funcionan']);
    assert.doesNotMatch(ESTADO, /smtp-card|smtp-status-row|nd-switch|nd-proxima\b|test-hint/);
  });

  it('el orden de la pantalla: interruptor, próximas notas, conexión y reglas', () => {
    const orden = ['id="envio-activo"', 'id="nd-proximas"', 'id="btn-verificar-smtp"', 'Aviso de gestión interna 60 días antes'].map(posicion);
    assert.ok(orden.every(lugar => lugar > 0), 'están todos');
    assert.deepEqual([...orden].sort((a, b) => a - b), orden);
  });

  it('Envío automático: título, ayuda y, a la derecha, el interruptor con su texto', () => {
    assert.ok(ESTADO.includes('<div class="co-envio">'));
    assert.ok(ESTADO.includes('<h2>Envío automático de Notas Digitales</h2>'));
    assert.ok(ESTADO.includes('<p class="co-ayuda">Las notas salen solas a las 8:15 de cada día hábil.</p>'));
    assert.match(ESTADO, /<label class="co-switch" for="envio-activo">\s*<input [^>]*id="envio-activo"[^>]*>\s*<span id="envio-activo-texto" class="badge badge-secondary">Desactivado<\/span>\s*<\/label>/);
    const interruptor = etiqueta('envio-activo');
    assert.match(interruptor, /^<input\b[^>]*type="checkbox"/, 'sigue siendo una casilla de verdad');
    assert.match(interruptor, /role="switch"/);
    assert.match(interruptor, /aria-label="Envío automático de Notas Digitales"/, 'el nombre es el título, no el texto Activado/Desactivado');
    assert.ok(posicion('class="co-envio"') < posicion('class="co-switch"'), 'el interruptor va a la derecha del título');
  });

  it('las líneas debajo del interruptor siguen con sus ids, tipos y ocultos de siempre', () => {
    const lineas = ESTADO.match(/<div class="co-lineas">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? '';
    assert.ok(lineas, 'hay un .co-lineas dentro de la primera tarjeta');
    assert.deepEqual([...lineas.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]),
      ['nd-ultima-corrida', 'nd-licencia', 'nd-auditoria', 'nd-sin-quien-audite', 'nd-periodos-sin-auditor']);
    assert.match(etiqueta('nd-ultima-corrida'), /^<p\b/);
    assert.doesNotMatch(etiqueta('nd-ultima-corrida'), /\bhidden\b/);
    assert.match(etiqueta('nd-licencia'), /^<p\b[^>]*\bhidden\b/);
    assert.match(etiqueta('nd-auditoria'), /^<p\b/);
    assert.doesNotMatch(etiqueta('nd-auditoria'), /\bhidden\b/);
    assert.match(etiqueta('nd-sin-quien-audite'), /^<div id="nd-sin-quien-audite" class="nd-alerta nd-advertencia" hidden>$/);
    assert.match(etiqueta('nd-periodos-sin-auditor'), /^<p\b[^>]*\bhidden\b/);
  });

  it('Próximas notas: título, ayuda y la lista .co-proximas que arma cargarEstado', () => {
    assert.ok(ESTADO.includes('<h2>Próximas notas</h2>'));
    assert.ok(ESTADO.includes('<p class="co-ayuda">Lo que saldría con los datasets de hoy, si nadie los actualiza antes.</p>'));
    assert.match(etiqueta('nd-proximas'), /^<div id="nd-proximas" class="co-proximas">$/);
  });

  it('Conexión del correo: el botón de verificar (.co-btn) y el estado, igual que siempre', () => {
    assert.ok(ESTADO.includes('<h2>Conexión del correo</h2>'));
    assert.match(ESTADO, /<div class="co-smtp">\s*<button type="button" id="btn-verificar-smtp" class="co-btn">Verificar conexión SMTP<\/button>\s*<span id="smtp-status" class="smtp-status">Sin verificar<\/span>\s*<\/div>/);
  });

  it('Cómo funcionan: las dos reglas de hoy, letra por letra', () => {
    const reglas = ESTADO.match(/<div class="co-tarjeta co-reglas">([\s\S]*?)<\/div>/)?.[1] ?? '';
    assert.ok(reglas.includes('<h2>Cómo funcionan</h2>'));
    assert.deepEqual([...reglas.matchAll(/<p>([^<]*)<\/p>/g)].map(m => m[1]), [REGLA_DE_AVISOS, REGLA_DE_AUDITORIA]);
  });

  it('estilo de las tarjetas: blancas, borde de 1px, radio 12px, separadas, con título y ayuda', () => {
    const tarjeta = regla('.co-tarjeta');
    assert.match(tarjeta, /background:\s*#fff/);
    assert.match(tarjeta, /border:\s*1px solid var\(--pf-linea\)/);
    assert.match(tarjeta, /border-radius:\s*12px/);
    assert.match(regla('.co-tarjeta + .co-tarjeta'), /margin-top:\s*16px/);
    assert.match(regla('.co-tarjeta h2'), /color:\s*var\(--pf-tinta\)/);
    assert.match(regla('.co-ayuda'), /color:\s*var\(--pf-suave\)/);
  });

  it('el interruptor: una casilla sin apariencia propia, pista de 42×24, perilla blanca, verde al marcarse y con foco visible', () => {
    assert.match(regla('.co-envio'), /display:\s*flex[^}]*justify-content:\s*space-between/);
    assert.match(regla('.co-switch'), /cursor:\s*pointer/);
    const pista = regla('.co-switch input');
    assert.match(pista, /appearance:\s*none/);
    assert.match(pista, /width:\s*42px/);
    assert.match(pista, /height:\s*24px/);
    assert.match(pista, /border-radius:\s*999px/);
    assert.match(regla('.co-switch input::after'), /background:\s*#fff/);
    assert.match(regla('.co-switch input:checked'), /background:\s*var\(--pf-verde\)/);
    assert.match(regla('.co-switch input:checked::after'), /transform:\s*translateX\(/);
    assert.match(regla('.co-switch input:focus-visible'), /outline:\s*2px solid var\(--pf-acento\)/);
  });

  it('estilo de las próximas notas, las líneas, la conexión y las reglas', () => {
    assert.match(regla('.co-proximas'), /display:\s*grid[^}]*grid-template-columns:\s*1fr 1fr/);
    assert.match(regla('.co-proxima'), /border:\s*1px solid var\(--pf-linea\)[^}]*border-radius:\s*10px[^}]*background:\s*var\(--pf-sutil\)/);
    assert.match(regla('.co-proxima dd'), /tabular-nums/);
    assert.match(regla('.co-lineas'), /display:\s*grid/);
    assert.match(regla('.co-smtp'), /display:\s*flex[^}]*flex-wrap:\s*wrap/);
    assert.match(regla('.co-reglas'), /color:\s*var\(--pf-suave\)/);
  });

  it('hasta 860px las próximas notas pasan a una sola columna', () => {
    assert.ok(bloquesDeMedia('@media (max-width: 860px)').some(bloque => /\.co-proximas\s*\{\s*grid-template-columns:\s*1fr;?\s*\}/.test(bloque)));
  });

  it('en el celular (hasta 480px) cada próxima nota apila el nombre sobre el valor', () => {
    const bloque = bloquesDeMedia('@media (max-width: 480px)').find(b => b.includes('.co-proxima'));
    assert.ok(bloque, 'hay un bloque de 480px para las próximas notas');
    assert.match(bloque, /\.co-proxima dl\s*\{[^}]*grid-template-columns:\s*1fr/);
  });

  it('con movimiento reducido el interruptor no se anima', () => {
    assert.ok(bloquesDeMedia('@media (prefers-reduced-motion: reduce)').some(bloque => /\.co-switch input[^{]*\{[^}]*transition:\s*none/.test(bloque)));
  });

  it('con los colores del sistema forzados (contraste alto) el interruptor sigue viéndose', () => {
    const bloque = bloquesDeMedia('@media (forced-colors: active)').find(b => b.includes('.co-switch input'));
    assert.ok(bloque, 'hay un bloque para forced-colors');
    assert.match(bloque, /\.co-switch input\s*\{[^}]*border:\s*2px solid ButtonText/);
    assert.match(bloque, /\.co-switch input:checked\s*\{[^}]*background:\s*Highlight/);
  });

  it('el aspecto de las dos clases que reescribe el código se queda: badge y smtp-status', () => {
    assert.match(regla('.smtp-status'), /display:\s*inline-flex/);
    for (const estado of ['success', 'error', 'checking']) assert.ok(regla(`.smtp-status.${estado}`), estado);
  });

  it('ya no quedan estilos de lo que se reemplazó', () => {
    assert.doesNotMatch(PAGINA, /\.nd-switch|\.nd-proxima|\.smtp-status-row/);
  });
});

describe('correos.js: próximas notas del Estado (spec 2026-10-17-correos-pestanas, 7)', () => {
  const ESTADO = {
    envio_activo: true, configuracion_faltante: [], fallidas: 0, alertas: [], ultima_corrida: null, licencia_firmante: null,
    proximas: {}, auditoria: { canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] }
  };
  const PROXIMAS = {
    interna: { aviso: { fecha: '2026-11-02', cantidad: 1 }, reiteracion: { fecha: '2026-11-02', cantidad: 3 } },
    externa: { aviso: null, reiteracion: { fecha: null, cantidad: 0 } }
  };
  const cargar = async (cambios = {}) => {
    const panel = cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, proximas: PROXIMAS, ...cambios }) });
    await panel.contexto.cargarEstado();
    return panel;
  };

  it('cantidadDeDatasets: "1 dataset" en singular y "N datasets" en cualquier otro caso', () => {
    const { contexto } = cargarCorreos();
    assert.equal(contexto.cantidadDeDatasets(1), '1 dataset');
    assert.equal(contexto.cantidadDeDatasets(3), '3 datasets');
    assert.equal(contexto.cantidadDeDatasets(0), '0 datasets');
    assert.equal(contexto.cantidadDeDatasets(10), '10 datasets');
  });

  it('una tarjeta por gestión, con su próximo aviso y su próxima reiteración', async () => {
    const { elemento } = await cargar();
    const html = elemento('nd-proximas').innerHTML;
    assert.ok(html.includes('<h3>Gestión interna</h3>'));
    assert.ok(html.includes('<dt>Próximo aviso</dt><dd>02/11/2026 · 1 dataset</dd>'));
    assert.ok(html.includes('<dt>Próxima reiteración</dt><dd>02/11/2026 · 3 datasets</dd>'));
    assert.ok(html.includes('<h3>Gestión externa</h3>'));
    assert.equal(html.match(/<dd>sin datasets pendientes<\/dd>/g).length, 2, 'la externa no tiene aviso ni reiteración');
    assert.equal(html.match(/<div class="co-proxima">/g).length, 2);
    assert.ok(!html.includes('dataset/s'));
    assert.ok(!html.includes('nd-proxima"'));
  });

  it('el armado exacto de una tarjeta', async () => {
    const { elemento } = await cargar({ proximas: { interna: PROXIMAS.interna } });
    assert.equal(elemento('nd-proximas').innerHTML,
      '<div class="co-proxima"><h3>Gestión interna</h3><dl><dt>Próximo aviso</dt><dd>02/11/2026 · 1 dataset</dd>'
      + '<dt>Próxima reiteración</dt><dd>02/11/2026 · 3 datasets</dd></dl></div>');
  });

  it('sin próximas, la lista queda vacía; al volver a cargar se reemplaza (no se acumula)', async () => {
    let proximas = PROXIMAS;
    const { contexto, elemento } = cargarCorreos({ getEstadoNotas: async () => ({ ...ESTADO, proximas }) });
    await contexto.cargarEstado();
    await contexto.cargarEstado();
    assert.equal(elemento('nd-proximas').innerHTML.match(/<div class="co-proxima">/g).length, 2);
    proximas = {};
    await contexto.cargarEstado();
    assert.equal(elemento('nd-proximas').innerHTML, '');
  });

  it('el interruptor y su texto siguen el estado real: marcado y Activado, o sin marcar y Desactivado', async () => {
    const activo = await cargar({ envio_activo: true });
    assert.equal(activo.elemento('envio-activo').checked, true);
    assert.equal(activo.elemento('envio-activo-texto').textContent, 'Activado');
    assert.equal(activo.elemento('envio-activo-texto').className, 'badge badge-success');
    const inactivo = await cargar({ envio_activo: false });
    assert.equal(inactivo.elemento('envio-activo').checked, false);
    assert.equal(inactivo.elemento('envio-activo-texto').textContent, 'Desactivado');
    assert.equal(inactivo.elemento('envio-activo-texto').className, 'badge badge-secondary');
  });
});
