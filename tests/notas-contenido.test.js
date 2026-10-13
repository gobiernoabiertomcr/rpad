// Contenido de las Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirNota, renderHtml, renderTexto } from '../services/notasDigitalesContenido.js';

const config = {
  linea_cc_interna: 'CC. Dir. de Investigación Territorial',
  linea_cc_externa: 'CC. Dir. Administrativa',
  firma_nombre: 'Nombre de Firma',
  firma_cargo: 'Cargo de Firma'
};

const dataset = (cambios = {}) => ({
  id: 1, titulo: 'Dataset A', url_dataset: 'https://datos.comodoro.gov.ar/dataset/a', area_id: 10,
  area_nombre: 'Área Uno', frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-31',
  vencimiento: '2026-12-31', informado: null, reiteraciones: 0, antecedente: null, ...cambios
});

const nota = (cambios = {}) => construirNota({
  tipo: 'aviso', gestion: 'interna', numero: 12, anio: 2026, esPrueba: false, fecha: '2026-11-02',
  datasets: [dataset()], areas: [], config, ...cambios
});

const REF = 'Solicitud de gestión de datos para el Portal de Datos Abiertos Municipal';

describe('asunto y número', () => {
  it('aviso interno', () => {
    assert.equal(nota().asunto, `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – noviembre 2026)`);
  });

  it('reiteración externa', () => {
    assert.equal(nota({ tipo: 'reiteracion', gestion: 'externa' }).asunto,
      `Nota Digital N° 12/26 – Ref.: Reiteración – ${REF} (gestión externa – noviembre 2026)`);
  });

  it('prueba y vista previa', () => {
    assert.equal(nota({ numero: null, anio: null, esPrueba: true }).asunto,
      `[PRUEBA] Nota Digital N° PRUEBA – Ref.: ${REF} (gestión interna – noviembre 2026)`);
    assert.equal(nota({ numero: null, anio: null }).numeroTexto, 'XX');
  });
});

