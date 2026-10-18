// Contenido de las Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirNota, construirNotaDeAutorizacion, construirNotaDeAuditoria, textoLeyendaAutorizacion, textoAdelanto, renderHtml, renderTexto, cargoEnTexto
} from '../services/notasDigitalesContenido.js';
import { RPAD_URL } from '../services/emailTemplates.js';

const config = {
  linea_cc_interna: 'CC. Dir. de Investigación Territorial',
  linea_cc_externa: 'CC. Dir. Administrativa',
  firma_nombre: 'Nombre de Firma',
  firma_cargo: 'Cargo de Firma'
};

// El pedido es el de la selección (Task 11): un anual acumulado que vence el 31/12/2026 pide hasta el corte del 30/11
const PEDIDO = { desde: '2026-01-01', hasta: '2026-11-30', texto: 'Del 01/01/2026 al 30/11/2026' };
// El de uno que venció el 31/10/2026: hasta el corte del 30/09
const PEDIDO_OCTUBRE = { desde: '2026-01-01', hasta: '2026-09-30', texto: 'Del 01/01/2026 al 30/09/2026' };
const dataset = (cambios = {}) => ({
  id: 1, titulo: 'Dataset A', url_dataset: 'https://datos.comodoro.gov.ar/dataset/a', area_id: 10,
  area_nombre: 'Área Uno', frecuencia_nombre: 'Anualmente', ultima_actualizacion: '2025-12-31',
  vencimiento: '2026-12-31', pedido: PEDIDO, informado: null, reiteraciones: 0, antecedente: null, ...cambios
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

  // (spec 2026-10-17-fechas-datasets, 9: el aviso no tiene "Situación"; la reiteración sí, en la sexta columna)
  it('calcula la situación al día de la nota', () => {
    const situacion = (vencimiento) => {
      const s = nota({ tipo: 'reiteracion', datasets: [dataset({ vencimiento })] }).secciones[0];
      return s.filas[0].valores[5];
    };
    assert.equal(situacion('2026-12-31'), 'Faltan 59 días');
    assert.equal(situacion('2026-11-03'), 'Falta 1 día');
    assert.equal(situacion('2026-11-02'), 'Vence hoy');
    assert.equal(situacion('2026-10-31'), 'Vencido hace 2 días');
  });

  it('un dataset que vence el día de la nota va en próximos', () => {
    assert.equal(nota({ datasets: [dataset({ vencimiento: '2026-11-02' })] }).secciones[0].clave, 'proximo');
  });

  // Spec 2026-10-17-fechas-datasets, 9: el aviso tiene 5 columnas (se van "Última actualización" y "Situación") y la
  // reiteración, las 7 de siempre con "Datos solicitados" en lugar de "Última actualización" e "Informado en" al final
  it('columnas exactas del aviso: 5, con "Datos solicitados" y "Fecha sugerida de envío"', () => {
    assert.deepEqual(nota().secciones[0].columnas,
      ['Conjunto de datos', 'Área', 'Frecuencia', 'Datos solicitados', 'Fecha sugerida de envío']);
    assert.deepEqual(nota({ gestion: 'externa' }).secciones[0].columnas,
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Datos solicitados', 'Fecha sugerida de envío']);
  });

  it('columnas exactas de la reiteración: 7, con "Datos solicitados" y con "Informado en" al final', () => {
    const reiteracion = (gestion) => nota({
      tipo: 'reiteracion', gestion, datasets: [dataset(), dataset({ id: 2, titulo: 'Dataset B', vencimiento: '2026-10-31' })]
    });
    assert.deepEqual(reiteracion('externa').secciones.map(s => s.columnas), [
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Datos solicitados', 'Vence', 'Situación', 'Informado en'],
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Datos solicitados', 'Venció', 'Situación', 'Informado en']
    ]);
    assert.deepEqual(reiteracion('interna').secciones[1].columnas,
      ['Conjunto de datos', 'Área', 'Frecuencia', 'Datos solicitados', 'Venció', 'Situación', 'Informado en']);
  });

  it('la sección de vencidos de un aviso usa las columnas de la reiteración', () => {
    const aviso = nota({ gestion: 'externa', datasets: [dataset(), dataset({ id: 2, titulo: 'Dataset B', vencimiento: '2026-10-31', pedido: PEDIDO_OCTUBRE })] });
    assert.deepEqual(aviso.secciones.map(s => s.columnas), [
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Datos solicitados', 'Fecha sugerida de envío'],
      ['Conjunto de datos', 'Área responsable', 'Frecuencia', 'Datos solicitados', 'Venció', 'Situación', 'Informado en']
    ]);
    assert.deepEqual(aviso.secciones[1].filas[0].valores,
      ['Dataset B', 'Área Uno', 'Anualmente', 'Del 01/01/2026 al 30/09/2026', '31/10/2026', 'Vencido hace 2 días', 'Sin aviso previo']);
  });

  it('celdas del aviso: el texto del pedido y la fecha sugerida de envío (el vencimiento)', () => {
    assert.deepEqual(nota().secciones[0].filas[0].valores,
      ['Dataset A', 'Área Uno', 'Anualmente', 'Del 01/01/2026 al 30/11/2026', '31/12/2026']);
    const otro = { desde: null, hasta: null, texto: 'Relevamiento actualizado' };
    assert.deepEqual(nota({ datasets: [dataset({ pedido: otro, vencimiento: '2027-01-31' })] }).secciones[0].filas[0].valores,
      ['Dataset A', 'Área Uno', 'Anualmente', 'Relevamiento actualizado', '31/01/2027']);
  });

  it('celdas de la reiteración: el pedido en la cuarta, y "Venció", "Situación" e "Informado en" detrás', () => {
    const fila = nota({
      tipo: 'reiteracion', gestion: 'externa',
      datasets: [dataset({ vencimiento: '2026-10-31', pedido: PEDIDO_OCTUBRE, informado: { numero: 9, anio: 2026, fecha: '2026-10-01' } })]
    }).secciones[0].filas[0];
    assert.deepEqual(fila.valores, ['Dataset A', 'Área Uno', 'Anualmente', 'Del 01/01/2026 al 30/09/2026', '31/10/2026',
      'Vencido hace 2 días', 'Nota Digital N° 9/26 (01/10/2026)']);
  });

  it('sin pedido (eventual o sin datos para calcularlo), "Datos solicitados" dice "—"', () => {
    for (const pedido of [null, undefined]) {
      assert.equal(nota({ datasets: [dataset({ pedido })] }).secciones[0].filas[0].valores[3], '—', String(pedido));
      assert.equal(nota({ tipo: 'reiteracion', datasets: [dataset({ pedido })] }).secciones[0].filas[0].valores[3], '—', String(pedido));
    }
    assert.ok(renderHtml(nota({ datasets: [dataset({ pedido: null })] })).includes('>—</td>'));
  });

  it('ninguna nota nueva muestra la columna "Última actualización"', () => {
    for (const tipo of ['aviso', 'reiteracion']) {
      for (const gestion of ['interna', 'externa']) {
        const n = nota({ tipo, gestion, datasets: [dataset(), dataset({ id: 2, vencimiento: '2026-10-31' })] });
        assert.ok(n.secciones.every(s => !s.columnas.includes('Última actualización')), `${tipo} ${gestion}`);
        assert.ok(!renderHtml(n).includes('Última actualización') && !renderTexto(n).includes('Última actualización'), `${tipo} ${gestion}`);
      }
    }
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

  it('el aviso lleva el antecedente de emails anteriores en una fila a todo el ancho', () => {
    const fila = (datos) => nota({ datasets: [dataset({ antecedente: datos })] }).secciones[0].filas[0];
    assert.equal(fila({ cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' }).antecedente,
      'Antecedente: notificado a la DGMIT por correo electrónico en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026.');
    assert.equal(fila({ cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' }).antecedente,
      'Antecedente: notificado a la DGMIT por correo electrónico el 01/10/2026.');
    assert.equal(fila(null).antecedente, null);
    assert.equal(fila({ cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' }).informadoAnterior, null);
  });
});

// Pedido del usuario el 14/10/2026 (spec 5.3 y 6.4): en las reiteraciones el antecedente de los emails anteriores va
// dentro de la celda "Informado en", después del texto de la nota, como segunda parte en letra más chica
describe('reiteración: antecedente en "Informado en"', () => {
  const AVISO = { numero: 2, anio: 2026, fecha: '2026-10-13' };
  const DIEZ = { cantidad: 10, primera: '2026-01-01', ultima: '2026-10-01' };
  const UNA = { cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' };
  const fila = (cambios) => nota({ tipo: 'reiteracion', gestion: 'externa', datasets: [dataset(cambios)] }).secciones[0].filas[0];
  // La celda completa, como la lee el texto plano
  const celda = (f) => [f.valores.at(-1), f.informadoAnterior].filter(Boolean).join(' ');

  it('con aviso y antecedente de varios emails: texto exacto, y sin fila a todo el ancho', () => {
    const f = fila({ informado: AVISO, antecedente: DIEZ });
    assert.equal(f.valores.at(-1), 'Nota Digital N° 2/26 (13/10/2026).');
    assert.equal(f.informadoAnterior, 'Anteriormente notificado DGMIT por e-mail en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026');
    assert.equal(celda(f), 'Nota Digital N° 2/26 (13/10/2026). Anteriormente notificado DGMIT por e-mail en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026');
    assert.equal(f.antecedente, null);
  });

  it('un solo email: "… por e-mail el {fecha}"', () => {
    assert.equal(celda(fila({ informado: AVISO, antecedente: UNA })),
      'Nota Digital N° 2/26 (13/10/2026). Anteriormente notificado DGMIT por e-mail el 01/10/2026');
  });

  it('"– reiterado N vez/veces" va antes del punto', () => {
    assert.equal(celda(fila({ informado: AVISO, reiteraciones: 1, antecedente: DIEZ })),
      'Nota Digital N° 2/26 (13/10/2026) – reiterado 1 vez. Anteriormente notificado DGMIT por e-mail en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026');
    assert.equal(celda(fila({ informado: AVISO, reiteraciones: 2, antecedente: UNA })),
      'Nota Digital N° 2/26 (13/10/2026) – reiterado 2 veces. Anteriormente notificado DGMIT por e-mail el 01/10/2026');
  });

  it('un vencido sin aviso previo también lo lleva, con o sin "reiterado"', () => {
    const sinAviso = fila({ vencimiento: '2026-09-30', informado: null, reiteraciones: 2, antecedente: { cantidad: 3, primera: '2026-07-01', ultima: '2026-09-01' } });
    assert.equal(celda(sinAviso), 'Sin aviso previo – reiterado 2 veces. Anteriormente notificado DGMIT por e-mail en 3 oportunidades, entre el 01/07/2026 y el 01/09/2026');
    assert.equal(sinAviso.antecedente, null);
    assert.equal(celda(fila({ vencimiento: '2026-09-30', informado: null, antecedente: UNA })),
      'Sin aviso previo. Anteriormente notificado DGMIT por e-mail el 01/10/2026');
  });

  it('sin antecedente, la celda queda como antes: sin punto ni segunda oración', () => {
    const conAviso = fila({ informado: AVISO, reiteraciones: 1 });
    assert.equal(conAviso.valores.at(-1), 'Nota Digital N° 2/26 (13/10/2026) – reiterado 1 vez');
    assert.equal(conAviso.informadoAnterior, null);
    assert.equal(fila({ vencimiento: '2026-09-30', informado: null }).valores.at(-1), 'Sin aviso previo');
  });

  it('HTML: la segunda oración va en la misma celda, escapada y en letra más chica; no hay fila a todo el ancho', () => {
    const html = renderHtml(nota({ tipo: 'reiteracion', datasets: [dataset({ informado: AVISO, antecedente: DIEZ })] }));
    assert.ok(html.includes('>Nota Digital N° 2/26 (13/10/2026).<br><span style="font-size:11px">Anteriormente notificado DGMIT por e-mail en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026</span></td>'), html);
    assert.ok(!html.includes('colspan'));
    assert.ok(!html.includes('Antecedente:'));
    // Sin antecedente, la celda no cambia
    assert.ok(renderHtml(nota({ tipo: 'reiteracion', datasets: [dataset({ informado: AVISO })] })).includes('>Nota Digital N° 2/26 (13/10/2026)</td>'));
    // Escapado, como todo lo que se escribe en el HTML
    const raro = renderHtml(nota({ tipo: 'reiteracion', datasets: [dataset({ informado: AVISO, antecedente: { cantidad: 2, primera: '<x>', ultima: '2026-10-01' } })] }));
    assert.ok(!raro.includes('<x>') && raro.includes('&lt;x&gt;'));
  });

  it('texto plano: en la misma línea de "Informado en", después del punto', () => {
    const texto = renderTexto(nota({ tipo: 'reiteracion', datasets: [dataset({ informado: AVISO, antecedente: DIEZ })] }));
    assert.ok(texto.includes('    Informado en: Nota Digital N° 2/26 (13/10/2026). Anteriormente notificado DGMIT por e-mail en 10 oportunidades, entre el 01/01/2026 y el 01/10/2026\n'), texto);
    assert.ok(!texto.includes('Antecedente:'));
  });

  it('el aviso no la usa: sigue con la fila a todo el ancho', () => {
    const html = renderHtml(nota({ datasets: [dataset({ antecedente: DIEZ })] }));
    assert.ok(html.includes('colspan="5"'));
    assert.ok(!html.includes('Anteriormente notificado'));
  });

  it('la fila del antecedente ocupa todas las columnas de su tabla: 5 en los próximos y 7 en los vencidos de un aviso', () => {
    const n = nota({ datasets: [dataset({ antecedente: DIEZ }), dataset({ id: 2, vencimiento: '2026-10-31', antecedente: UNA })] });
    assert.deepEqual(n.secciones.map(s => s.columnas.length), [5, 7]);
    const html = renderHtml(n);
    const colspans = [...html.matchAll(/<td colspan="(\d+)"/g)].map(m => Number(m[1]));
    assert.deepEqual(colspans, n.secciones.map(s => s.columnas.length));
    // Cada fila del antecedente va inmediatamente debajo de la de su dataset
    for (const seccion of n.secciones) {
      assert.ok(html.includes(`</td></tr><tr><td colspan="${seccion.columnas.length}" style=`), seccion.clave);
    }
  });
});

describe('contactos', () => {
  const area = { id: 10, nombre: 'Área Uno', area_superior: 'Secretaría X', email_principal: 'uno@ejemplo.gov.ar',
    email_secundario: null, telefono_area: '', celular_area: null, nombre_contacto: 'Persona', telefono_contacto: null, email_contacto: null };

  it('una entrada por área en la gestión externa, sin campos vacíos', () => {
    const externa = nota({ gestion: 'externa', datasets: [dataset(), dataset({ id: 2 })], areas: [area] });
    assert.deepEqual(externa.contactos, [{
      nombre: 'Área Uno',
      lineas: ['Depende de: Secretaría X', 'Email: uno@ejemplo.gov.ar', 'Persona de contacto: Persona']
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
    assert.ok(html.includes('<b><u>DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN</u></b>, 2 de noviembre de 2026.'));
    assert.ok(html.includes('Nombre de Firma<br>Cargo de Firma'));
    assert.ok(html.includes('CC. Dir. de Investigación Territorial'));
  });

  it('empieza avisando, en bordó y negrita, que la nota y su anexo van adjuntos en PDF', () => {
    const html = renderHtml(nota());
    const aviso = '<p style="margin:0 0 20px;color:#800000;font-weight:bold;">SE ADJUNTAN NOTA Y ANEXO EN PDF</p>';
    assert.ok(html.includes(aviso));
    assert.ok(html.indexOf(aviso) < html.indexOf('REF.:'));
  });

  it('la reiteración usa la justificación abreviada', () => {
    const html = renderHtml(nota({ tipo: 'reiteracion' }));
    assert.ok(html.includes('Informo a Ud. el estado, al día de la fecha'));
    assert.ok(!html.includes('Índice Nacional'));
  });
});

describe('texto plano', () => {
  it('lleva los mismos datos que el HTML', () => {
    const texto = renderTexto(nota({ gestion: 'externa', areas: [{ id: 10, nombre: 'Área Uno', email_principal: 'uno@ejemplo.gov.ar' }] }));
    assert.ok(texto.startsWith(`SE ADJUNTAN NOTA Y ANEXO EN PDF\n\nREF.: "${REF}"`));
    assert.ok(texto.includes('Nota Digital N° 12/26'));
    assert.ok(texto.includes('- Dataset A (https://datos.comodoro.gov.ar/dataset/a)'));
    assert.ok(texto.includes('    Email: uno@ejemplo.gov.ar'));
    assert.ok(texto.trimEnd().endsWith('CC. Dir. Administrativa'));
  });

  // Spec 2026-10-17-fechas-datasets, 9: cada columna nueva sale como una línea más de la fila, en el orden de la tabla
  it('el aviso: "Datos solicitados" y "Fecha sugerida de envío", sin "Situación" ni "Última actualización"', () => {
    const texto = renderTexto(nota({ gestion: 'externa' }));
    assert.ok(texto.includes([
      '- Dataset A (https://datos.comodoro.gov.ar/dataset/a)',
      '    Área responsable: Área Uno',
      '    Frecuencia: Anualmente',
      '    Datos solicitados: Del 01/01/2026 al 30/11/2026',
      '    Fecha sugerida de envío: 31/12/2026',
      ''
    ].join('\n')), texto);
    assert.ok(!texto.includes('Situación:') && !texto.includes('Última actualización:'), texto);
  });

  it('la reiteración: "Datos solicitados" en lugar de "Última actualización", e "Informado en" al final', () => {
    const texto = renderTexto(nota({
      tipo: 'reiteracion', datasets: [dataset({ vencimiento: '2026-10-31', pedido: PEDIDO_OCTUBRE, informado: { numero: 9, anio: 2026, fecha: '2026-10-01' } })]
    }));
    assert.ok(texto.includes([
      '- Dataset A (https://datos.comodoro.gov.ar/dataset/a)',
      '    Área: Área Uno',
      '    Frecuencia: Anualmente',
      '    Datos solicitados: Del 01/01/2026 al 30/09/2026',
      '    Venció: 31/10/2026',
      '    Situación: Vencido hace 2 días',
      '    Informado en: Nota Digital N° 9/26 (01/10/2026)',
      ''
    ].join('\n')), texto);
  });

  it('sin pedido: "    Datos solicitados: —"', () => {
    assert.ok(renderTexto(nota({ datasets: [dataset({ pedido: null })] })).includes('    Datos solicitados: —\n'));
  });
});

describe('textos del 14/10/2026', () => {
  it('el aviso interno dice "En tal sentido, solicito"', () => {
    assert.ok(nota().parrafoInicial.includes('requieren ser actualizados. En tal sentido, solicito tenga a bien gestionar su actualización'));
  });

  it('ninguna justificación menciona el WhatsApp', () => {
    for (const tipo of ['aviso', 'reiteracion']) {
      const texto = nota({ tipo }).justificacion.join(' ');
      assert.ok(!texto.includes('WhatsApp'), tipo);
      assert.ok(texto.includes('datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar'), tipo);
    }
    assert.equal(nota().justificacion[1],
      'La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.');
    assert.equal(nota({ tipo: 'reiteracion' }).justificacion[0],
      'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar). La información actualizada puede ser remitida a datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar, y será publicada en cumplimiento del Artículo 9° de la mencionada ordenanza.');
  });

  it('el aviso lleva la línea del anexo con la cantidad de hojas; la reiteración no', () => {
    assert.equal(nota().anexo, 'Anexo: reporte de los conjuntos de datos (1 hoja).');
    assert.equal(nota({ datasets: [dataset(), dataset({ id: 2, titulo: 'Dataset B' })] }).anexo,
      'Anexo: reporte de los conjuntos de datos (2 hojas).');
    assert.equal(nota({ tipo: 'reiteracion' }).anexo, null);
  });

  it('la línea del anexo va antes de "Justificación:" en el HTML y en el texto', () => {
    const linea = 'Anexo: reporte de los conjuntos de datos (1 hoja).';
    const html = renderHtml(nota());
    assert.ok(html.includes(linea) && html.indexOf(linea) < html.indexOf('Justificación:'));
    const texto = renderTexto(nota());
    assert.ok(texto.includes(linea) && texto.indexOf(linea) < texto.indexOf('Justificación:'));
    assert.ok(!renderHtml(nota({ tipo: 'reiteracion' })).includes('Anexo:'));
  });

  it('el email del aviso anuncia nota y anexo; el de la reiteración, solo la nota', () => {
    assert.ok(renderHtml(nota()).includes('>SE ADJUNTAN NOTA Y ANEXO EN PDF</p>'));
    assert.ok(renderTexto(nota()).startsWith('SE ADJUNTAN NOTA Y ANEXO EN PDF\n\n'));
    assert.ok(renderHtml(nota({ tipo: 'reiteracion' })).includes('>SE ADJUNTA NOTA EN PDF</p>'));
  });
});

// Spec 2026-10-17-fechas-datasets, 9: solo el aviso externo pide el período y la fecha sugerida de envío; el párrafo del
// interno no cambia (casi todos sus pedidos son relevamientos, sin fechas)
describe('párrafo inicial con los datos solicitados', () => {
  const FRASE = ', con los datos del período que se indica en cada caso y, de ser posible, antes de la fecha sugerida de envío';

  it('el aviso externo, con la frase antes del punto final', () => {
    assert.equal(nota({ gestion: 'externa' }).parrafoInicial,
      'Informo a Ud. que los conjuntos de datos detallados a continuación, publicados en el Portal de Datos Abiertos Municipal y provistos por otras áreas municipales y organismos, requieren ser actualizados. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.), con los datos del período que se indica en cada caso y, de ser posible, antes de la fecha sugerida de envío.');
  });

  it('el aviso interno y las reiteraciones no la llevan, y quedan como estaban', () => {
    assert.equal(nota().parrafoInicial,
      'Informo a Ud. que los conjuntos de datos de gestión interna detallados a continuación, publicados en el Portal de Datos Abiertos Municipal, requieren ser actualizados. En tal sentido, solicito tenga a bien gestionar su actualización ante las áreas de esta Dirección General responsables de su producción.');
    assert.equal(nota({ tipo: 'reiteracion', gestion: 'externa' }).parrafoInicial,
      'Informo a Ud. el estado, al día de la fecha, de los conjuntos de datos informados oportunamente que continúan pendientes de actualización en el Portal de Datos Abiertos Municipal. Solicito tenga a bien gestionar, por las vías administrativas correspondientes, ante las áreas responsables, la remisión de la información actualizada en formato digital editable (Excel, CSV, etc.).');
    for (const [tipo, gestion] of [['aviso', 'interna'], ['reiteracion', 'interna'], ['reiteracion', 'externa']]) {
      const n = nota({ tipo, gestion });
      assert.ok(![n.parrafoInicial, renderHtml(n), renderTexto(n)].some(t => t.includes(FRASE)), `${tipo} ${gestion}`);
    }
  });

  it('el HTML y el texto del aviso externo la llevan una sola vez', () => {
    const n = nota({ gestion: 'externa' });
    assert.equal(renderHtml(n).split(FRASE).length - 1, 1);
    assert.equal(renderTexto(n).split(FRASE).length - 1, 1);
  });
});

describe('textos del 15/10/2026', () => {
  it('ninguna nota menciona el Índice Nacional de Datos Abiertos: el aviso queda con dos párrafos de justificación', () => {
    for (const tipo of ['aviso', 'reiteracion']) {
      for (const gestion of ['interna', 'externa']) {
        const n = nota({ tipo, gestion });
        for (const texto of [n.justificacion.join(' '), renderHtml(n), renderTexto(n)]) {
          assert.ok(!texto.includes('Índice Nacional'), `${tipo} ${gestion}`);
          assert.ok(!texto.includes('Cabe destacar'), `${tipo} ${gestion}`);
        }
      }
    }
    assert.deepEqual(nota().justificacion, [
      'La presente se enmarca en la Ordenanza N° 17.662/23, que promueve mantener actualizados los datos, tanto de áreas municipales como de organismos externos, en el Portal de Datos Abiertos Municipal (datos.comodoro.gov.ar).',
      'La información actualizada puede ser remitida a los correos electrónicos datospublicos@comodoro.gov.ar o mit@comodoro.gov.ar. Una vez recibida, será publicada en el Portal de Datos Abiertos Municipal en cumplimiento del Artículo 9° de la mencionada ordenanza.'
    ]);
  });
});

const AUTORIZADA = { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', desde: '2026-11-26', hasta: '2027-01-14' };
const PARRAFO_AUTORIZACION = 'Asimismo, por medio de la presente autorizo expresamente a Persona Autorizada, Cargo Autorizado, a presentar en mi nombre las Notas Digitales durante mi licencia, del 26/11/2026 al 14/01/2027, con el objetivo de mantener el correcto flujo de trabajo.';
const LEYENDA = 'Nota presentada por Persona Autorizada, Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).';

describe('firma con autorización (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.2)', () => {
  const firma = {
    titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' },
    presentante: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado' },
    leyenda: LEYENDA
  };

  it('la leyenda cita la nota de autorización', () => {
    assert.equal(textoLeyendaAutorizacion({
      presentante: firma.presentante, titular: firma.titular, nota: { numero: 15, anio: 2026 }, licencia: AUTORIZADA
    }), LEYENDA);
  });

  it('sin firma usa la de la configuración, sin presentante ni leyenda', () => {
    assert.deepEqual(nota().firma, { nombre: 'Nombre de Firma', cargo: 'Cargo de Firma', contratado: false, presentante: null, leyenda: null });
  });

  it('con la firma del titular sola, la nota firma con sus datos', () => {
    const n = nota({ firma: { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null } });
    assert.deepEqual(n.firma, { nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado: false, presentante: null, leyenda: null });
  });

  it('HTML: las dos firmas lado a lado (quien presenta a la izquierda), escapadas, y la leyenda', () => {
    const html = renderHtml(nota({ firma: { ...firma, presentante: { nombre: 'Persona <b>Autorizada</b>', cargo: 'Cargo Autorizado' } } }));
    const izquierda = html.indexOf('Persona &lt;b&gt;Autorizada&lt;/b&gt;<br>Cargo Autorizado');
    const derecha = html.indexOf('Persona Titular<br>Cargo Titular');
    assert.ok(izquierda > 0 && derecha > izquierda, 'quien presenta va antes (a la izquierda) que el titular');
    assert.ok(html.includes('conforme a la autorización conferida mediante Nota Digital N° 15/26'));
  });

  it('HTML sin presentante: el bloque de firma queda exactamente como antes', () => {
    assert.ok(renderHtml(nota()).includes('<p style="margin:32px 0 0;text-align:right;">Nombre de Firma<br>Cargo de Firma</p>'));
  });

  it('texto plano: quien presenta, el titular y la leyenda, antes de la línea de CC', () => {
    assert.ok(renderTexto(nota({ firma })).includes(`Persona Autorizada\nCargo Autorizado\n\nPersona Titular\nCargo Titular\n\n${LEYENDA}\n\nCC. Dir. de Investigación Territorial`));
  });
});

describe('párrafo de autorización en los avisos de la víspera (spec 7.2)', () => {
  it('va inmediatamente después del primer párrafo, antes de las secciones, los contactos y el anexo, en el HTML y en el texto', () => {
    const n = nota({ gestion: 'externa', autorizacion: AUTORIZADA, areas: [{ id: 10, nombre: 'Área Uno', email_principal: 'area@rpad.test' }] });
    assert.equal(n.autorizacion, PARRAFO_AUTORIZACION);
    const html = renderHtml(n);
    const en = (salida, texto) => {
      const i = salida.indexOf(texto);
      assert.ok(i >= 0, `falta "${texto}"`);
      return i;
    };
    const ordenado = (salida) => {
      const orden = ['Informo a Ud. que', 'Asimismo, por medio de la presente', 'Próximos a vencer', 'Dataset A', 'Datos de contacto de las áreas responsables', 'Anexo: reporte']
        .map(t => en(salida, t));
      assert.deepEqual(orden, [...orden].sort((a, b) => a - b), `orden: ${orden}`);
    };
    ordenado(html);
    // Nada entre el cierre del primer párrafo y el de autorización, ni entre este y el título de la primera sección
    assert.ok(html.includes(`${n.parrafoInicial}</p>\n<p style="margin:0 0 12px;text-align:justify;">${PARRAFO_AUTORIZACION}</p>\n<p style="margin:16px 0 6px;"><b>Próximos a vencer</b></p>`));
    const texto = renderTexto(n);
    ordenado(texto);
    assert.ok(texto.includes(`${n.parrafoInicial}\n\n${PARRAFO_AUTORIZACION}\n\nPróximos a vencer\n`));
  });

  it('en una reiteración y sin contactos también va después del primer párrafo y antes de las secciones', () => {
    const n = nota({ tipo: 'reiteracion', autorizacion: AUTORIZADA });
    const html = renderHtml(n);
    assert.ok(html.includes(`${n.parrafoInicial}</p>\n<p style="margin:0 0 12px;text-align:justify;">${PARRAFO_AUTORIZACION}</p>\n<p style="margin:16px 0 6px;"><b>Próximos a vencer</b></p>`));
    assert.ok(renderTexto(n).includes(`${n.parrafoInicial}\n\n${PARRAFO_AUTORIZACION}\n\nPróximos a vencer\n`));
  });

  it('sin autorización, la nota no lo lleva', () => {
    assert.equal(nota().autorizacion, null);
    assert.ok(!renderHtml(nota()).includes('Asimismo'));
  });
});

// Aviso en su fecha con persona autorizada (spec 2026-10-15-dias-habiles-licencias-auditoria, 7.6): los datasets que la nota
// anticipada de la víspera ya había pedido traen adelantado { numero, anio, fecha }; el aviso de su fecha cita esa nota
describe('textoAdelanto: la nota que adelantó el pedido (spec 7.6)', () => {
  const NOTA_10 = { numero: 10, anio: 2026, fecha: '2026-12-09' };
  const NOTA_11 = { numero: 11, anio: 2026, fecha: '2026-12-22' };
  const adelantado = (titulo, nota) => dataset({ titulo, adelantado: nota });
  const CITA_10 = 'Nota Digital N° 10/26 del 09/12/2026';
  const CITA_11 = 'Nota Digital N° 11/26 del 22/12/2026';

  it('ningún dataset con adelantado (o ninguno): null', () => {
    assert.equal(textoAdelanto([dataset(), dataset({ id: 2, titulo: 'Dataset B' })]), null);
    assert.equal(textoAdelanto([dataset({ adelantado: null })]), null);
    assert.equal(textoAdelanto([]), null);
  });

  it('todos adelantados por la misma nota: "Este pedido …", sea uno o varios', () => {
    const esperado = `Este pedido ya se había adelantado por ${CITA_10}.`;
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10)]), esperado);
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10), adelantado('Título B', NOTA_10), adelantado('Título C', NOTA_10)]), esperado);
  });

  it('mezcla con uno sin adelantado: nombra el título si es uno', () => {
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10), dataset({ titulo: 'Título B' })]),
      `El conjunto de datos "Título A" ya se había adelantado por ${CITA_10}.`);
  });

  it('mezcla con uno sin adelantado: nombra los títulos si son varios ("A" y "B"; "A", "B" y "C")', () => {
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10), dataset({ titulo: 'Título X' }), adelantado('Título B', NOTA_10)]),
      `Los conjuntos de datos "Título A" y "Título B" ya se habían adelantado por ${CITA_10}.`);
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10), adelantado('Título B', NOTA_10), dataset({ titulo: 'Título X' }), adelantado('Título C', NOTA_10)]),
      `Los conjuntos de datos "Título A", "Título B" y "Título C" ya se habían adelantado por ${CITA_10}.`);
  });

  it('dos notas distintas: una oración por nota, en el orden de su primera aparición, separadas por un espacio', () => {
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10), adelantado('Título B', NOTA_11)]),
      `El conjunto de datos "Título A" ya se había adelantado por ${CITA_10}. El conjunto de datos "Título B" ya se había adelantado por ${CITA_11}.`);
    // El orden es el de los datasets, no el del número de la nota; los de una misma nota se agrupan aunque no sean contiguos
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_11), adelantado('Título B', NOTA_10), adelantado('Título C', NOTA_11), dataset({ titulo: 'Título X' })]),
      `Los conjuntos de datos "Título A" y "Título C" ya se habían adelantado por ${CITA_11}. El conjunto de datos "Título B" ya se había adelantado por ${CITA_10}.`);
  });

  it('la nota es la misma si coinciden número y año: el mismo número de otro año es otra nota', () => {
    assert.equal(textoAdelanto([adelantado('Título A', NOTA_10), adelantado('Título B', { ...NOTA_10, anio: 2027, fecha: '2027-01-05' })]),
      `El conjunto de datos "Título A" ya se había adelantado por ${CITA_10}. El conjunto de datos "Título B" ya se había adelantado por Nota Digital N° 10/27 del 05/01/2027.`);
  });
});

