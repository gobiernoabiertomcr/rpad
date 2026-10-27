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
  const descargas = [];
  // Los oyentes que la página le puso al documento (DOMContentLoaded, keydown), por tipo de evento
  const escuchasDeDocumento = {};
  const contexto = vm.createContext({
    document: {
      getElementById: elemento,
      addEventListener(tipo, funcion) { (escuchasDeDocumento[tipo] ??= []).push(funcion); },
      // Lo que descarga la página: el nombre de cada archivo que se hizo clic para bajar
      createElement: () => {
        const enlace = { click() { descargas.push(enlace.download); } };
        return enlace;
      }
    },
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
  return { contexto, elemento, enfocados, descargas, escuchasDeDocumento, boton: elemento('btn-preview-anexo'), elegirTipo, terminarPedido: () => pendientes.shift()({}) };
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

  it('si al terminar el pedido el tipo elegido es una auditoría, el botón queda deshabilitado', async () => {
    const { contexto, boton, elegirTipo, terminarPedido } = cargarCorreos();
    const pedido = contexto.verAnexoDeVistaPrevia();
    elegirTipo('auditoria');
    terminarPedido();
    await pedido;
    assert.equal(boton.disabled, true);
    assert.equal(boton.title, 'La nota de auditoría no lleva anexo');
    elegirTipo('aviso');
    assert.equal(boton.disabled, false);
  });

  // Spec 2026-10-20-requiere-nota-y-anexo-reiteracion, 2.5: la reiteración también lleva anexo
  it('el botón Ver anexo está habilitado con reiteración y deshabilitado con auditoría', () => {
    const { boton, elegirTipo } = cargarCorreos();
    elegirTipo('aviso');
    assert.equal(boton.disabled, false);
    assert.equal(boton.title, '');
    elegirTipo('reiteracion');
    assert.equal(boton.disabled, false);
    assert.equal(boton.title, '', 'la reiteración ya no dice que solo los avisos llevan anexo');
    elegirTipo('auditoria');
    assert.equal(boton.disabled, true);
    assert.equal(boton.title, 'La nota de auditoría no lleva anexo');
    elegirTipo('reiteracion');
    assert.equal(boton.disabled, false);
    assert.equal(boton.title, '');
  });

  it('Ver anexo pide el anexo del tipo y la gestión elegidos y lo baja con el nombre del tipo', async () => {
    const pedidos = [];
    const { contexto, elemento, descargas } = cargarCorreos({ previewNotaAnexo: async (gestion, tipo) => { pedidos.push([gestion, tipo]); return {}; } });
    elemento('preview-gestion').value = 'externa';
    elemento('preview-tipo').value = 'reiteracion';
    await contexto.verAnexoDeVistaPrevia();
    elemento('preview-tipo').value = 'aviso';
    await contexto.verAnexoDeVistaPrevia();
    assert.deepEqual(pedidos, [['externa', 'reiteracion'], ['externa', 'aviso']]);
    assert.deepEqual(descargas, ['Anexo-vista-previa-reiteracion-externa.pdf', 'Anexo-vista-previa-externa.pdf']);
  });
});

// API.previewNotaAnexo (api.js) pide el anexo del tipo elegido: el aviso, si no se dice otra cosa
describe('api.js: previewNotaAnexo', () => {
  const pedir = async (...argumentos) => {
    const urls = [];
    const contexto = vm.createContext({
      CONFIG: { API_URL: '/api' },
      console,
      URLSearchParams,
      Auth: { getAuthHeaders: () => ({}) },
      fetch: async (url) => { urls.push(url); return { ok: true, blob: async () => 'pdf' }; }
    });
    vm.runInContext(`${fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8')}\n;globalThis.API = API;`, contexto);
    await contexto.API.previewNotaAnexo(...argumentos);
    return urls;
  };

  it('previewNotaAnexo manda tipo=reiteracion', async () => {
    assert.deepEqual(await pedir('externa', 'reiteracion'), ['/api/notificaciones/notas-digitales/preview/anexo?gestion=externa&tipo=reiteracion']);
  });

  it('sin tipo, pide el anexo del aviso', async () => {
    assert.deepEqual(await pedir('interna'), ['/api/notificaciones/notas-digitales/preview/anexo?gestion=interna&tipo=aviso']);
  });
});

