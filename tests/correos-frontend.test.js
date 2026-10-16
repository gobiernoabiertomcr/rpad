// Pantalla de Correos (public/js/correos.js), ejecutada en Node con un DOM mínimo
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

// correos.js es un script de navegador: se ejecuta en un contexto aislado con los elementos y la API que usa la vista
// previa. El pedido del anexo queda pendiente hasta que el test lo resuelve.
const cargarCorreos = () => {
  const elementos = {};
  const elemento = (id) => {
    elementos[id] ??= { id, value: '', disabled: false, title: '', hidden: false, textContent: '', addEventListener() {} };
    return elementos[id];
  };
  elemento('preview-tipo').value = 'aviso';
  elemento('preview-gestion').value = 'interna';
  const pendientes = [];
  const contexto = vm.createContext({
    document: { getElementById: elemento, addEventListener() {}, createElement: () => ({ click() {} }) },
    API: { previewNotaAnexo: () => new Promise(resolve => pendientes.push(resolve)) },
    URL: { createObjectURL: () => 'blob:anexo', revokeObjectURL() {} },
    Utils: { escapeHtml: (texto) => texto },
    showToast() {},
    setTimeout: () => 0,
    console
  });
  vm.runInContext(fs.readFileSync(new URL('../public/js/correos.js', import.meta.url), 'utf8'), contexto);
  // Lo que hace el navegador cuando cambia el tipo de nota de la vista previa
  const elegirTipo = (tipo) => {
    elemento('preview-tipo').value = tipo;
    contexto.actualizarBotonAnexo();
  };
  return { contexto, boton: elemento('btn-preview-anexo'), elegirTipo, terminarPedido: () => pendientes.shift()({}) };
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