describe('párrafo del adelanto en los avisos en su fecha (spec 7.6)', () => {
  const NOTA_10 = { numero: 10, anio: 2026, fecha: '2026-12-09' };
  const TEXTO = 'Este pedido ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.';
  // En el HTML las comillas del texto salen escapadas, como todo lo que se escribe ahí
  const conAdelanto = (cambios = {}) => nota({ gestion: 'externa', datasets: [dataset({ adelantado: NOTA_10 })], ...cambios });

  it('el aviso lo lleva en nota.adelanto, con la misma forma que las demás notas', () => {
    assert.equal(conAdelanto().adelanto, TEXTO);
    assert.equal(nota().adelanto, null);
  });

  it('va después del primer párrafo y antes de las secciones, en una línea propia en el texto', () => {
    const n = conAdelanto({ areas: [{ id: 10, nombre: 'Área Uno', email_principal: 'area@rpad.test' }] });
    const html = renderHtml(n);
    assert.ok(html.includes(`${n.parrafoInicial}</p>\n<p style="margin:0 0 12px;text-align:justify;">${TEXTO}</p>\n<p style="margin:16px 0 6px;"><b>Próximos a vencer</b></p>`), html);
    assert.ok(html.indexOf(TEXTO) < html.indexOf('<table'));
    const texto = renderTexto(n);
    assert.ok(texto.includes(`${n.parrafoInicial}\n\n${TEXTO}\n\nPróximos a vencer\n`), texto);
  });

  it('con comillas en el título: el HTML las escapa una sola vez y el texto plano las deja como están', () => {
    const n = conAdelanto({ datasets: [dataset({ titulo: 'Parques & <jardines>', adelantado: NOTA_10 }), dataset({ id: 2 })] });
    assert.equal(n.adelanto, 'El conjunto de datos "Parques & <jardines>" ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.');
    assert.ok(renderHtml(n).includes('El conjunto de datos &quot;Parques &amp; &lt;jardines&gt;&quot; ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.</p>'));
    assert.ok(renderTexto(n).includes('\nEl conjunto de datos "Parques & <jardines>" ya se había adelantado por Nota Digital N° 10/26 del 09/12/2026.\n'));
  });

  it('con el párrafo de autorización: primero ese y enseguida el del adelanto', () => {
    const n = conAdelanto({ autorizacion: AUTORIZADA });
    const html = renderHtml(n);
    assert.ok(html.includes(`${n.parrafoInicial}</p>\n<p style="margin:0 0 12px;text-align:justify;">${PARRAFO_AUTORIZACION}</p>\n<p style="margin:0 0 12px;text-align:justify;">${TEXTO}</p>\n<p style="margin:16px 0 6px;"><b>Próximos a vencer</b></p>`), html);
    assert.ok(renderTexto(n).includes(`${n.parrafoInicial}\n\n${PARRAFO_AUTORIZACION}\n\n${TEXTO}\n\nPróximos a vencer\n`));
  });

  it('sin datasets adelantados: adelanto null y el HTML y el texto quedan como siempre', () => {
    const n = nota({ gestion: 'externa' });
    assert.equal(n.adelanto, null);
    const html = renderHtml(n);
    assert.ok(html.includes(`${n.parrafoInicial}</p>\n<p style="margin:16px 0 6px;"><b>Próximos a vencer</b></p>`));
    assert.ok(!html.includes('adelantado'));
    assert.ok(renderTexto(n).includes(`${n.parrafoInicial}\n\nPróximos a vencer\n`));
    assert.ok(!renderTexto(n).includes('adelantado'));
  });

  it('la reiteración no lo lleva, aunque un dataset haya tenido adelantado', () => {
    const n = nota({ tipo: 'reiteracion', datasets: [dataset({ adelantado: NOTA_10 })] });
    assert.equal(n.adelanto, null);
    assert.ok(!renderHtml(n).includes('adelantado'));
    assert.ok(!renderTexto(n).includes('adelantado'));
  });

  it('las notas de autorización y de auditoría tampoco', () => {
    const firmaTitular = { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null };
    assert.equal(construirNotaDeAutorizacion({ numero: 15, anio: 2026, fecha: '2026-11-25', firma: firmaTitular, autorizacion: AUTORIZADA }).adelanto, null);
    assert.equal(construirNotaDeAuditoria({ numero: 15, anio: 2026, fecha: '2026-10-19', nuevos: [], reiterados: [], config }).adelanto, null);
  });
});