describe('secciones', () => {
  it('separa próximos y vencidos y omite las vacías', () => {
    const soloProximo = nota();
    assert.deepEqual(soloProximo.secciones.map(s => s.clave), ['proximo']);
    const ambas = nota({ datasets: [dataset(), dataset({ id: 2, titulo: 'Dataset B', vencimiento: '2026-10-31' })] });
    assert.deepEqual(ambas.secciones.map(s => s.clave), ['proximo', 'vencido']);
    assert.equal(ambas.secciones[1].titulo, 'Plazo de actualización vencido');
    assert.equal(ambas.secciones[1].introduccion, 'Los siguientes conjuntos de datos se encuentran con su plazo de actualización vencido:');
  });

  it('calcula la situación al día de la nota', () => {
    const situacion = (vencimiento) => {
      const s = nota({ datasets: [dataset({ vencimiento })] }).secciones[0];
      return s.filas[0].valores[5];
    };
    assert.equal(situacion('2026-12-31'), 'Faltan 59 días');
    assert.equal(situacion('2026-11-03'), 'Faltan 1 día');
    assert.equal(situacion('2026-11-02'), 'Vence hoy');
    assert.equal(situacion('2026-10-31'), 'Vencido hace 2 días');
  });

  it('un dataset que vence el día de la nota va en próximos', () => {
    assert.equal(nota({ datasets: [dataset({ vencimiento: '2026-11-02' })] }).secciones[0].clave, 'proximo');
  });

  it('columnas de aviso interno y de reiteración externa vencida', () => {
    assert.deepEqual(nota().secciones[0].columnas,
      ['Conjunto de datos', 'Área', 'Frecuencia', 'Última actualización', 'Vence', 'Situación']);
    const reiteracion = nota({ tipo: 'reiteracion', gestion: 'externa', datasets: [dataset({ vencimiento: '2026-10-31' })] });
    assert.deepEqual(reiteracion.secciones[0].columnas,
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Última actualización', 'Venció', 'Situación', 'Informado en']);
  });

  it('informado en, con la cantidad de reiteraciones', () => {
    const informado = (reiteraciones) => nota({
      tipo: 'reiteracion',
      datasets: [dataset({ informado: { numero: 9, anio: 2026, fecha: '2026-10-01' }, reiteraciones })]
    }).secciones[0].filas[0].valores[6];
    assert.equal(informado(0), 'Nota Digital N° 9/26 (01/10/2026)');
    assert.equal(informado(1), 'Nota Digital N° 9/26 (01/10/2026) – reiterado 1 vez');
    assert.equal(informado(2), 'Nota Digital N° 9/26 (01/10/2026) – reiterado 2 veces');
  });

  it('antecedente de emails anteriores, solo en avisos', () => {
    const antecedente = (datos, tipo = 'aviso') => nota({ tipo, datasets: [dataset({ antecedente: datos })] }).secciones[0].filas[0].antecedente;
    assert.equal(antecedente({ cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' }),
      'Antecedente: notificado a la DGMIT por correo electrónico en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026.');
    assert.equal(antecedente({ cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' }),
      'Antecedente: notificado a la DGMIT por correo electrónico el 01/10/2026.');
    assert.equal(antecedente({ cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' }, 'reiteracion'), null);
  });
});

describe('contactos', () => {
  const area = { id: 10, nombre: 'Área Uno', area_superior: 'Secretaría X', email_principal: 'uno@comodoro.gov.ar',
    email_secundario: null, telefono_area: '', celular_area: null, nombre_contacto: 'Persona', telefono_contacto: null, email_contacto: null };

  it('una entrada por área en la gestión externa, sin campos vacíos', () => {
    const externa = nota({ gestion: 'externa', datasets: [dataset(), dataset({ id: 2 })], areas: [area] });
    assert.deepEqual(externa.contactos, [{
      nombre: 'Área Uno',
      lineas: ['Depende de: Secretaría X', 'Email: uno@comodoro.gov.ar', 'Persona de contacto: Persona']
    }]);
  });

  it('área sin datos de contacto', () => {
    const vacia = { id: 11, nombre: 'Área Dos' };
    assert.deepEqual(nota({ gestion: 'externa', areas: [vacia] }).contactos,
      [{ nombre: 'Área Dos', lineas: ['Sin datos de contacto registrados'] }]);
  });

  it('la gestión interna no lleva contactos', () => {
    assert.deepEqual(nota({ areas: [area] }).contactos, []);
  });
});

describe('HTML', () => {
  it('escapa los datos y no deja links que no sean http/https', () => {
    const html = renderHtml(nota({ datasets: [dataset({ titulo: '<script>alert(1)</script>', url_dataset: 'javascript:alert(1)' })] }));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!html.includes('javascript:'));
  });

  it('enlaza el título cuando la URL es http/https', () => {
    assert.ok(renderHtml(nota()).includes('<a href="https://datos.comodoro.gov.ar/dataset/a"'));
  });

  it('incluye los textos del aviso interno', () => {
    const html = renderHtml(nota());
    assert.ok(html.includes('Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación'));
    assert.ok(html.includes('<b><u>DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL</u></b>'));
    assert.ok(html.includes('Ordenanza N° 17.662/23'));
    assert.ok(html.includes('Índice Nacional de Datos Abiertos'));
    assert.ok(html.includes('<b><u>DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN</u></b>, 2 de noviembre de 2026.'));
    assert.ok(html.includes('Nombre de Firma<br>Cargo de Firma'));
    assert.ok(html.includes('CC. Dir. de Investigación Territorial'));
  });

  it('la reiteración usa la justificación abreviada', () => {
    const html = renderHtml(nota({ tipo: 'reiteracion' }));
    assert.ok(html.includes('Informo a Ud. el estado, al día de la fecha'));
    assert.ok(!html.includes('Índice Nacional'));
  });
});

describe('texto plano', () => {
  it('lleva los mismos datos que el HTML', () => {
    const texto = renderTexto(nota({ gestion: 'externa', areas: [{ id: 10, nombre: 'Área Uno', email_principal: 'uno@comodoro.gov.ar' }] }));
    assert.ok(texto.includes(`REF.: "${REF}"`));
    assert.ok(texto.includes('Nota Digital N° 12/26'));
    assert.ok(texto.includes('- Dataset A (https://datos.comodoro.gov.ar/dataset/a)'));
    assert.ok(texto.includes('    Situación: Faltan 59 días'));
    assert.ok(texto.includes('    Email: uno@comodoro.gov.ar'));
    assert.ok(texto.trimEnd().endsWith('CC. Dir. Administrativa'));
  });
});