describe('correos.js: texto de la vista previa (spec 2026-10-15, 7.7)', () => {
  const TEXTO_EJEMPLO = 'Hoy no saldría ninguna nota de este tipo: se muestran datos de ejemplo.';
  // Con motivo, la segunda línea habla de ese día (el de la próxima corrida con notas), no de hoy
  const TEXTO_EJEMPLO_ESE_DIA = 'Ese día no saldría ninguna nota de este tipo: se muestran datos de ejemplo.';
  const texto = (contexto, datos) => vm.runInContext(`textoDeVistaPrevia(${JSON.stringify(datos)})`, contexto);

  it('sin motivo (hoy es la fecha), el texto es el de siempre: el de ejemplo y el de los datos reales', () => {
    const { contexto } = cargarCorreos();
    assert.equal(texto(contexto, { ejemplo: true, tipo: 'aviso', cantidad: 0, asunto: 'x', fecha: '2026-10-19', motivo: null }), TEXTO_EJEMPLO);
    assert.equal(texto(contexto, { ejemplo: false, tipo: 'aviso', cantidad: 3, asunto: 'Aviso de octubre', fecha: '2026-10-19', motivo: null }),
      'Con los datos de hoy esta nota incluiría 3 dataset(s). Asunto: Aviso de octubre');
    assert.equal(texto(contexto, { ejemplo: false, tipo: 'auditoria', cantidad: 2, asunto: 'Cambios pendientes', fecha: '2026-10-19' }),
      'Con los datos de hoy esta nota incluiría 2 cambio(s). Asunto: Cambios pendientes');
  });

  it('con motivo, antepone en su propia línea que hoy no se generan notas y qué día saldría', () => {
    const { contexto } = cargarCorreos();
    const aviso = 'Hoy no se generan notas (día no hábil): así saldría el 21/12/2026.';
    const conEjemplo = texto(contexto, { ejemplo: true, tipo: 'aviso', cantidad: 0, asunto: 'x', fecha: '2026-12-21', motivo: 'día no hábil' });
    assert.equal(conEjemplo, `${aviso}\n${TEXTO_EJEMPLO_ESE_DIA}`);
    const real = texto(contexto, { ejemplo: false, tipo: 'reiteracion', cantidad: 4, asunto: 'Reiteración', fecha: '2026-12-21', motivo: 'día no hábil' });
    assert.equal(real, `${aviso}\nCon los datos de hoy, ese día esta nota incluiría 4 dataset(s). Asunto: Reiteración`);
    const deAuditoria = texto(contexto, { ejemplo: false, tipo: 'auditoria', cantidad: 2, asunto: 'Cambios pendientes', fecha: '2026-12-21', motivo: 'día no hábil' });
    assert.equal(deAuditoria, `${aviso}\nCon los datos de hoy, ese día esta nota incluiría 2 cambio(s). Asunto: Cambios pendientes`);
    for (const motivo of ['licencia del firmante sin persona autorizada', 'la persona autorizada está de licencia']) {
      assert.ok(texto(contexto, { ejemplo: true, tipo: 'aviso', fecha: '2027-01-15', motivo })
        .startsWith(`Hoy no se generan notas (${motivo}): así saldría el 15/01/2027.\n`), motivo);
    }
  });

  it('verVistaPrevia muestra ese texto arriba del marco', async () => {
    const vistas = [
      { html: '<p>nota</p>', asunto: 'Aviso', ejemplo: true, cantidad: 0, fecha: '2026-12-21', motivo: 'día no hábil' },
      { html: '<p>nota</p>', asunto: 'Aviso', ejemplo: false, cantidad: 1, fecha: '2026-10-19', motivo: null }
    ];
    const { contexto, elemento } = cargarCorreos({ previewNota: async () => vistas.shift() });
    await contexto.verVistaPrevia();
    assert.equal(elemento('preview-aviso').hidden, false);
    assert.equal(elemento('preview-aviso').textContent, `Hoy no se generan notas (día no hábil): así saldría el 21/12/2026.\n${TEXTO_EJEMPLO_ESE_DIA}`);
    assert.equal(elemento('preview-marco').srcdoc, '<p>nota</p>');
    await contexto.verVistaPrevia();
    assert.equal(elemento('preview-aviso').textContent, 'Con los datos de hoy esta nota incluiría 1 dataset(s). Asunto: Aviso');
  });

  it('el aviso respeta el salto de línea (white-space: pre-line)', () => {
    const html = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
    assert.match(html, /#preview-aviso\s*\{[^}]*white-space:\s*pre-line/);
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
      + 'Persona Autorizada (de licencia hasta el 03/03/2027), que durante la licencia presenta las demás notas y vuelve a presentar cada aviso en su fecha.');
    assert.equal(texto({ ...base, en_curso: true, nota_autorizacion: { numero: 15, anio: 2027 } }),
      'Licencia del firmante del 01/03/2027 al 31/03/2027: Persona Autorizada (de licencia hasta el 03/03/2027) presenta las notas '
      + 'por autorización, con las dos firmas (autorización comunicada en la Nota Digital N° 15/27).');
  });

  it('sin autorizado_de_licencia_hasta (null o ausente), el texto no cambia', () => {
    const { contexto } = cargarCorreos();
    const texto = (l) => vm.runInContext(`textoLicenciaFirmante(${JSON.stringify(l)})`, contexto);
    const base = { desde: '2027-03-01', hasta: '2027-03-31', autorizado: 'Persona Autorizada', vispera: '2027-02-26', en_curso: false };
    const esperado = 'Licencia del firmante del 01/03/2027 al 31/03/2027: los avisos se anticipan el 26/02/2027 con la autorización a '
      + 'Persona Autorizada, que durante la licencia presenta las demás notas y vuelve a presentar cada aviso en su fecha.';
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

  // Como la nota de auditoría y Mi Perfil (spec 2026-10-17-fechas-datasets, 9): un registro de actualización es una edición
  // con la marca registro_actualizacion, que el detalle de la nota trae en cada cambio
  it('el detalle de la nota dice "Actualización" en un registro de actualización y "Modificación" en las demás ediciones', () => {
    const { contexto } = cargarCorreos();
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'editar', registro_actualizacion: true, titulo: 'Pauta', seccion: 'nuevo', estado: 'pendiente' })"),
      'Actualización: Pauta (nuevo)');
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'editar', registro_actualizacion: false, titulo: 'Pauta', seccion: 'reiterado', estado: 'rechazado' })"),
      'Modificación: Pauta (reiterado, rechazado)');
    // Solo una edición puede ser un registro, y la marca tiene que ser true
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'crear', registro_actualizacion: true, titulo: 'Nuevo', seccion: 'nuevo', estado: 'pendiente' })"),
      'Alta: Nuevo (nuevo)');
    assert.equal(evaluar(contexto, "textoCambioDeNota({ tipo_cambio: 'editar', registro_actualizacion: 'true', titulo: 'Pauta', seccion: 'nuevo', estado: 'pendiente' })"),
      'Modificación: Pauta (nuevo)');
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
      // De licencia todos los días hábiles (decisión del usuario, 27/10/2026), la misma alerta llega como advertencia
      assert.equal(await dibujar({ tipo: 'autorizado-no-vigente', nivel: 'advertencia', mensaje: ERROR }),
        `<div class="nd-alerta nd-advertencia">${ERROR}</div>`);
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

  it('el título, el encabezado y el pie dicen Correos y RPAD v2.0.0', () => {
    assert.ok(PAGINA.includes('<title>Correos - RPAD</title>'));
    const encabezado = PAGINA.match(/<h1 class="page-title">([\s\S]*?)<\/h1>/)?.[1] ?? '';
    assert.equal(encabezado.replace(/<[^>]+>/g, '').trim(), 'Correos');
    assert.ok(PAGINA.includes('<span>RPAD v2.0.0</span>'));
    assert.ok(!PAGINA.includes('RPAD v1.'));
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

// #nd-alertas es una región en vivo (aria-live="polite"): reescribirla con lo mismo hace que el lector de pantalla repita las alertas
describe('correos.js: cargarEstado no reescribe las alertas si no cambiaron', () => {
  const ESTADO = {
    envio_activo: true, configuracion_faltante: [], fallidas: 0, alertas: [], ultima_corrida: null, licencia_firmante: null,
    proximas: {}, auditoria: { canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] }
  };
  const escaparHtml = (texto) => String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  // Un panel cuyo #nd-alertas cuenta las veces que se le asigna innerHTML. Como el navegador, al leerlo devuelve el HTML normalizado
  // (las comillas de &quot; y &#39; vuelven a ser " y '), así que no siempre da igual a lo que se asignó. cambiar() fija lo que responde el servidor.
  const armar = () => {
    const respuesta = { ...ESTADO };
    const panel = cargarCorreos({ getEstadoNotas: async () => ({ ...respuesta }) }, { Utils: { escapeHtml: escaparHtml } });
    const contador = { asignaciones: 0, html: '' };
    Object.defineProperty(panel.elemento('nd-alertas'), 'innerHTML', {
      configurable: true,
      get: () => contador.html.replaceAll('&quot;', '"').replaceAll('&#39;', "'"),
      set: (html) => { contador.asignaciones += 1; contador.html = html; }
    });
    return { ...panel, contador, cambiar: (cambios) => Object.assign(respuesta, cambios) };
  };
  const ALERTA = { nivel: 'error', mensaje: 'La corrida de las 08:15 terminó con errores.' };
  const OTRA = { nivel: 'advertencia', mensaje: 'Otra cosa.' };

  it('dos cargas seguidas con las mismas alertas asignan innerHTML una sola vez', async () => {
    const { contexto, contador, cambiar } = armar();
    cambiar({ alertas: [ALERTA] });
    await contexto.cargarEstado();
    await contexto.cargarEstado();
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 1);
    assert.equal(contador.html, `<div class="nd-alerta">${ALERTA.mensaje}</div>`);
  });

  it('si las alertas cambian se vuelve a asignar, también al volver a una anterior y al quedar sin ninguna', async () => {
    const { contexto, contador, cambiar } = armar();
    cambiar({ alertas: [ALERTA] });
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 1);
    cambiar({ alertas: [ALERTA, OTRA] });
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 2);
    assert.equal(contador.html, `<div class="nd-alerta">${ALERTA.mensaje}</div><div class="nd-alerta nd-advertencia">${OTRA.mensaje}</div>`);
    cambiar({ alertas: [ALERTA] });
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 3);
    assert.equal(contador.html, `<div class="nd-alerta">${ALERTA.mensaje}</div>`);
    cambiar({ alertas: [] });
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 4);
    assert.equal(contador.html, '', 'las alertas que ya no corresponden se borran');
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 4, 'y sin alertas tampoco se reescribe');
  });

  it('una alerta con comillas (la de las notas fallidas) tampoco se reescribe: se compara con lo pintado, no con el innerHTML normalizado', async () => {
    const { contexto, contador, cambiar } = armar();
    cambiar({ fallidas: 2 });
    await contexto.cargarEstado();
    await contexto.cargarEstado();
    assert.equal(contador.asignaciones, 1);
    assert.equal(contador.html,
      '<div class="nd-alerta">Hay 2 nota(s) que no se pudieron enviar. Revisalas en el libro con el filtro &quot;Fallida&quot;.</div>');
  });

  it('una carga que falla no toca las alertas que ya estaban', async () => {
    const respuestas = [{ ...ESTADO, alertas: [ALERTA] }, null, { ...ESTADO, alertas: [ALERTA] }];
    const panel = cargarCorreos({
      getEstadoNotas: async () => { const r = respuestas.shift(); if (!r) throw new Error('sin conexión'); return r; }
    });
    let asignaciones = 0;
    Object.defineProperty(panel.elemento('nd-alertas'), 'innerHTML', { configurable: true, get: () => '', set: () => { asignaciones += 1; } });
    await panel.contexto.cargarEstado();
    await panel.contexto.cargarEstado();
    await panel.contexto.cargarEstado();
    assert.equal(asignaciones, 1);
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

  it('aviso enviado: número, fecha, chip, gestión, cantidad, Para con CC, pastilla con la hora y las cuatro acciones', async () => {
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
    assert.ok(html.includes('data-accion="word" data-id="7" data-archivo="Nota-Digital-3-26.docx"'));
    assert.ok(html.includes('data-accion="anexo" data-id="7" data-archivo="Anexo-Nota-Digital-3-26.pdf"'));
    assert.ok(!html.includes('data-accion="reintentar"'), 'enviada: sin Reintentar');
    assert.ok(!html.includes('badge'), 'ya no usa .badge');
  });

  it('cada fila tiene sus ocho celdas y los botones son .co-btn de tipo button', async () => {
    const html = await filas([AVISO, AUTORIZACION_FALLIDA, PRUEBA]);
    const lista = html.split('</tr>').filter(f => f.includes('<tr>'));
    assert.deepEqual(lista.map(fila => fila.match(/<td\b/g).length), [8, 8, 8]);
    const botones = html.match(/<button\b[^>]*>/g);
    assert.equal(botones.length, 4 + 4 + 3, 'aviso: ver, pdf, word y anexo; autorización: ver, pdf, word y reintentar; prueba: ver, pdf y word');
    for (const b of botones) assert.match(b, /^<button type="button" class="co-btn( reintentar)?" data-accion="(ver|pdf|word|anexo|reintentar)" data-id="\d+"/, b);
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

  it('los botones traen lo que accionDelLibro lee: data-accion, data-id y, en PDF, Word y Anexo, data-archivo', async () => {
    const html = await filas([AVISO]);
    const botones = [...html.matchAll(/<button\b([^>]*)>/g)]
      .map(m => Object.fromEntries([...m[1].matchAll(/data-(\w+)="([^"]*)"/g)].map(a => [a[1], a[2]])));
    assert.deepEqual(botones, [
      { accion: 'ver', id: '7' },
      { accion: 'pdf', id: '7', archivo: 'Nota-Digital-3-26.pdf' },
      { accion: 'word', id: '7', archivo: 'Nota-Digital-3-26.docx' },
      { accion: 'anexo', id: '7', archivo: 'Anexo-Nota-Digital-3-26.pdf' }
    ]);
  });

  // Spec 2026-10-24-generador-de-notas, 6: cada nota del libro, de cualquier tipo y estado, suma "Word" después de "PDF"
  describe('el botón "Word" (spec 2026-10-24-generador-de-notas, 6)', () => {
    // Los textos de los botones de cada fila, en orden
    const textosDeBotones = (html) => html.split('</tr>').filter(f => f.includes('<tr>'))
      .map(fila => [...fila.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map(m => m[1]));

    it('cada nota lo tiene, entre "PDF" y "Anexo" o "Reintentar"', async () => {
      const html = await filas([AVISO, AUTORIZACION_FALLIDA, PRUEBA]);
      assert.deepEqual(textosDeBotones(html), [
        ['Ver', 'PDF', 'Word', 'Anexo'],
        ['Ver', 'PDF', 'Word', 'Reintentar'],
        ['Ver', 'PDF', 'Word']
      ]);
    });

    it('el archivo es el del PDF con .docx: el de la nota de prueba, Nota-Digital-PRUEBA-11.docx', async () => {
      const html = await filas([AVISO, AUTORIZACION_FALLIDA, PRUEBA]);
      assert.ok(html.includes('<button type="button" class="co-btn" data-accion="word" data-id="7" data-archivo="Nota-Digital-3-26.docx">Word</button>'));
      assert.ok(html.includes('<button type="button" class="co-btn" data-accion="word" data-id="9" data-archivo="Nota-Digital-4-26.docx">Word</button>'));
      assert.ok(html.includes('<button type="button" class="co-btn" data-accion="word" data-id="11" data-archivo="Nota-Digital-PRUEBA-11.docx">Word</button>'));
    });

    it('el nombre del archivo sale escapado en el atributo', async () => {
      const html = await filas([{ ...AVISO, numero: '3"<x>' }], { Utils: utilsReal() });
      assert.ok(html.includes('data-accion="word" data-id="7" data-archivo="Nota-Digital-3&quot;&lt;x&gt;-26.docx"'));
    });

    // El botón como lo ve accionDelLibro: el clic sale del propio botón
    const clicEn = (dataset) => {
      const boton = { dataset, disabled: false };
      return { target: { closest: () => boton } };
    };

    it('el clic en "Word" pide /notificaciones/notas-digitales/7/word y lo baja con el nombre del botón', async () => {
      const rutas = [];
      const { contexto, descargas } = cargarCorreos({
        pedirArchivo: async (ruta) => { rutas.push(ruta); return {}; },
        getNotaPdf: async () => { throw new Error('no es el PDF'); }
      });
      await contexto.accionDelLibro(clicEn({ accion: 'word', id: '7', archivo: 'Nota-Digital-3-26.docx' }));
      assert.deepEqual(rutas, ['/notificaciones/notas-digitales/7/word']);
      assert.deepEqual(descargas, ['Nota-Digital-3-26.docx']);
    });

    it('si el servidor no lo puede armar (422), su mensaje llega por avisar como error y no se baja nada', async () => {
      const avisos = [];
      // El api.js de verdad: pedirArchivo arma el error con el error del JSON
      const contextoApi = vm.createContext({
        CONFIG: { API_URL: '/api' },
        console,
        URLSearchParams,
        Auth: { getAuthHeaders: () => ({}) },
        fetch: async () => ({ ok: false, status: 422, json: async () => ({ success: false, error: 'No se encontró el remitente de la nota.' }) })
      });
      vm.runInContext(`${fs.readFileSync(new URL('../public/js/api.js', import.meta.url), 'utf8')}\n;globalThis.API = API;`, contextoApi);
      const { contexto, descargas } = cargarCorreos({}, {
        API: contextoApi.API,
        showToast: (mensaje, tipo) => avisos.push([mensaje, tipo])
      });
      await contexto.accionDelLibro(clicEn({ accion: 'word', id: '7', archivo: 'Nota-Digital-3-26.docx' }));
      assert.deepEqual(avisos, [['No se encontró el remitente de la nota.', 'error']]);
      assert.deepEqual(descargas, []);
    });
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

// Correos en pestañas (spec 2026-10-17-correos-pestanas, 8): Vista previa y pruebas, y Configuración
describe('correos.html: Vista previa y pruebas (spec 2026-10-17-correos-pestanas, 8)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const PRUEBAS = PAGINA.slice(PAGINA.indexOf('id="vista-pruebas"'), PAGINA.indexOf('id="vista-configuracion"'));
  const etiqueta = (id) => PRUEBAS.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  const posicion = (texto) => PRUEBAS.indexOf(texto);
  const regla = (selector) => {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return PAGINA.match(new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
  };
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
  const AYUDA_DE_AREAS = 'Email directo a las áreas de gestión externa 40 días antes del vencimiento. La prueba se envía solo a las casillas de prueba.';

  it('los ids de siempre, en este orden: los dos selectores, los cuatro botones, el aviso, la vista previa y después el aviso a las áreas', () => {
    const orden = ['preview-tipo', 'preview-gestion', 'btn-preview', 'btn-preview-pdf', 'btn-preview-anexo', 'btn-prueba', 'preview-aviso',
      'preview-marco', 'btn-preview-area', 'btn-prueba-area', 'preview-area-marco'].map(id => posicion(`id="${id}"`));
    assert.ok(orden.every(lugar => lugar > 0), 'están todos');
    assert.deepEqual([...orden].sort((a, b) => a - b), orden);
  });

  it('dos tarjetas lado a lado dentro de .co-dos, y ya no hay tarjetas .smtp-card ni .test-controls', () => {
    assert.match(PRUEBAS, /<div class="co-dos">/);
    assert.equal(PRUEBAS.match(/<div class="co-tarjeta">/g).length, 2);
    assert.deepEqual([...PRUEBAS.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1]), ['Nota Digital', 'Aviso a las áreas (40 días)']);
    assert.doesNotMatch(PRUEBAS, /smtp-card|test-controls|test-hint|btn-outline|btn-secondary|class="btn\b|form-select/);
  });

  it('Nota Digital: la ayuda del mockup, los dos selectores en una fila y los cuatro botones en otra', () => {
    assert.ok(PRUEBAS.includes('<p class="co-ayuda">Cómo saldría en la próxima corrida con notas, con los datos reales (o de ejemplo si no saldría ninguna). La prueba va solo a las casillas de prueba.</p>'));
    const filas = [...PRUEBAS.matchAll(/<div class="co-controles">([\s\S]*?)<\/div>/g)].map(m => m[1]);
    assert.equal(filas.length, 3, 'dos filas en Nota Digital y una en el aviso a las áreas');
    assert.deepEqual([...filas[0].matchAll(/\bid="([^"]+)"/g)].map(m => m[1]), ['preview-tipo', 'preview-gestion']);
    assert.deepEqual([...filas[1].matchAll(/\bid="([^"]+)"/g)].map(m => m[1]), ['btn-preview', 'btn-preview-pdf', 'btn-preview-anexo', 'btn-prueba']);
    assert.deepEqual([...filas[2].matchAll(/\bid="([^"]+)"/g)].map(m => m[1]), ['btn-preview-area', 'btn-prueba-area']);
  });

  it('los selectores conservan sus opciones, valores y nombres', () => {
    assert.match(etiqueta('preview-tipo'), /^<select\b[^>]*aria-label="Tipo de nota"/);
    assert.match(etiqueta('preview-gestion'), /^<select\b[^>]*aria-label="Gestión"/);
    const opciones = (id) => [...PRUEBAS.match(new RegExp(`<select[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</select>`))[1]
      .matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g)].map(m => [m[1], m[2]]);
    assert.deepEqual(opciones('preview-tipo'), [['aviso', 'Aviso'], ['reiteracion', 'Reiteración'], ['auditoria', 'Auditoría']]);
    assert.deepEqual(opciones('preview-gestion'), [['interna', 'Gestión interna'], ['externa', 'Gestión externa']]);
  });

  it('los botones: Vista previa es el principal; todos son type="button", con su texto de siempre', () => {
    const botones = {
      'btn-preview': ['co-btn primario', 'Vista previa'], 'btn-preview-pdf': ['co-btn', 'Ver PDF'], 'btn-preview-anexo': ['co-btn', 'Ver anexo'],
      'btn-prueba': ['co-btn', 'Enviarme una prueba'], 'btn-preview-area': ['co-btn primario', 'Vista previa'], 'btn-prueba-area': ['co-btn', 'Enviarme una prueba']
    };
    for (const [id, [clase, texto]] of Object.entries(botones)) {
      assert.ok(PRUEBAS.includes(`<button type="button" id="${id}" class="${clase}">${texto}</button>`), id);
    }
  });

  it('el aviso de la vista previa sigue oculto y vacío hasta que el código lo llena', () => {
    assert.match(etiqueta('preview-aviso'), /^<p\b[^>]*\bhidden\b/);
    assert.match(PRUEBAS, /<p id="preview-aviso"[^>]*><\/p>/);
  });

  it('las dos vistas previas siguen siendo iframes aislados (sandbox vacío) y ocultos, cada uno con su marcador justo después', () => {
    for (const [id, titulo] of [['preview-marco', 'Vista previa de la nota'], ['preview-area-marco', 'Vista previa del aviso a áreas']]) {
      const marco = etiqueta(id);
      assert.match(marco, /^<iframe\b/);
      assert.match(marco, /class="nd-marco"/);
      assert.match(marco, /\bsandbox=""/);
      assert.match(marco, /\bhidden\b/);
      assert.match(marco, new RegExp(`title="${titulo}"`));
      assert.match(PRUEBAS, new RegExp(`<iframe id="${id}"[^>]*></iframe>\\s*<div class="co-vacio">La vista previa aparece acá\\.</div>`), `${id} va seguido de su marcador`);
    }
    assert.equal(PRUEBAS.match(/class="co-vacio"/g).length, 2);
  });

  it('Aviso a las áreas: su texto de hoy como ayuda, antes de los botones', () => {
    assert.ok(PRUEBAS.includes(`<p class="co-ayuda">${AYUDA_DE_AREAS}</p>`));
    assert.ok(posicion(AYUDA_DE_AREAS) < posicion('id="btn-preview-area"'));
  });

  it('estilo: dos columnas arriba, filas de controles que se acomodan, marcador punteado y vista previa con el borde nuevo', () => {
    assert.match(regla('.co-dos'), /display:\s*grid[^}]*grid-template-columns:\s*1fr 1fr[^}]*align-items:\s*start/);
    assert.match(regla('.co-controles'), /display:\s*flex[^}]*flex-wrap:\s*wrap/);
    assert.match(regla('.co-controles select'), /border:\s*1px solid var\(--pf-linea\)[^}]*border-radius:\s*8px/);
    assert.match(regla('.co-controles select:focus-visible'), /outline:\s*2px solid var\(--pf-acento\)/);
    assert.match(regla('.co-vacio'), /border:\s*1px dashed/);
    assert.match(regla('.co-vacio'), /text-align:\s*center/);
    const marco = regla('.nd-marco');
    assert.match(marco, /border:\s*1px solid var\(--pf-linea\)/);
    assert.match(marco, /border-radius:\s*10px/);
  });

  it('el marcador se esconde solo, por CSS, cuando la vista previa se muestra', () => {
    assert.match(regla('.nd-marco:not([hidden]) ~ .co-vacio'), /display:\s*none/);
  });

  it('hasta 860px las dos tarjetas pasan a una sola columna', () => {
    assert.ok(bloquesDeMedia('@media (max-width: 860px)').some(b => /\.co-dos,\s*\.co-config\s*\{\s*grid-template-columns:\s*1fr;?\s*\}/.test(b)));
  });

  it('en el celular (hasta 480px) los selectores ocupan todo el ancho', () => {
    const bloque = bloquesDeMedia('@media (max-width: 480px)').find(b => b.includes('.co-controles select'));
    assert.ok(bloque, 'hay un bloque de 480px para los selectores');
    assert.match(bloque, /\.co-controles select\s*\{[^}]*flex:\s*1 1 100%/);
  });

  it('ya no quedan estilos de lo que se reemplazó', () => {
    assert.doesNotMatch(PAGINA, /\.smtp-card|\.test-controls|\.nd-config/);
  });
});

describe('correos.html: Configuración (spec 2026-10-17-correos-pestanas, 8)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const CONFIGURACION = PAGINA.slice(PAGINA.indexOf('id="vista-configuracion"'), PAGINA.indexOf('<!-- Modal: nota enviada -->'));
  const FORMULARIO = CONFIGURACION.slice(CONFIGURACION.indexOf('<form id="form-config"'), CONFIGURACION.indexOf('</form>'));
  const etiqueta = (id) => FORMULARIO.match(new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
  const regla = (selector) => {
    const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    return PAGINA.match(new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
  };
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
  const GRUPOS = ['Gestión interna', 'Gestión externa', 'Notas de auditoría', 'Respaldo y pruebas', 'Firmante titular', 'Firma', 'Membrete del PDF'];
  const titulos = (html) => [...html.matchAll(/<legend>([^<]*)<\/legend>/g)].map(m => m[1]);

  it('el formulario de siempre (form#form-config, sin la clase vieja) ya no está dentro de una tarjeta .smtp-card', () => {
    assert.match(CONFIGURACION, /<form id="form-config">/);
    assert.equal(CONFIGURACION.match(/<form\b/g).length, 1);
    assert.doesNotMatch(CONFIGURACION, /smtp-card|nd-config/);
  });

  it('dentro del formulario están los trece campos de CAMPOS_CONFIG, el firmante y las dos imágenes con sus ayudas', () => {
    const campos = vm.runInContext('CAMPOS_CONFIG', cargarCorreos().contexto);
    assert.equal(campos.length, 13);
    for (const id of [...campos, 'firmante', 'firmante-ayuda', 'firma-archivo', 'firma-vista', 'firma-ayuda', 'membrete-archivo', 'membrete-vista']) {
      assert.ok(etiqueta(id), `${id} está dentro del formulario`);
    }
  });

  it('los campos conservan su tipo, maxlength, accept y autocomplete', () => {
    for (const id of ['para_interna', 'cc_interna', 'para_externa', 'cc_externa', 'para_auditoria', 'cc_auditoria', 'cco', 'casillas_prueba']) {
      assert.match(etiqueta(id), /^<input\b[^>]*autocomplete="off"/, id);
    }
    const largos = { linea_cc_interna: 200, linea_cc_externa: 200, firma_nombre: 150, firma_cargo: 200, membrete_pie: 300 };
    for (const [id, largo] of Object.entries(largos)) assert.match(etiqueta(id), new RegExp(`maxlength="${largo}"`), id);
    for (const id of ['firma-archivo', 'membrete-archivo']) {
      assert.match(etiqueta(id), /type="file"/, id);
      assert.match(etiqueta(id), /accept="image\/png,image\/jpeg"/, id);
    }
    assert.match(etiqueta('firmante'), /^<select\b/);
  });

  it('cada campo sigue con su etiqueta (label for)', () => {
    for (const id of ['para_interna', 'cc_interna', 'linea_cc_interna', 'para_externa', 'cc_externa', 'linea_cc_externa', 'para_auditoria', 'cc_auditoria',
      'cco', 'casillas_prueba', 'firmante', 'firma_nombre', 'firma_cargo', 'firma-archivo', 'membrete-archivo', 'membrete_pie']) {
      assert.match(FORMULARIO, new RegExp(`<label class="form-label" for="${id}">`), id);
    }
  });

  it('las imágenes de la firma y del membrete siguen ocultas y con las clases que usa el código', () => {
    assert.match(etiqueta('firma-vista'), /^<img\b[^>]*class="nd-firma"[^>]*\bhidden\b/);
    assert.match(etiqueta('membrete-vista'), /^<img\b[^>]*class="nd-firma nd-membrete"[^>]*\bhidden\b/);
  });

  it('las ayudas de siempre, letra por letra', () => {
    for (const ayuda of ['La copia oculta (CCO) es la de respaldo, la misma de las demás notas.',
      'El banner va arriba de cada hoja del PDF, a lo ancho de la hoja, y el texto del pie va centrado al pie de cada hoja (vacío: sin pie). El cuerpo del email no cambia.']) {
      assert.ok(FORMULARIO.includes(ayuda), ayuda.slice(0, 30));
    }
    assert.match(etiqueta('firmante-ayuda'), /^<p\b/);
    assert.match(etiqueta('firma-ayuda'), /^<p\b/);
  });

  it('los siete grupos, en este orden, cada uno un fieldset .co-grupo con su legend', () => {
    assert.deepEqual(titulos(FORMULARIO), GRUPOS);
    assert.equal(FORMULARIO.match(/<fieldset class="co-grupo">/g).length, 7);
    assert.equal(FORMULARIO.match(/<fieldset\b/g).length, 7);
  });

  it('dos columnas: a la izquierda los cuatro grupos de los correos y a la derecha el firmante, la firma y el membrete', () => {
    assert.match(FORMULARIO, /<div class="co-config">/);
    const columnas = FORMULARIO.split('<div class="co-columna">').slice(1);
    assert.equal(columnas.length, 2);
    assert.deepEqual(titulos(columnas[0]), GRUPOS.slice(0, 4));
    assert.deepEqual(titulos(columnas[1]), GRUPOS.slice(4));
  });

  it('el único botón de enviar está en la barra de guardado, dentro del formulario, junto a la ayuda de las direcciones', () => {
    assert.equal(FORMULARIO.match(/type="submit"/g).length, 1);
    assert.match(FORMULARIO, /<div class="co-guardar">\s*<span>Separá varias direcciones con coma\.<\/span>\s*<button type="submit" class="co-btn primario">Guardar configuración<\/button>\s*<\/div>\s*$/);
    assert.ok(FORMULARIO.indexOf('class="co-guardar"') > FORMULARIO.lastIndexOf('</fieldset>'), 'la barra va al pie, después de los siete grupos');
  });

  it('estilo de las dos columnas y de los grupos: tarjeta blanca, borde de 1px, radio 12px, título dentro', () => {
    assert.match(regla('.co-config'), /display:\s*grid[^}]*grid-template-columns:\s*1fr 1fr[^}]*align-items:\s*start/);
    const grupo = regla('.co-grupo');
    assert.match(grupo, /background:\s*#fff/);
    assert.match(grupo, /border:\s*1px solid var\(--pf-linea\)/);
    assert.match(grupo, /border-radius:\s*12px/);
    assert.match(grupo, /min-width:\s*0/, 'un fieldset no se achica solo: sin esto empuja el ancho de la página');
    assert.match(regla('.co-grupo + .co-grupo'), /margin-top:\s*16px/);
    const titulo = regla('.co-grupo legend');
    assert.match(titulo, /float:\s*left/);
    assert.match(titulo, /width:\s*100%/);
    assert.match(titulo, /color:\s*var\(--pf-tinta\)/);
    assert.match(regla('.co-grupo legend + *'), /clear:\s*both/);
  });

  it('la barra de guardado se queda abajo mientras se baja por el formulario', () => {
    const barra = regla('.co-guardar');
    assert.match(barra, /position:\s*sticky/);
    assert.match(barra, /bottom:\s*0/);
    assert.match(barra, /display:\s*flex[^}]*justify-content:\s*space-between/);
    assert.match(barra, /border:\s*1px solid var\(--pf-linea\)[^}]*border-radius:\s*12px/);
  });

  it('en una sola columna hasta 860px, y los campos ocupan el ancho de su grupo', () => {
    assert.ok(bloquesDeMedia('@media (max-width: 860px)').some(b => /\.co-dos,\s*\.co-config\s*\{\s*grid-template-columns:\s*1fr;?\s*\}/.test(b)));
    assert.match(regla('.co-grupo .form-input, .co-grupo select'), /width:\s*100%/);
  });

  it('el foco de los campos se ve con el acento', () => {
    assert.match(regla('.co-grupo .form-input:focus-visible, .co-grupo select:focus-visible'), /outline:\s*2px solid var\(--pf-acento\)/);
  });
});

describe('correos: arreglos chicos de la revisión de la tarea 4', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');

  it('con los colores forzados la perilla cabe dentro del borde de 2px del interruptor', () => {
    const inicio = PAGINA.indexOf('@media (forced-colors: active)');
    const bloque = PAGINA.slice(inicio, PAGINA.indexOf('</style>', inicio));
    assert.match(bloque, /\.co-switch input::after\s*\{[^}]*top:\s*1px[^}]*left:\s*1px/);
  });

  it('las líneas de debajo del interruptor alinean las cifras de las fechas', () => {
    assert.match(PAGINA.match(/\.co-lineas\s*\{([^}]*)\}/)[1], /font-variant-numeric:\s*tabular-nums/);
  });

  it('las fechas de las próximas notas pasan por Utils.escapeHtml', async () => {
    const escapar = (texto) => String(texto).replace(/</g, '&lt;');
    const estado = {
      envio_activo: true, configuracion_faltante: [], fallidas: 0, alertas: [], ultima_corrida: null, licencia_firmante: null, auditoria: { canal_nota: 0, proxima: null, sin_quien_audite: 0, periodos_sin_auditor: [] },
      proximas: { interna: { aviso: { fecha: '2026-<b>-01', cantidad: 1 }, reiteracion: { fecha: '2026-<i>-01', cantidad: 2 } } }
    };
    const { contexto, elemento } = cargarCorreos({ getEstadoNotas: async () => estado }, { Utils: { escapeHtml: escapar } });
    await contexto.cargarEstado();
    const html = elemento('nd-proximas').innerHTML;
    assert.ok(html.includes('&lt;b>') && html.includes('&lt;i>'), html);
    assert.ok(!html.includes('<b>') && !html.includes('<i>'), html);
  });
});

describe('correos.js: confirmación propia y cierre del Ver (spec 2026-10-17-correos-pestanas, 9)', () => {
  const CODIGO = fs.readFileSync(new URL('../public/js/correos.js', import.meta.url), 'utf8');
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const TEXTO_ACTIVAR = 'Desde la próxima corrida diaria (08:15) se enviarán Notas Digitales reales a los destinatarios configurados.';
  // Un panel cuya API cuenta lo que se guarda y las dos pruebas que salen
  const armar = (globales = {}) => {
    const llamadas = { guardar: [], prueba: [], pruebaArea: [], estado: 0 };
    const panel = cargarCorreos({
      // Se cuenta cuántas veces se pide el Estado: después de guardar se vuelve a cargar, y al cancelar no
      getEstadoNotas: async () => { llamadas.estado += 1; throw new Error('sin estado en la prueba'); },
      // Una copia: lo que se arma dentro del contexto aislado tiene otro Object.prototype y deepEqual estricto no lo da por igual
      guardarConfigNotas: async (datos) => { llamadas.guardar.push({ ...datos }); },
      enviarPruebaNota: async (tipo, gestion) => { llamadas.prueba.push([tipo, gestion]); return { message: 'Prueba enviada' }; },
      enviarPruebaAvisoArea: async () => { llamadas.pruebaArea.push(true); return { message: 'Prueba enviada' }; },
      getDatasets: async () => []
    }, globales);
    const abierta = () => panel.elemento('modal-confirmar').classList.contains('active');
    const textos = () => ({
      titulo: panel.elemento('modal-confirmar-titulo').textContent,
      texto: panel.elemento('modal-confirmar-texto').textContent,
      accion: panel.elemento('modal-confirmar-aceptar').textContent
    });
    return { ...panel, llamadas, abierta, textos };
  };
  const nota = (panel) => panel.elemento('modal-nota');
  const notaAbierta = (panel) => {
    nota(panel).classList.add('active');
    panel.elemento('modal-nota-marco').srcdoc = '<p>Nota</p>';
  };
  // La presión del mouse (mousedown) que el navegador manda al velo antes del clic; destino es donde cayó la presión (por defecto, el propio velo)
  const presionar = (panel, velo, destino = velo) => panel.contexto.presionEnVelo({ target: destino, currentTarget: velo });

  it('correos.js ya no usa el cuadro del navegador', () => {
    assert.doesNotMatch(CODIGO, /\bconfirm\(/);
  });

  describe('activar el envío automático', () => {
    it('pide confirmación con el título, el texto y el botón "Activar", y enfoca el botón; todavía no guarda nada', () => {
      const panel = armar();
      panel.contexto.cambiarEnvioAutomatico({ target: { checked: true } });
      assert.equal(panel.abierta(), true);
      assert.deepEqual(panel.textos(), { titulo: '¿Activar el envío automático?', texto: TEXTO_ACTIVAR, accion: 'Activar' });
      assert.equal(panel.enfocados.at(-1), 'modal-confirmar-aceptar');
      assert.equal(panel.llamadas.guardar.length, 0);
    });

    it('cancelar deja el interruptor apagado, cierra la ventana y no llama a la API', async () => {
      const panel = armar();
      const evento = { target: { checked: true } };
      const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
      assert.equal(evento.target.checked, false);
      assert.equal(panel.llamadas.guardar.length, 0);
      assert.equal(panel.llamadas.estado, 0, 'cancelar no recarga el Estado');
      assert.equal(panel.abierta(), false);
    });

    it('aceptar guarda envio_activo: true una sola vez y deja el interruptor encendido', async () => {
      const panel = armar();
      const evento = { target: { checked: true } };
      const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
      panel.contexto.cerrarConfirmacion(true);
      await pedido;
      assert.equal(panel.llamadas.estado, 1, 'aceptar sí recarga el Estado (el contador cuenta)');
      assert.deepEqual(panel.llamadas.guardar, [{ envio_activo: true }]);
      assert.equal(evento.target.checked, true);
      assert.equal(panel.abierta(), false);
    });

    it('si el guardado falla, el interruptor vuelve a apagado (como siempre)', async () => {
      const panel = cargarCorreos({ guardarConfigNotas: async () => { throw new Error('sin conexión'); } });
      const evento = { target: { checked: true } };
      const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
      panel.contexto.cerrarConfirmacion(true);
      await pedido;
      assert.equal(evento.target.checked, false);
    });

    it('desactivar no pide confirmación: guarda envio_activo: false enseguida', async () => {
      const panel = armar();
      const evento = { target: { checked: false } };
      const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
      assert.equal(panel.abierta(), false, 'la ventana no se abrió');
      await pedido;
      assert.deepEqual(panel.llamadas.guardar, [{ envio_activo: false }]);
      assert.equal(evento.target.checked, false);
      assert.equal(panel.abierta(), false);
    });

    it('después de cancelar se puede volver a activar y aceptar', async () => {
      const panel = armar();
      const primero = panel.contexto.cambiarEnvioAutomatico({ target: { checked: true } });
      panel.contexto.cerrarConfirmacion(false);
      await primero;
      const evento = { target: { checked: true } };
      const segundo = panel.contexto.cambiarEnvioAutomatico(evento);
      assert.equal(panel.abierta(), true);
      panel.contexto.cerrarConfirmacion(true);
      await segundo;
      assert.deepEqual(panel.llamadas.guardar, [{ envio_activo: true }]);
    });
  });

  describe('"Enviarme una prueba" (la nota y el aviso a las áreas)', () => {
    it('la nota: pide confirmación con su texto; cancelar no envía nada ni deja el botón bloqueado', async () => {
      const panel = armar();
      const pedido = panel.contexto.enviarmePrueba();
      assert.equal(panel.abierta(), true);
      assert.deepEqual(panel.textos(), {
        titulo: '¿Enviarte una prueba?',
        texto: 'Se enviará esta nota marcada como PRUEBA solo a las casillas de prueba configuradas.',
        accion: 'Enviar prueba'
      });
      assert.equal(panel.enfocados.at(-1), 'modal-confirmar-aceptar');
      assert.equal(panel.elemento('btn-prueba').disabled, false, 'el botón se bloquea recién al confirmar');
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
      assert.equal(panel.llamadas.prueba.length, 0);
      assert.equal(panel.elemento('btn-prueba').disabled, false);
    });

    it('la nota: aceptar envía una sola prueba con el tipo y la gestión que había elegidos al pedirla', async () => {
      const panel = armar();
      panel.elemento('preview-tipo').value = 'reiteracion';
      panel.elemento('preview-gestion').value = 'externa';
      const pedido = panel.contexto.enviarmePrueba();
      // Aunque mientras se mira la ventana cambie la selección, se envía lo que se pidió
      panel.elemento('preview-tipo').value = 'aviso';
      panel.contexto.cerrarConfirmacion(true);
      await pedido;
      assert.deepEqual(panel.llamadas.prueba, [['reiteracion', 'externa']]);
      assert.equal(panel.elemento('btn-prueba').disabled, false);
    });

    it('el aviso a las áreas: pide confirmación con su texto; cancelar no envía nada', async () => {
      const panel = armar();
      const pedido = panel.contexto.enviarmePruebaArea();
      assert.equal(panel.abierta(), true);
      assert.deepEqual(panel.textos(), {
        titulo: '¿Enviarte una prueba?',
        texto: 'Se enviará el aviso a áreas marcado como PRUEBA solo a las casillas de prueba.',
        accion: 'Enviar prueba'
      });
      assert.equal(panel.enfocados.at(-1), 'modal-confirmar-aceptar');
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
      assert.equal(panel.llamadas.pruebaArea.length, 0);
      assert.equal(panel.elemento('btn-prueba-area').disabled, false);
    });

    it('el aviso a las áreas: aceptar envía una sola prueba', async () => {
      const panel = armar();
      const pedido = panel.contexto.enviarmePruebaArea();
      panel.contexto.cerrarConfirmacion(true);
      await pedido;
      assert.equal(panel.llamadas.pruebaArea.length, 1);
      assert.equal(panel.elemento('btn-prueba-area').disabled, false);
    });
  });

  describe('confirmar y cerrarConfirmacion', () => {
    it('confirmar devuelve una promesa que resuelve true al aceptar y false al cancelar, y cierra la ventana', async () => {
      const panel = armar();
      const pedido = { titulo: 'T', texto: 'X', accion: 'Sí' };
      const aceptada = panel.contexto.confirmar(pedido);
      assert.equal(panel.abierta(), true);
      panel.contexto.cerrarConfirmacion(true);
      assert.equal(await aceptada, true);
      assert.equal(panel.abierta(), false);
      const cancelada = panel.contexto.confirmar(pedido);
      panel.contexto.cerrarConfirmacion(false);
      assert.equal(await cancelada, false);
      assert.equal(panel.abierta(), false);
      assert.equal(vm.runInContext('confirmacionPendiente', panel.contexto), null);
    });

    it('cada pedido pone sus tres textos (el anterior no queda)', () => {
      const panel = armar();
      panel.contexto.confirmar({ titulo: 'Uno', texto: 'Primero', accion: 'A' });
      panel.contexto.cerrarConfirmacion(false);
      panel.contexto.confirmar({ titulo: 'Dos', texto: 'Segundo', accion: 'B' });
      assert.deepEqual(panel.textos(), { titulo: 'Dos', texto: 'Segundo', accion: 'B' });
    });

    it('si ya había una confirmación abierta, esa se cancela y queda la nueva', async () => {
      const panel = armar();
      const primera = panel.contexto.confirmar({ titulo: 'Uno', texto: 'Primero', accion: 'A' });
      const segunda = panel.contexto.confirmar({ titulo: 'Dos', texto: 'Segundo', accion: 'B' });
      assert.equal(await primera, false);
      assert.equal(panel.abierta(), true, 'la nueva sigue abierta');
      assert.deepEqual(panel.textos(), { titulo: 'Dos', texto: 'Segundo', accion: 'B' });
      panel.contexto.cerrarConfirmacion(true);
      assert.equal(await segunda, true);
    });

    it('al cerrar, el foco vuelve a quien estaba enfocado al abrir', async () => {
      const panel = armar();
      panel.contexto.document.activeElement = panel.elemento('btn-prueba');
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      assert.equal(panel.enfocados.at(-1), 'modal-confirmar-aceptar');
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
      assert.equal(panel.enfocados.at(-1), 'btn-prueba');
    });

    it('con el foco en el interruptor, cancelar la activación lo devuelve ahí', async () => {
      const panel = armar();
      panel.contexto.document.activeElement = panel.elemento('envio-activo');
      const pedido = panel.contexto.cambiarEnvioAutomatico({ target: { checked: true } });
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
      assert.equal(panel.enfocados.at(-1), 'envio-activo');
    });

    it('si se pide otra confirmación con una abierta, el foco vuelve al que abrió la primera', async () => {
      const panel = armar();
      // Como en el navegador: enfocar un elemento lo vuelve el elemento activo del documento
      for (const id of ['btn-prueba', 'modal-confirmar-aceptar']) {
        const elemento = panel.elemento(id);
        const enfocar = elemento.focus;
        elemento.focus = () => { enfocar(); panel.contexto.document.activeElement = elemento; };
      }
      panel.contexto.document.activeElement = panel.elemento('btn-prueba');
      panel.contexto.confirmar({ titulo: 'Uno', texto: 'Primero', accion: 'A' });
      assert.equal(panel.contexto.document.activeElement.id, 'modal-confirmar-aceptar');
      const segunda = panel.contexto.confirmar({ titulo: 'Dos', texto: 'Segundo', accion: 'B' });
      panel.contexto.cerrarConfirmacion(true);
      assert.equal(await segunda, true);
      assert.equal(panel.enfocados.at(-1), 'btn-prueba', 'no a la ventana que se cerró');
    });

    it('sin nada enfocado al abrir (el documento no tiene elemento activo), cerrar no falla', async () => {
      const panel = armar();
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      assert.doesNotThrow(() => panel.contexto.cerrarConfirmacion(true));
      assert.equal(await pedido, true);
    });

    it('cerrarConfirmacion sin confirmación abierta no hace nada', () => {
      const panel = armar();
      assert.doesNotThrow(() => panel.contexto.cerrarConfirmacion(true));
      assert.doesNotThrow(() => panel.contexto.cerrarConfirmacion(false));
      assert.equal(panel.abierta(), false);
      assert.deepEqual(panel.enfocados, []);
    });

    it('cerrarla dos veces seguidas resuelve una sola vez y no vuelve a mover el foco', async () => {
      const panel = armar();
      panel.contexto.document.activeElement = panel.elemento('btn-prueba-area');
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      panel.contexto.cerrarConfirmacion(true);
      const enfocadosAlCerrar = panel.enfocados.length;
      panel.contexto.cerrarConfirmacion(false);
      assert.equal(await pedido, true, 'el segundo cierre no cambia el resultado');
      assert.equal(panel.enfocados.length, enfocadosAlCerrar);
    });
  });

  describe('Escape y clic afuera', () => {
    it('Escape con la confirmación abierta la cancela y no toca la ventana de la nota', async () => {
      const panel = armar();
      notaAbierta(panel);
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      panel.contexto.teclaEnPagina({ key: 'Escape' });
      assert.equal(await pedido, false);
      assert.equal(panel.abierta(), false);
      assert.equal(nota(panel).classList.contains('active'), true, 'la nota sigue abierta');
      assert.equal(panel.elemento('modal-nota-marco').srcdoc, '<p>Nota</p>');
    });

    it('Escape en la activación del envío automático deja el interruptor apagado y no llama a la API', async () => {
      const panel = armar();
      const evento = { target: { checked: true } };
      const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
      panel.contexto.teclaEnPagina({ key: 'Escape' });
      await pedido;
      assert.equal(evento.target.checked, false);
      assert.equal(panel.llamadas.guardar.length, 0);
      assert.equal(panel.llamadas.estado, 0, 'cancelar no recarga el Estado');
    });

    it('Escape con la nota abierta y sin confirmación la cierra y vacía el marco', () => {
      const panel = armar();
      notaAbierta(panel);
      panel.contexto.teclaEnPagina({ key: 'Escape' });
      assert.equal(nota(panel).classList.contains('active'), false);
      assert.equal(panel.elemento('modal-nota-marco').srcdoc, '');
    });

    it('Escape sin nada abierto no hace nada ni falla', () => {
      const panel = armar();
      assert.doesNotThrow(() => panel.contexto.teclaEnPagina({ key: 'Escape' }));
      assert.equal(panel.abierta(), false);
      assert.equal(nota(panel).classList.contains('active'), false);
      assert.deepEqual(panel.enfocados, []);
    });

    it('otras teclas no cierran nada', async () => {
      const panel = armar();
      notaAbierta(panel);
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      for (const key of ['Enter', ' ', 'Tab', 'Esc', 'escape', 'ArrowDown']) panel.contexto.teclaEnPagina({ key, preventDefault() {} });
      assert.equal(panel.abierta(), true);
      assert.equal(nota(panel).classList.contains('active'), true);
      panel.contexto.cerrarConfirmacion(true);
      assert.equal(await pedido, true, 'la confirmación sigue pendiente hasta que se la cierra');
    });

    it('clic afuera de la nota: solo si el clic cae en el velo (el destino es el propio velo)', () => {
      const panel = armar();
      const velo = { id: 'velo' };
      notaAbierta(panel);
      panel.contexto.clicAfueraDeLaNota({ target: { id: 'dentro' }, currentTarget: velo });
      assert.equal(nota(panel).classList.contains('active'), true, 'un clic adentro no cierra');
      presionar(panel, velo);
      panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo });
      assert.equal(nota(panel).classList.contains('active'), false);
      assert.equal(panel.elemento('modal-nota-marco').srcdoc, '');
    });

    it('clic afuera de la confirmación: cancela solo si el clic cae en el velo', async () => {
      const panel = armar();
      const velo = { id: 'velo' };
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      panel.contexto.clicAfueraDeLaConfirmacion({ target: { id: 'dentro' }, currentTarget: velo });
      assert.equal(panel.abierta(), true, 'un clic adentro no cierra');
      presionar(panel, velo);
      panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo });
      assert.equal(await pedido, false);
      assert.equal(panel.abierta(), false);
    });

    it('clic afuera de la activación del envío automático: interruptor apagado y sin llamada a la API', async () => {
      const panel = armar();
      const velo = {};
      const evento = { target: { checked: true } };
      const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
      presionar(panel, velo);
      panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo });
      await pedido;
      assert.equal(evento.target.checked, false);
      assert.equal(panel.llamadas.guardar.length, 0);
      assert.equal(panel.llamadas.estado, 0, 'cancelar no recarga el Estado');
    });

    // El doble clic y el arrastre no son un "clic afuera" (los dos casos hacen llegar un clic al velo sin que nadie lo haya querido)
    describe('el doble clic y el arrastre no cierran las ventanas por accidente', () => {
      it('nota: el 2º clic de un doble clic sobre el velo (detail 2) no la cierra, y la presión no sobrevive para el clic siguiente', () => {
        const panel = armar();
        const velo = { id: 'velo' };
        notaAbierta(panel);
        presionar(panel, velo);
        panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo, detail: 2 });
        assert.equal(nota(panel).classList.contains('active'), true, 'detail 2 no cierra');
        assert.equal(panel.elemento('modal-nota-marco').srcdoc, '<p>Nota</p>', 'y no vacía el marco');
        panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo, detail: 1 });
        assert.equal(nota(panel).classList.contains('active'), true, 'la presión se consumió: un clic suelto no cierra');
        presionar(panel, velo);
        panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo, detail: 1 });
        assert.equal(nota(panel).classList.contains('active'), false, 'un clic simple, con su presión, sí cierra');
        assert.equal(panel.elemento('modal-nota-marco').srcdoc, '');
      });

      it('confirmación: el 2º clic de un doble clic sobre el velo no la cancela; el clic simple la cancela sin llamar a la API', async () => {
        const panel = armar();
        const velo = { id: 'velo' };
        const evento = { target: { checked: true } };
        const pedido = panel.contexto.cambiarEnvioAutomatico(evento);
        presionar(panel, velo);
        panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo, detail: 2 });
        assert.equal(panel.abierta(), true, 'detail 2 no cierra');
        panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo, detail: 1 });
        assert.equal(panel.abierta(), true, 'la presión se consumió: un clic suelto no cierra');
        presionar(panel, velo);
        panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo, detail: 1 });
        await pedido;
        assert.equal(panel.abierta(), false);
        assert.equal(evento.target.checked, false);
        assert.equal(panel.llamadas.guardar.length, 0);
        assert.equal(panel.llamadas.estado, 0);
      });

      it('nota: apretar adentro y soltar sobre el velo (seleccionar texto, arrastrar) no la cierra', () => {
        const panel = armar();
        const velo = { id: 'velo' };
        notaAbierta(panel);
        presionar(panel, velo, { id: 'dentro' });
        panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo, detail: 1 });
        assert.equal(nota(panel).classList.contains('active'), true);
        assert.equal(panel.elemento('modal-nota-marco').srcdoc, '<p>Nota</p>');
        // Una presión adentro anula también a una anterior sobre el velo
        presionar(panel, velo);
        presionar(panel, velo, { id: 'dentro' });
        panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo, detail: 1 });
        assert.equal(nota(panel).classList.contains('active'), true);
      });

      it('confirmación: apretar adentro y soltar sobre el velo no la cancela', async () => {
        const panel = armar();
        const velo = { id: 'velo' };
        const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
        presionar(panel, velo, { id: 'dentro' });
        panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo, detail: 1 });
        assert.equal(panel.abierta(), true);
        panel.contexto.cerrarConfirmacion(true);
        assert.equal(await pedido, true, 'la confirmación sigue pendiente hasta que se la cierra');
      });

      it('un clic sin presión anotada (por ejemplo, uno sintético) no cierra ninguna de las dos', async () => {
        const panel = armar();
        const velo = { id: 'velo' };
        notaAbierta(panel);
        const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
        panel.contexto.clicAfueraDeLaNota({ target: velo, currentTarget: velo, detail: 1 });
        panel.contexto.clicAfueraDeLaConfirmacion({ target: velo, currentTarget: velo });
        assert.equal(nota(panel).classList.contains('active'), true);
        assert.equal(panel.abierta(), true);
        panel.contexto.cerrarConfirmacion(false);
        assert.equal(await pedido, false);
      });

      it('la presión sobre el velo de una ventana no vale para el clic sobre el velo de la otra', async () => {
        const panel = armar();
        const veloNota = { id: 'velo-nota' };
        const veloConfirmacion = { id: 'velo-confirmacion' };
        notaAbierta(panel);
        const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
        presionar(panel, veloNota);
        panel.contexto.clicAfueraDeLaConfirmacion({ target: veloConfirmacion, currentTarget: veloConfirmacion, detail: 1 });
        assert.equal(panel.abierta(), true);
        assert.equal(nota(panel).classList.contains('active'), true);
        panel.contexto.cerrarConfirmacion(false);
        assert.equal(await pedido, false);
      });

      it('Escape, la X y los botones siguen cerrando sin ninguna presión anotada', async () => {
        const panel = armar();
        notaAbierta(panel);
        panel.contexto.teclaEnPagina({ key: 'Escape' });
        assert.equal(nota(panel).classList.contains('active'), false, 'Escape cierra la nota');
        notaAbierta(panel);
        panel.contexto.cerrarModalNota();
        assert.equal(nota(panel).classList.contains('active'), false, 'la X (cerrarModalNota) cierra la nota');
        const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
        panel.contexto.teclaEnPagina({ key: 'Escape' });
        assert.equal(await pedido, false, 'Escape cancela la confirmación');
        const aceptada = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
        panel.contexto.cerrarConfirmacion(true);
        assert.equal(await aceptada, true, 'Aceptar acepta');
      });
    });
  });

  describe('teclado con la confirmación abierta: tecla sostenida y foco retenido', () => {
    // Un evento de teclado que anota cuántas veces se le llamó a preventDefault
    const tecla = (panel, key, extra = {}) => {
      const evento = { key, repeat: false, shiftKey: false, prevenido: 0, preventDefault() { this.prevenido += 1; }, ...extra };
      panel.contexto.teclaEnPagina(evento);
      return evento;
    };
    // Abre una confirmación con el foco donde diga la prueba, y deja vacía la lista de enfocados para mirar solo lo que hace la tecla
    const abrir = (panel, enfocado) => {
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      panel.contexto.document.activeElement = enfocado === undefined ? undefined : panel.elemento(enfocado);
      panel.enfocados.length = 0;
      return pedido;
    };
    const sigueAbierta = async (panel, pedido) => {
      let resuelta = false;
      pedido.then(() => { resuelta = true; });
      await new Promise(resolver => setImmediate(resolver));
      assert.equal(resuelta, false, 'la promesa sigue pendiente');
      assert.equal(panel.abierta(), true);
    };

    for (const [nombre, key] of [['Enter', 'Enter'], ['espacio', ' ']]) {
      it(`${nombre} sostenido (repeat) se frena y no acepta: la confirmación sigue pendiente`, async () => {
        const panel = armar();
        const pedido = abrir(panel, 'modal-confirmar-aceptar');
        const evento = tecla(panel, key, { repeat: true });
        assert.equal(evento.prevenido, 1);
        await sigueAbierta(panel, pedido);
        assert.equal(panel.llamadas.guardar.length, 0);
        panel.contexto.cerrarConfirmacion(false);
        assert.equal(await pedido, false);
      });

      it(`${nombre} una sola vez (sin repeat) no se frena: el botón enfocado hace su trabajo`, async () => {
        const panel = armar();
        const pedido = abrir(panel, 'modal-confirmar-aceptar');
        assert.equal(tecla(panel, key).prevenido, 0);
        await sigueAbierta(panel, pedido);
        panel.contexto.cerrarConfirmacion(false);
        await pedido;
      });
    }

    it('una tecla sostenida que no es Enter ni espacio no se frena', async () => {
      const panel = armar();
      const pedido = abrir(panel, 'modal-confirmar-aceptar');
      for (const key of ['ArrowDown', 'a', 'Shift']) assert.equal(tecla(panel, key, { repeat: true }).prevenido, 0, key);
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
    });

    it('Escape sostenido sigue cancelando la confirmación (se cierra una sola vez)', async () => {
      const panel = armar();
      const pedido = abrir(panel, 'modal-confirmar-aceptar');
      tecla(panel, 'Escape', { repeat: true });
      assert.equal(await pedido, false);
      assert.equal(panel.abierta(), false);
      assert.doesNotThrow(() => tecla(panel, 'Escape', { repeat: true }));
    });

    it('Shift+Tab en Cancelar vuelve el foco a la acción (no sale de la ventana)', async () => {
      const panel = armar();
      const pedido = abrir(panel, 'modal-confirmar-cancelar');
      const evento = tecla(panel, 'Tab', { shiftKey: true });
      assert.equal(evento.prevenido, 1);
      assert.deepEqual(panel.enfocados, ['modal-confirmar-aceptar']);
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
    });

    it('Tab en la acción lleva el foco a Cancelar (no sale de la ventana)', async () => {
      const panel = armar();
      const pedido = abrir(panel, 'modal-confirmar-aceptar');
      const evento = tecla(panel, 'Tab');
      assert.equal(evento.prevenido, 1);
      assert.deepEqual(panel.enfocados, ['modal-confirmar-cancelar']);
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
    });

    it('con el foco fuera de los dos botones, Tab (con o sin Shift) lo trae a la acción', async () => {
      for (const shiftKey of [false, true]) {
        for (const enfocado of ['btn-prueba', undefined]) {
          const panel = armar();
          const pedido = abrir(panel, enfocado);
          const evento = tecla(panel, 'Tab', { shiftKey });
          assert.equal(evento.prevenido, 1, `shift ${shiftKey}, foco en ${enfocado}`);
          assert.deepEqual(panel.enfocados, ['modal-confirmar-aceptar'], `shift ${shiftKey}, foco en ${enfocado}`);
          panel.contexto.cerrarConfirmacion(false);
          await pedido;
        }
      }
    });

    it('Tab en Cancelar y Shift+Tab en la acción se dejan: el navegador mueve el foco entre los dos botones', async () => {
      const panel = armar();
      const pedido = abrir(panel, 'modal-confirmar-cancelar');
      assert.equal(tecla(panel, 'Tab').prevenido, 0);
      panel.contexto.document.activeElement = panel.elemento('modal-confirmar-aceptar');
      assert.equal(tecla(panel, 'Tab', { shiftKey: true }).prevenido, 0);
      assert.deepEqual(panel.enfocados, [], 'no se enfocó nada a mano');
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
    });

    it('sin confirmación abierta nada se intercepta: ni Tab ni Enter sostenido', () => {
      const panel = armar();
      panel.contexto.document.activeElement = panel.elemento('btn-prueba');
      for (const extra of [{}, { shiftKey: true }]) assert.equal(tecla(panel, 'Tab', extra).prevenido, 0);
      for (const key of ['Enter', ' ']) assert.equal(tecla(panel, key, { repeat: true }).prevenido, 0, key);
      assert.deepEqual(panel.enfocados, []);
    });

    it('después de cerrar la confirmación, las teclas vuelven a ser de la página', async () => {
      const panel = armar();
      const pedido = abrir(panel, 'modal-confirmar-aceptar');
      panel.contexto.cerrarConfirmacion(true);
      await pedido;
      panel.enfocados.length = 0;
      assert.equal(tecla(panel, 'Tab').prevenido, 0);
      assert.equal(tecla(panel, 'Enter', { repeat: true }).prevenido, 0);
      assert.deepEqual(panel.enfocados, []);
    });

    it('conectado al documento: el oyente de keydown aplica lo mismo', async () => {
      const panel = armar({
        Auth: { isAuthenticated: () => true, isAdmin: () => true, isSuperadmin: () => false },
        window: { addEventListener() {}, location: {} },
        location: { hash: '' },
        history: { replaceState() {} }
      });
      for (const id of ['filtro-anio', 'filtro-dataset']) panel.elemento(id).insertAdjacentHTML = () => {};
      panel.escuchasDeDocumento.DOMContentLoaded[0]();
      const pedido = abrir(panel, 'modal-confirmar-aceptar');
      const evento = { key: 'Enter', repeat: true, prevenido: 0, preventDefault() { this.prevenido += 1; } };
      panel.escuchasDeDocumento.keydown[0](evento);
      assert.equal(evento.prevenido, 1);
      await sigueAbierta(panel, pedido);
      panel.contexto.cerrarConfirmacion(false);
      await pedido;
    });
  });

  describe('cableado al cargar la página', () => {
    const iniciar = () => {
      const panel = armar({
        Auth: { isAuthenticated: () => true, isAdmin: () => true, isSuperadmin: () => false },
        window: { addEventListener() {}, location: {} },
        location: { hash: '' },
        history: { replaceState() {} }
      });
      for (const id of ['filtro-anio', 'filtro-dataset']) panel.elemento(id).insertAdjacentHTML = () => {};
      panel.escuchasDeDocumento.DOMContentLoaded[0]();
      return panel;
    };
    const clic = (panel, id, evento = {}) => panel.elemento(id).escuchas.click.forEach(escucha => escucha(evento));
    const presion = (panel, id, evento = {}) => panel.elemento(id).escuchas.mousedown.forEach(escucha => escucha(evento));

    it('cada control tiene un solo oyente y el documento escucha el teclado', () => {
      const panel = iniciar();
      for (const id of ['modal-confirmar-aceptar', 'modal-confirmar-cancelar', 'modal-confirmar', 'modal-nota', 'modal-nota-cerrar']) {
        assert.equal(panel.elemento(id).escuchas.click?.length, 1, `un solo oyente de clic en ${id}`);
      }
      assert.equal(panel.escuchasDeDocumento.keydown?.length, 1);
    });

    it('cada velo tiene un solo oyente de mousedown, para saber dónde empezó la presión', () => {
      const panel = iniciar();
      for (const id of ['modal-confirmar', 'modal-nota']) {
        assert.equal(panel.elemento(id).escuchas.mousedown?.length, 1, `un solo oyente de mousedown en ${id}`);
      }
    });

    it('los botones de la ventana de confirmación aceptan y cancelan', async () => {
      const panel = iniciar();
      const aceptada = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      clic(panel, 'modal-confirmar-aceptar');
      assert.equal(await aceptada, true);
      const cancelada = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      clic(panel, 'modal-confirmar-cancelar');
      assert.equal(await cancelada, false);
    });

    it('el clic afuera cierra cada ventana, pero no el clic adentro', async () => {
      const panel = iniciar();
      const velo = {};
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      clic(panel, 'modal-confirmar', { target: {}, currentTarget: velo });
      assert.equal(panel.abierta(), true);
      presion(panel, 'modal-confirmar', { target: velo, currentTarget: velo });
      clic(panel, 'modal-confirmar', { target: velo, currentTarget: velo });
      assert.equal(await pedido, false);
      notaAbierta(panel);
      clic(panel, 'modal-nota', { target: {}, currentTarget: velo });
      assert.equal(nota(panel).classList.contains('active'), true);
      presion(panel, 'modal-nota', { target: velo, currentTarget: velo });
      clic(panel, 'modal-nota', { target: velo, currentTarget: velo });
      assert.equal(nota(panel).classList.contains('active'), false);
    });

    it('con los oyentes puestos, el doble clic y el arrastre sobre el velo no cierran, y el clic simple con su presión sí', async () => {
      const panel = iniciar();
      const velo = {};
      notaAbierta(panel);
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      for (const id of ['modal-confirmar', 'modal-nota']) {
        presion(panel, id, { target: velo, currentTarget: velo });
        clic(panel, id, { target: velo, currentTarget: velo, detail: 2 });
        presion(panel, id, { target: {}, currentTarget: velo });
        clic(panel, id, { target: velo, currentTarget: velo, detail: 1 });
      }
      assert.equal(panel.abierta(), true, 'ni el doble clic ni el arrastre cancelan la confirmación');
      assert.equal(nota(panel).classList.contains('active'), true, 'ni cierran la nota');
      presion(panel, 'modal-confirmar', { target: velo, currentTarget: velo });
      clic(panel, 'modal-confirmar', { target: velo, currentTarget: velo, detail: 1 });
      assert.equal(await pedido, false);
      presion(panel, 'modal-nota', { target: velo, currentTarget: velo });
      clic(panel, 'modal-nota', { target: velo, currentTarget: velo, detail: 1 });
      assert.equal(nota(panel).classList.contains('active'), false);
    });

    it('la X de la nota la cierra y Escape en el documento cierra la confirmación primero y la nota después', async () => {
      const panel = iniciar();
      notaAbierta(panel);
      clic(panel, 'modal-nota-cerrar');
      assert.equal(nota(panel).classList.contains('active'), false);
      notaAbierta(panel);
      const pedido = panel.contexto.confirmar({ titulo: 'T', texto: 'X', accion: 'Sí' });
      panel.escuchasDeDocumento.keydown[0]({ key: 'Escape' });
      assert.equal(await pedido, false);
      assert.equal(nota(panel).classList.contains('active'), true);
      panel.escuchasDeDocumento.keydown[0]({ key: 'Escape' });
      assert.equal(nota(panel).classList.contains('active'), false);
    });
  });

  describe('correos.html', () => {
    const posicion = (texto) => PAGINA.indexOf(texto);
    const etiqueta = (id) => PAGINA.match(new RegExp(`<[a-z0-9]+\\b[^>]*\\bid="${id}"[^>]*>`))?.[0] ?? '';
    const regla = (selector) => {
      const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
      return PAGINA.match(new RegExp(`(?:^|[}\\s])${escapado}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
    };
    const VENTANA = PAGINA.slice(posicion('id="modal-confirmar"'), posicion('<!-- Footer -->'));

    it('#modal-confirmar es un .modal-overlay que va después de todos los paneles y de #modal-nota', () => {
      assert.match(etiqueta('modal-confirmar'), /^<div\b[^>]*class="modal-overlay"/);
      assert.ok(posicion('id="modal-confirmar"') > PAGINA.lastIndexOf('</section>'), 'fuera de los paneles');
      assert.ok(posicion('id="modal-confirmar"') > posicion('id="modal-nota"'), 'después de la ventana de la nota');
      assert.equal(PAGINA.match(/<section\b/g).length, 4);
      assert.ok(!/\bhidden\b/.test(etiqueta('modal-confirmar')), 'se muestra con .active, no con hidden');
    });

    it('es un diálogo de alerta modal que se anuncia con su título y su texto', () => {
      assert.match(VENTANA, /<div class="modal co-confirmar" role="alertdialog" aria-modal="true" aria-labelledby="modal-confirmar-titulo" aria-describedby="modal-confirmar-texto">/);
      assert.match(etiqueta('modal-confirmar-titulo'), /^<h3 class="modal-title"/);
      assert.match(etiqueta('modal-confirmar-texto'), /^<p\b/);
    });

    it('los dos botones: Cancelar y el de la acción (primario), ambos type="button"', () => {
      assert.match(VENTANA, /<button type="button" class="co-btn" id="modal-confirmar-cancelar">Cancelar<\/button>/);
      assert.match(etiqueta('modal-confirmar-aceptar'), /^<button type="button" class="co-btn primario"/);
      assert.ok(VENTANA.indexOf('id="modal-confirmar-cancelar"') < VENTANA.indexOf('id="modal-confirmar-aceptar"'), 'Cancelar a la izquierda de la acción');
    });

    it('los ids de la ventana de la nota no cambian', () => {
      for (const id of ['modal-nota', 'modal-nota-titulo', 'modal-nota-cerrar', 'modal-nota-datos', 'modal-nota-error', 'modal-nota-cambios', 'modal-nota-marco']) {
        assert.ok(etiqueta(id), id);
      }
      assert.match(etiqueta('modal-nota'), /class="modal-overlay"/);
    });

    it('estilo de la ventana de la nota: radio de 14px, bordes con la línea y título con la tinta', () => {
      assert.match(regla('.nd-modal'), /border-radius:\s*14px/);
      assert.match(regla('.nd-modal .modal-header'), /border-bottom:\s*1px solid var\(--pf-linea\)/);
      assert.match(regla('.nd-modal .modal-title'), /color:\s*var\(--pf-tinta\)/);
    });

    it('estilo de la confirmación: hasta 440px, texto de 0.92rem y los botones a la derecha', () => {
      assert.match(regla('.co-confirmar'), /max-width:\s*440px/);
      assert.match(regla('.co-confirmar .modal-title'), /color:\s*var\(--pf-tinta\)/);
      assert.match(regla('.co-confirmar p'), /font-size:\s*0\.92rem/);
      assert.match(regla('.co-confirmar-botones'), /display:\s*flex[^}]*justify-content:\s*flex-end/);
    });

    it('con movimiento reducido las ventanas aparecen sin transición', () => {
      const inicio = PAGINA.indexOf('@media (prefers-reduced-motion: reduce)');
      const bloque = PAGINA.slice(inicio, PAGINA.indexOf('</style>', inicio));
      assert.match(bloque, /\.modal-overlay,\s*\.modal-overlay\.active,\s*\.modal,\s*\.modal-overlay\.active \.modal\s*\{\s*transition:\s*none;?\s*\}/);
    });

    it('al abrir, la visibilidad del velo y de la caja cambia sin transición (si no, el navegador no deja enfocar el botón)', () => {
      assert.match(regla('.modal-overlay.active'), /transition:\s*opacity[^;]*,\s*visibility 0s/);
      assert.match(regla('.modal-overlay.active .modal'), /transition:\s*transform[^;]*,\s*visibility 0s/);
    });
  });
});

describe('correos.html: CSS sin uso (spec 2026-10-17-correos-pestanas, 9.4)', () => {
  const PAGINA = fs.readFileSync(new URL('../public/correos.html', import.meta.url), 'utf8');
  const CODIGO = fs.readFileSync(new URL('../public/js/correos.js', import.meta.url), 'utf8');
  const inicio = PAGINA.indexOf('<style>');
  const fin = PAGINA.indexOf('</style>');

  // La clase aparece como palabra entera en el texto: "pf-pestana" no cuenta dentro de "pf-pestanas" ni "alerta" dentro de "nd-alerta"
  const aparece = (clase, texto) => new RegExp(`(^|[^\\w-])${clase}($|[^\\w-])`).test(texto);

  it('la comparación es por palabra entera, no por pedazo (en un template literal el \\w se escribe con dos barras)', () => {
    // Si el escape se rompe, [^\w-] pasa a ser [^w-] y estas comparaciones dejan de rechazar las palabras más largas
    assert.equal(aparece('pf-pestana', 'class="pf-pestanas"'), false, 'pf-pestana no está en pf-pestanas');
    assert.equal(aparece('co-proxima', 'co-proximas'), false, 'co-proxima no está en co-proximas');
    assert.equal(aparece('nd-alerta', 'nd-alertas'), false, 'nd-alerta no está en nd-alertas');
    assert.equal(aparece('alerta', 'nd-alerta'), false, 'alerta no está en nd-alerta');
    assert.equal(aparece('co-btn', 'class="co-btn primario"'), true);
    assert.equal(aparece('pf-pestana', 'pf-pestana'), true, 'al principio y al final del texto');
    assert.equal(aparece('active', "classList.add('active')"), true, 'entre comillas y paréntesis');
    assert.equal(aparece('primario', 'class="co-btn primario"'), true);
  });

  it('cada clase del <style> de correos.html se usa en la página o en correos.js', () => {
    assert.ok(inicio !== -1 && fin > inicio, 'la página tiene su <style>');
    const estilo = PAGINA.slice(inicio + '<style>'.length, fin)
      // Los url(...) (las imágenes embebidas traen puntos y letras que no son clases) y los comentarios no cuentan
      .replace(/url\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    // Una clase empieza con letra: ".85rem" no es una clase
    const clases = [...new Set([...estilo.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(coincidencia => coincidencia[1]))];
    assert.ok(clases.length > 20, `se encontraron las clases del <style> (${clases.length})`);
    const resto = PAGINA.slice(0, inicio) + PAGINA.slice(fin) + '\n' + CODIGO;
    for (const clase of clases) {
      assert.ok(aparece(clase, resto), `la clase .${clase} del <style> no se usa en correos.html ni en correos.js`);
    }
  });
});