describe('reiteración: "Informado en" con más de un aviso (spec 7.6)', () => {
  const PRIMERO = { numero: 10, anio: 2026, fecha: '2026-12-09' };
  const SEGUNDO = { numero: 11, anio: 2026, fecha: '2026-12-22' };
  const TERCERO = { numero: 1, anio: 2027, fecha: '2027-01-04' };
  const ANTECEDENTE = { cantidad: 1, primera: '2026-10-01', ultima: '2026-10-01' };
  const reiteracion = (cambios) => nota({ tipo: 'reiteracion', gestion: 'externa', fecha: '2027-01-20', datasets: [dataset({ vencimiento: '2027-01-31', ...cambios })] });
  const celda = (n) => n.secciones[0].filas[0].valores.at(-1);

  it('dos avisos: "Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026)"', () => {
    const n = reiteracion({ informado: { ...PRIMERO, tambien: [SEGUNDO] } });
    assert.equal(celda(n), 'Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026)');
    assert.ok(renderHtml(n).includes('>Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026)</td>'));
    assert.ok(renderTexto(n).includes('    Informado en: Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026)\n'));
  });

  it('tres avisos: separados por comas y "y" antes del último', () => {
    const n = reiteracion({ informado: { ...PRIMERO, tambien: [SEGUNDO, TERCERO] } });
    assert.equal(celda(n), 'Nota Digital N° 10/26 (09/12/2026), N° 11/26 (22/12/2026) y N° 1/27 (04/01/2027)');
  });

  it('con "reiterado" y con la segunda oración del antecedente: igual que con un solo aviso', () => {
    const f = reiteracion({ informado: { ...PRIMERO, tambien: [SEGUNDO] }, reiteraciones: 2, antecedente: ANTECEDENTE }).secciones[0].filas[0];
    assert.equal(f.valores.at(-1), 'Nota Digital N° 10/26 (09/12/2026) y N° 11/26 (22/12/2026) – reiterado 2 veces.');
    assert.equal(f.informadoAnterior, 'Anteriormente notificado DGMIT por e-mail el 01/10/2026');
  });

  it('un aviso con tambien vacío o sin la clave: como siempre', () => {
    assert.equal(celda(reiteracion({ informado: { ...PRIMERO, tambien: [] } })), 'Nota Digital N° 10/26 (09/12/2026)');
    assert.equal(celda(reiteracion({ informado: PRIMERO })), 'Nota Digital N° 10/26 (09/12/2026)');
    assert.equal(celda(reiteracion({ informado: null })), 'Sin aviso previo');
  });

  it('la columna "Solicitado en" de la nota de auditoría no cambia', () => {
    const baja = {
      id: 9, tipo_cambio: 'eliminar', dataset_titulo: 'Dataset Viejo', usuario_nombre: 'Persona Titular', usuario_cargo: null,
      fecha_propuesta: '2026-10-01', datos_nuevos: { eliminado: true }, datos_anteriores: { titulo: 'Dataset Viejo' },
      solicitado: { numero: 12, anio: 2026, fecha: '2026-10-09', reiteraciones: 1 }
    };
    const n = construirNotaDeAuditoria({ numero: 15, anio: 2026, fecha: '2026-10-19', nuevos: [], reiterados: [baja], config });
    assert.equal(n.secciones[0].filas[0].valores.at(-1), 'Nota Digital N° 12/26 (09/10/2026) – reiterado 1 vez');
  });
});

describe('nota de autorización (spec 7.2)', () => {
  const firmaTitular = { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null };
  const autorizacion = construirNotaDeAutorizacion({ numero: 15, anio: 2026, fecha: '2026-11-25', firma: firmaTitular, autorizacion: AUTORIZADA });

  it('asunto, texto y firma del titular, sin gestión, tablas ni justificación', () => {
    assert.equal(autorizacion.asunto, 'Nota Digital N° 15/26 – Ref.: Autorización para la presentación de Notas Digitales (licencia del 26/11/2026 al 14/01/2027)');
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(autorizacion.gestion, null);
    assert.equal(autorizacion.parrafoInicial, 'Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Persona Autorizada, Cargo Autorizado, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.');
    assert.deepEqual(autorizacion.firma, { nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado: false, presentante: null, leyenda: null });
  });

  it('HTML y texto sin "Justificación:" y con el párrafo', () => {
    for (const salida of [renderHtml(autorizacion), renderTexto(autorizacion)]) {
      assert.ok(!salida.includes('Justificación'));
      assert.ok(salida.includes('autorizo expresamente a Persona Autorizada'));
      assert.ok(salida.includes('SE ADJUNTA NOTA EN PDF'));
    }
  });

  it('prueba: N° PRUEBA y [PRUEBA] en el asunto', () => {
    const prueba = construirNotaDeAutorizacion({ esPrueba: true, fecha: '2026-11-25', firma: firmaTitular, autorizacion: AUTORIZADA });
    assert.match(prueba.asunto, /^\[PRUEBA\] Nota Digital N° PRUEBA – /);
  });
});

describe('asunto de un aviso anticipado (spec 7.3)', () => {
  it('nombra el rango de meses de los vencimientos en lugar del mes de la nota', () => {
    assert.equal(nota({ rangoVencimientos: { desde: '2027-01-20', hasta: '2027-03-31' } }).asunto,
      `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – vencimientos de enero a marzo 2027)`);
    assert.equal(nota({ rangoVencimientos: { desde: '2026-12-15', hasta: '2027-02-10' } }).asunto,
      `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – vencimientos de diciembre 2026 a febrero 2027)`);
    assert.equal(nota({ rangoVencimientos: { desde: '2027-01-20', hasta: '2027-01-31' } }).asunto,
      `Nota Digital N° 12/26 – Ref.: ${REF} (gestión interna – vencimientos de enero 2027)`);
  });
});

describe('nota de auditoría (spec 2026-10-15-dias-habiles-licencias-auditoria, 10)', () => {
  const REF_AUDITORIA = 'Solicitud de auditoría de cambios en el Registro Permanente de Actualización de Datasets';
  const CATALOGOS = {
    areas: { 10: 'Área Uno', 11: 'Área Dos' }, frecuencias: { 6: 'Anualmente' }, temas: { 1: 'Economía y Finanzas' },
    formatos: { 1: 'CSV', 2: 'XLSX' }
  };
  // Una modificación como la guarda el RPAD: datos_anteriores con las fechas con hora (un Date de mysql2 pasado a JSON)
  const modificacion = (cambios = {}) => ({
    id: 7, tipo_cambio: 'editar', dataset_titulo: 'Presupuesto Municipal', usuario_nombre: 'Persona Editora',
    usuario_cargo: 'Cargo de Prueba', fecha_propuesta: '2026-10-16',
    datos_anteriores: {
      titulo: 'Presupuesto Municipal', area_id: 10, frecuencia_id: 6, formatos: [1, 2], descripcion: 'Igual',
      proxima_actualizacion: '2026-03-15T03:00:00.000Z'
    },
    datos_nuevos: {
      titulo: 'Presupuesto Municipal', area_id: 11, frecuencia_id: 6, formatos: [2, 1], descripcion: 'Igual',
      proxima_actualizacion: '2027-03-15'
    },
    ...cambios
  });
  const ALTA = {
    id: 8, tipo_cambio: 'crear', dataset_titulo: null, usuario_nombre: 'Persona Auditora', usuario_cargo: null,
    fecha_propuesta: '2026-10-07', datos_anteriores: null,
    datos_nuevos: {
      titulo: 'Dataset Nuevo', area_id: 10, tema_principal_id: 1, frecuencia_id: 6, tipo_gestion: 'externa', formatos: [1],
      descripcion: '', url_dataset: 'https://datos.comodoro.gov.ar/dataset/nuevo'
    }
  };
  const BAJA = {
    id: 9, tipo_cambio: 'eliminar', dataset_titulo: 'Dataset Viejo', usuario_nombre: 'Persona Titular', usuario_cargo: 'Director',
    fecha_propuesta: '2026-10-01', datos_nuevos: { eliminado: true },
    datos_anteriores: { titulo: 'Dataset Viejo', area_id: 11, frecuencia_id: 6, tipo_gestion: 'interna', descripcion: null },
    solicitado: { numero: 12, anio: 2026, fecha: '2026-10-09', reiteraciones: 0 }
  };
  const auditoria = (cambios = {}) => construirNotaDeAuditoria({
    numero: 15, anio: 2026, fecha: '2026-10-19', nuevos: [modificacion()], reiterados: [], catalogos: CATALOGOS, config, ...cambios
  });

  it('asunto y encabezado: con cambios nuevos, solo con reiterados y de prueba', () => {
    assert.equal(auditoria().asunto, `Nota Digital N° 15/26 – Ref.: ${REF_AUDITORIA}`);
    assert.equal(auditoria({ nuevos: [], reiterados: [BAJA] }).asunto, `Nota Digital N° 15/26 – Ref.: Reiteración – ${REF_AUDITORIA}`);
    assert.equal(auditoria({ numero: null, anio: null, esPrueba: true }).asunto, `[PRUEBA] Nota Digital N° PRUEBA – Ref.: ${REF_AUDITORIA}`);
    const nota = auditoria();
    assert.deepEqual([nota.tipo, nota.gestion, nota.ref, nota.anexo, nota.lineaCc], ['auditoria', null, REF_AUDITORIA, null, '']);
    assert.equal(nota.destinatario, 'DIRECCIÓN GENERAL DE MODERNIZACIÓN E INVESTIGACIÓN TERRITORIAL');
    assert.equal(nota.remitente, 'DIRECCIÓN DE DATOS PÚBLICOS Y COMUNICACIÓN');
    assert.equal(nota.fechaLarga, '19 de octubre de 2026');
    assert.deepEqual(nota.justificacion, []);
  });

  it('párrafo inicial, "Qué implica la auditoría" e "Importancia", con los textos de la spec', () => {
    const nota = auditoria();
    assert.equal(nota.parrafoInicial, 'Me dirijo a Ud. a fin de solicitarle la auditoría de los cambios propuestos en el Registro Permanente de Actualización de Datasets (RPAD) que se detallan a continuación, que se encuentran pendientes de verificación. Conforme al procedimiento de doble verificación, cada modificación del registro debe ser revisada y aprobada por una persona distinta de quien la propuso antes de aplicarse.');
    assert.deepEqual(nota.apartados, [
      {
        titulo: 'Qué implica la auditoría:',
        parrafos: ['La auditoría consiste en verificar que:'],
        items: [
          'los datos coincidan con la información remitida por el área responsable;',
          'el enlace al Portal de Datos Abiertos funcione y muestre la versión informada;',
          'las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos y que la próxima actualización sea el último día de un mes;',
          'el título, la descripción, el área, los temas, los formatos y "qué se solicita" sean correctos.'
        ],
        cierre: [`Cada cambio se aprueba o se rechaza, con un comentario, desde el RPAD: ${RPAD_URL}/perfil.html (sección "Para revisar").`]
      },
      {
        titulo: 'Importancia:',
        parrafos: ['Mientras un cambio no se audita, el conjunto de datos permanece bloqueado para nuevas modificaciones y el registro no refleja su estado real, lo que afecta los avisos y reiteraciones que emite esta Dirección y el cumplimiento de la Ordenanza N° 17.662/23. Por ello, solicito tenga a bien realizar la auditoría a la brevedad.'],
        items: [],
        cierre: []
      }
    ]);
  });

  it('tablas de nuevos y reiterados: tipo, quién propuso, fecha y días hábiles pendiente', () => {
    const nota = auditoria({ nuevos: [modificacion(), ALTA], reiterados: [BAJA] });
    assert.deepEqual(nota.secciones.map(s => [s.clave, s.titulo, s.introduccion]), [
      ['nuevo', 'Cambios pendientes de auditoría', ''],
      ['reiterado', 'Cambios ya solicitados que continúan pendientes', '']
    ]);
    assert.deepEqual(nota.secciones[0].columnas,
      ['Conjunto de datos', 'Tipo de cambio', 'Propuesto por', 'Fecha de la propuesta', 'Días hábiles pendiente']);
    // 16/10 → 19/10: 1 día hábil; 07/10 → 19/10: 8 (el 12/10 es trasladable y cuenta); 01/10 → 19/10: 12
    assert.deepEqual(nota.secciones[0].filas.map(f => f.valores), [
      ['Presupuesto Municipal', 'Modificación', 'Persona Editora, Cargo de Prueba', '16/10/2026', '1'],
      ['Dataset Nuevo', 'Alta', 'Persona Auditora', '07/10/2026', '8']
    ]);
    assert.equal(nota.secciones[1].columnas.at(-1), 'Solicitado en');
    assert.deepEqual(nota.secciones[1].filas[0].valores,
      ['Dataset Viejo', 'Baja', 'Persona Titular, Director', '01/10/2026', '12', 'Nota Digital N° 12/26 (09/10/2026)']);
    assert.deepEqual(auditoria({ nuevos: [], reiterados: [BAJA] }).secciones.map(s => s.clave), ['reiterado']);
  });

  // Personal contratado (pedido del usuario el 16/10/2026): "Propuesto por" dice "personal contratado, cumpliendo funciones de"
  // antes del cargo. La introducción del detalle no nombra el cargo: queda igual.
  it('"Propuesto por" de una persona contratada; sin contrato, sin cargo y en el detalle, como siempre', () => {
    const contratada = auditoria({ nuevos: [modificacion({ usuario_contratado: true }), { ...ALTA, usuario_contratado: true }], reiterados: [{ ...BAJA, usuario_contratado: false }] });
    assert.deepEqual(contratada.secciones.map(s => s.filas.map(f => f.valores[2])), [
      ['Persona Editora, personal contratado, cumpliendo funciones de Cargo de Prueba', 'Persona Auditora'],
      ['Persona Titular, Director']
    ]);
    assert.equal(auditoria().secciones[0].filas[0].valores[2], 'Persona Editora, Cargo de Prueba');
    assert.equal(contratada.detalles.secciones[0].introduccion, 'Propuesta por Persona Editora el 16/10/2026. Campos que cambian, con el valor anterior y el nuevo:');
    assert.ok(renderHtml(contratada).includes('>Persona Editora, personal contratado, cumpliendo funciones de Cargo de Prueba</td>'));
    assert.ok(renderTexto(contratada).includes('    Propuesto por: Persona Editora, personal contratado, cumpliendo funciones de Cargo de Prueba\n'));
  });

  it('"Solicitado en" cuenta las reiteraciones: 1 vez, 2 veces', () => {
    const solicitado = (reiteraciones) => auditoria({ nuevos: [], reiterados: [{ ...BAJA, solicitado: { ...BAJA.solicitado, reiteraciones } }] })
      .secciones[0].filas[0].valores[5];
    assert.equal(solicitado(1), 'Nota Digital N° 12/26 (09/10/2026) – reiterado 1 vez');
    assert.equal(solicitado(2), 'Nota Digital N° 12/26 (09/10/2026) – reiterado 2 veces');
  });

  it('detalle de una modificación: solo los campos que cambian, con las etiquetas del formulario y los nombres de los catálogos', () => {
    const { detalles } = auditoria();
    assert.equal(detalles.titulo, 'Detalle de cada cambio');
    const [detalle] = detalles.secciones;
    assert.equal(detalle.titulo, '1. Presupuesto Municipal – Modificación');
    assert.equal(detalle.introduccion, 'Propuesta por Persona Editora el 16/10/2026. Campos que cambian, con el valor anterior y el nuevo:');
    assert.deepEqual(detalle.columnas, ['Campo', 'Valor anterior', 'Valor nuevo']);
    // Los formatos [1, 2] y [2, 1] son los mismos; la descripción no cambió; la fecha con hora es el 15/03/2026
    assert.deepEqual(detalle.filas.map(f => f.valores), [
      ['Área Responsable', 'Área Uno', 'Área Dos'],
      ['Próxima actualización', '15/03/2026', '15/03/2027']
    ]);
  });

  // Spec 2026-10-17-fechas-datasets, 9: un registro de actualización (POST /datasets/:id/actualizar, Task 4) es una edición
  // con la marca registro_actualizacion. Se llama "Actualización" y su detalle son siempre sus cuatro fechas.
  describe('registro de actualización', () => {
    // Como lo guarda el RPAD: datos_anteriores con las fechas del dataset ('AAAA-MM-DD' o null; las de un cambio viejo
    // pueden traer hora) y datos_nuevos con lo registrado
    const registro = (cambios = {}) => ({
      id: 10, tipo_cambio: 'editar', dataset_titulo: 'Pauta Publicitaria', usuario_nombre: 'Persona Editora',
      usuario_cargo: 'Cargo de Prueba', fecha_propuesta: '2026-10-16',
      datos_anteriores: { ultima_actualizacion: '2026-07-10', datos_al: '2026-06-30', proxima_actualizacion: '2026-10-31' },
      datos_nuevos: {
        ultima_actualizacion: '2026-10-14', datos_al: '2026-09-30', proxima_actualizacion: '2027-01-31', recibido_el: '2026-10-13',
        notas: 'Recibido por email', registro_actualizacion: true
      },
      ...cambios
    });
    const conRegistro = (cambio = registro()) => auditoria({ nuevos: [cambio] });
    const FILAS = [
      ['Datos al', '30/06/2026', '30/09/2026'],
      ['Cargado en el portal', '10/07/2026', '14/10/2026'],
      ['Recibido el', '—', '13/10/2026'],
      ['Próxima actualización', '31/10/2026', '31/01/2027']
    ];

    it('se llama "Actualización" en la tabla y en el título del detalle', () => {
      const n = conRegistro();
      assert.deepEqual(n.secciones[0].filas[0].valores, ['Pauta Publicitaria', 'Actualización', 'Persona Editora, Cargo de Prueba', '16/10/2026', '1']);
      assert.equal(n.detalles.secciones[0].titulo, '1. Pauta Publicitaria – Actualización');
    });

    it('el detalle: Datos al, Cargado en el portal, Recibido el y Próxima actualización, en ese orden, con el anterior y el nuevo', () => {
      const [detalle] = conRegistro().detalles.secciones;
      assert.equal(detalle.introduccion, 'Propuesta por Persona Editora el 16/10/2026. Fechas de la actualización registrada, con el valor anterior y el nuevo:');
      assert.deepEqual(detalle.columnas, ['Campo', 'Valor anterior', 'Valor nuevo']);
      assert.deepEqual(detalle.filas.map(f => f.valores), FILAS);
    });

    it('las cuatro filas van siempre, aunque una fecha no cambie; lo vacío es "—" y las fechas con hora dan su día', () => {
      const cambio = registro({
        datos_anteriores: { ultima_actualizacion: '2026-07-10T03:00:00.000Z', datos_al: null, proxima_actualizacion: '2026-10-31T03:00:00.000Z' },
        datos_nuevos: { ultima_actualizacion: '2026-10-14', datos_al: '2026-09-30', proxima_actualizacion: '2026-10-31', recibido_el: null, notas: null, registro_actualizacion: true }
      });
      assert.deepEqual(conRegistro(cambio).detalles.secciones[0].filas.map(f => f.valores), [
        ['Datos al', '—', '30/09/2026'],
        ['Cargado en el portal', '10/07/2026', '14/10/2026'],
        ['Recibido el', '—', '—'],
        ['Próxima actualización', '31/10/2026', '31/10/2026']
      ]);
      // Sin datos anteriores (un cambio a medio cargar) no falla
      assert.deepEqual(conRegistro(registro({ datos_anteriores: null })).detalles.secciones[0].filas.map(f => f.valores[1]), ['—', '—', '—', '—']);
    });

    it('una edición sin la marca (también la forma vieja, {ultima, proxima, notas}) sigue siendo una "Modificación"', () => {
      for (const marca of [undefined, false, 'true']) {
        const vieja = registro({
          datos_nuevos: { ultima_actualizacion: '2026-10-14', proxima_actualizacion: '2027-01-31', notas: 'Forma vieja', registro_actualizacion: marca }
        });
        const n = conRegistro(vieja);
        assert.equal(n.secciones[0].filas[0].valores[1], 'Modificación', String(marca));
        assert.equal(n.detalles.secciones[0].titulo, '1. Pauta Publicitaria – Modificación');
        assert.deepEqual(n.detalles.secciones[0].filas.map(f => f.valores), [
          ['Cargado en el portal', '10/07/2026', '14/10/2026'],
          ['Próxima actualización', '31/10/2026', '31/01/2027']
        ]);
      }
    });

    it('HTML y texto del detalle', () => {
      const n = conRegistro();
      const html = renderHtml(n);
      assert.ok(html.includes('<b>1. Pauta Publicitaria – Actualización</b>'));
      assert.ok(html.includes('>Recibido el</td><td style="border:1px solid #000000;padding:5px 6px;vertical-align:top;text-align:left;">—</td>'), html);
      const texto = renderTexto(n);
      assert.ok(texto.includes(['- Datos al', '    Valor anterior: 30/06/2026', '    Valor nuevo: 30/09/2026'].join('\n')), texto);
      assert.ok(texto.includes('    Tipo de cambio: Actualización\n'));
    });
  });

  // Los campos nuevos del dataset también se ven en una modificación común (spec 2026-10-17-fechas-datasets, 6)
  it('una modificación que toca Datos al, la fecha de carga o el tipo de pedido los muestra, con las fechas por el día', () => {
    const cambio = modificacion({
      datos_anteriores: {
        titulo: 'Presupuesto Municipal', datos_al: '2025-12-31T03:00:00.000Z', ultima_actualizacion: '2026-01-10T03:00:00.000Z',
        tipo_pedido: null, proxima_actualizacion: '2026-03-31T03:00:00.000Z'
      },
      datos_nuevos: {
        titulo: 'Presupuesto Municipal', datos_al: '2025-12-31', ultima_actualizacion: '2026-01-12', tipo_pedido: 'ejercicio',
        proxima_actualizacion: '2026-03-31'
      }
    });
    // Datos al y la próxima no cambian (el mismo día con y sin hora)
    assert.deepEqual(auditoria({ nuevos: [cambio] }).detalles.secciones[0].filas.map(f => f.valores), [
      ['Tipo de pedido', 'Sin dato', 'Ejercicio que empieza'],
      ['Cargado en el portal', '10/01/2026', '12/01/2026']
    ]);
    const conDatosAl = modificacion({
      datos_anteriores: { datos_al: '2025-11-30', recibido_el: null }, datos_nuevos: { datos_al: '2025-12-31', recibido_el: '2026-01-05' }
    });
    assert.deepEqual(auditoria({ nuevos: [conDatosAl] }).detalles.secciones[0].filas.map(f => f.valores), [
      ['Datos al', '30/11/2025', '31/12/2025'],
      ['Recibido el', 'Sin dato', '05/01/2026']
    ]);
  });

  it('detalle de un alta (los datos cargados) y de una baja (el dataset que se daría de baja)', () => {
    const [, alta, baja] = auditoria({ nuevos: [modificacion(), ALTA], reiterados: [BAJA] }).detalles.secciones;
    assert.equal(alta.titulo, '2. Dataset Nuevo – Alta');
    assert.equal(alta.introduccion, 'Propuesta por Persona Auditora el 07/10/2026. Datos principales del conjunto de datos propuesto:');
    assert.deepEqual(alta.columnas, ['Campo', 'Valor']);
    assert.deepEqual(alta.filas.map(f => f.valores), [
      ['Título', 'Dataset Nuevo'], ['Área Responsable', 'Área Uno'], ['Tema Principal', 'Economía y Finanzas'],
      ['Frecuencia', 'Anualmente'], ['Tipo de Gestión', 'Externa'], ['Formatos del Dataset', 'CSV'],
      ['URL en Portal', 'https://datos.comodoro.gov.ar/dataset/nuevo']
    ]);
    assert.equal(baja.titulo, '3. Dataset Viejo – Baja');
    assert.equal(baja.introduccion, 'Propuesta por Persona Titular el 01/10/2026. Conjunto de datos que se daría de baja:');
    assert.deepEqual(baja.filas.map(f => f.valores), [
      ['Título', 'Dataset Viejo'], ['Área Responsable', 'Área Dos'], ['Frecuencia', 'Anualmente'], ['Tipo de Gestión', 'Interna']
    ]);
  });

  it('HTML y texto: escapan los datos, listan los ítems con viñeta y llevan el detalle', () => {
    const nota = auditoria({ nuevos: [modificacion({ dataset_titulo: '<b>Presupuesto</b>' })] });
    const html = renderHtml(nota);
    assert.ok(html.includes('&lt;b&gt;Presupuesto&lt;/b&gt;'));
    assert.ok(!html.includes('<b>Presupuesto</b>'));
    assert.ok(html.includes('<li style="margin:0 0 4px;text-align:justify;">los datos coincidan con la información remitida por el área responsable;</li>'));
    assert.ok(html.includes('<b>Detalle de cada cambio</b>'));
    assert.ok(html.includes('<b>Qué implica la auditoría:</b>'));
    assert.ok(html.includes('Nombre de Firma<br>Cargo de Firma'));
    assert.ok(!html.includes('Justificación'));
    const texto = renderTexto(nota);
    assert.ok(texto.includes('- los datos coincidan con la información remitida por el área responsable;'));
    assert.ok(texto.includes('Detalle de cada cambio'));
    assert.ok(texto.includes('    Valor anterior: Área Uno'));
    assert.ok(texto.includes('Importancia:'));
  });

  it('presentada por la persona autorizada: las dos firmas y la leyenda (spec 7.2)', () => {
    const firma = {
      titular: { nombre: 'Firma Titular', cargo: 'Director' }, presentante: { nombre: 'Firma Autorizada', cargo: 'Coordinadora' },
      leyenda: 'Nota presentada por Firma Autorizada, Coordinadora, en nombre de Firma Titular, Director, conforme a la autorización conferida mediante Nota Digital N° 3/26 (licencia del 19/10/2026 al 30/10/2026).'
    };
    const html = renderHtml(auditoria({ firma }));
    assert.ok(html.includes(firma.leyenda));
    assert.ok(html.includes('Firma Autorizada<br>Coordinadora'));
    assert.ok(html.includes('Firma Titular<br>Director'));
  });

  it('las notas de siempre no cambian: sin detalle ni apartados', () => {
    const aviso = nota();
    assert.equal(aviso.detalles, undefined);
    assert.equal(aviso.apartados, undefined);
    assert.ok(!renderHtml(aviso).includes('Detalle de cada cambio'));
  });
});

// Personal contratado (usuarios.vinculo = 'contrato', pedido del usuario el 16/10/2026): en la firma, un renglón más chico
// "Personal contratado, cumpliendo funciones de" entre el nombre y el cargo; dentro de los párrafos, en minúscula y en letra
// normal. Quien no es contratado sale como siempre.
describe('personal contratado (pedido del usuario el 16/10/2026)', () => {
  const RENGLON = 'Personal contratado, cumpliendo funciones de';
  const titular = (contratado = false) => ({ nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado });
  const autorizada = (contratado = false) => ({ nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', contratado });
  const LEYENDA_CONTRATADA = 'Nota presentada por Persona Autorizada, personal contratado, cumpliendo funciones de Cargo Autorizado, en nombre de Persona Titular, Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).';
  const dosFirmas = (presentante, deTitular = titular()) => ({ titular: deTitular, presentante, leyenda: LEYENDA_CONTRATADA });

  it('cargoEnTexto: "personal contratado, cumpliendo funciones de {cargo}" solo para quien es contratado', () => {
    assert.equal(cargoEnTexto({ cargo: 'Cargo Autorizado', contratado: true }), 'personal contratado, cumpliendo funciones de Cargo Autorizado');
    assert.equal(cargoEnTexto({ cargo: 'Cargo Autorizado', contratado: false }), 'Cargo Autorizado');
    assert.equal(cargoEnTexto({ cargo: 'Cargo Autorizado' }), 'Cargo Autorizado');
  });

  it('leyenda: la persona autorizada contratada y, si también lo es, el titular', () => {
    const leyenda = (presentante, deTitular) => textoLeyendaAutorizacion({ presentante, titular: deTitular, nota: { numero: 15, anio: 2026 }, licencia: AUTORIZADA });
    assert.equal(leyenda(autorizada(true), titular()), LEYENDA_CONTRATADA);
    assert.equal(leyenda(autorizada(false), titular()), LEYENDA);
    assert.equal(leyenda(autorizada(true), titular(true)),
      'Nota presentada por Persona Autorizada, personal contratado, cumpliendo funciones de Cargo Autorizado, en nombre de Persona Titular, personal contratado, cumpliendo funciones de Cargo Titular, conforme a la autorización conferida mediante Nota Digital N° 15/26 (licencia del 26/11/2026 al 14/01/2027).');
  });

  it('párrafo de autorización de los avisos de la víspera', () => {
    assert.equal(nota({ autorizacion: { ...AUTORIZADA, contratado: true } }).autorizacion,
      'Asimismo, por medio de la presente autorizo expresamente a Persona Autorizada, personal contratado, cumpliendo funciones de Cargo Autorizado, a presentar en mi nombre las Notas Digitales durante mi licencia, del 26/11/2026 al 14/01/2027, con el objetivo de mantener el correcto flujo de trabajo.');
    assert.equal(nota({ autorizacion: { ...AUTORIZADA, contratado: false } }).autorizacion, PARRAFO_AUTORIZACION);
  });

  it('texto de la nota de autorización', () => {
    const autorizacion = (contratado) => construirNotaDeAutorizacion({
      numero: 15, anio: 2026, fecha: '2026-11-25', firma: { titular: titular(), presentante: null, leyenda: null }, autorizacion: { ...AUTORIZADA, contratado }
    }).parrafoInicial;
    assert.equal(autorizacion(true), 'Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Persona Autorizada, personal contratado, cumpliendo funciones de Cargo Autorizado, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.');
    assert.equal(autorizacion(false), 'Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Persona Autorizada, Cargo Autorizado, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.');
  });

  it('cada firma de la nota dice si es de una persona contratada; la de Correos, nunca', () => {
    assert.deepEqual(nota({ firma: dosFirmas(autorizada(true), titular(true)) }).firma, {
      nombre: 'Persona Titular', cargo: 'Cargo Titular', contratado: true,
      presentante: { nombre: 'Persona Autorizada', cargo: 'Cargo Autorizado', contratado: true }, leyenda: LEYENDA_CONTRATADA
    });
    assert.equal(nota().firma.contratado, false);
    const deAutorizacion = construirNotaDeAutorizacion({
      numero: 15, anio: 2026, fecha: '2026-11-25', firma: { titular: titular(true), presentante: null, leyenda: null }, autorizacion: AUTORIZADA
    });
    assert.equal(deAutorizacion.firma.contratado, true);
  });

  it('HTML: el renglón va entre el nombre y el cargo, en 12px (el cargo, en los 15px de la nota), en una firma y en las dos', () => {
    const una = renderHtml(nota({ firma: { titular: titular(true), presentante: null, leyenda: null } }));
    assert.ok(una.includes(`<p style="margin:32px 0 0;text-align:right;">Persona Titular<br><span style="font-size:12px">${RENGLON}</span><br>Cargo Titular</p>`), una);
    assert.ok(una.includes('font-family:Arial,Helvetica,sans-serif;font-size:15px;'));
    const dos = renderHtml(nota({ firma: dosFirmas({ ...autorizada(true), nombre: 'Persona <b>Autorizada</b>' }) }));
    assert.ok(dos.includes(`>Persona &lt;b&gt;Autorizada&lt;/b&gt;<br><span style="font-size:12px">${RENGLON}</span><br>Cargo Autorizado</td>`), dos);
    assert.ok(dos.includes('>Persona Titular<br>Cargo Titular</td>'), 'el titular de planta, como siempre');
    assert.equal(dos.split(RENGLON).length - 1, 1, 'solo la firma de la persona contratada lleva el renglón');
    assert.ok(dos.includes(LEYENDA_CONTRATADA));
  });

  it('texto plano: un renglón más, entre el nombre y el cargo', () => {
    const una = renderTexto(nota({ firma: { titular: titular(true), presentante: null, leyenda: null } }));
    assert.ok(una.includes(`2 de noviembre de 2026.\n\nPersona Titular\n${RENGLON}\nCargo Titular\n\nCC. Dir. de Investigación Territorial`), una);
    const dos = renderTexto(nota({ firma: dosFirmas(autorizada(true)) }));
    assert.ok(dos.includes(`Persona Autorizada\n${RENGLON}\nCargo Autorizado\n\nPersona Titular\nCargo Titular\n\n${LEYENDA_CONTRATADA}\n\nCC. Dir. de Investigación Territorial`), dos);
  });
});
