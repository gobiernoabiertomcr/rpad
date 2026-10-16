// Contenido de las Notas Digitales (funciones puras)
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construirNota, construirNotaDeAutorizacion, construirNotaDeAuditoria, textoLeyendaAutorizacion, renderHtml, renderTexto } from '../services/notasDigitalesContenido.js';
import { RPAD_URL } from '../services/emailTemplates.js';

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
    assert.equal(situacion('2026-11-03'), 'Falta 1 día');
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
    assert.ok(html.includes('colspan="6"'));
    assert.ok(!html.includes('Anteriormente notificado'));
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
    assert.ok(texto.includes('    Situación: Faltan 59 días'));
    assert.ok(texto.includes('    Email: uno@ejemplo.gov.ar'));
    assert.ok(texto.trimEnd().endsWith('CC. Dir. Administrativa'));
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
    assert.deepEqual(nota().firma, { nombre: 'Nombre de Firma', cargo: 'Cargo de Firma', presentante: null, leyenda: null });
  });

  it('con la firma del titular sola, la nota firma con sus datos', () => {
    const n = nota({ firma: { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null } });
    assert.deepEqual(n.firma, { nombre: 'Persona Titular', cargo: 'Cargo Titular', presentante: null, leyenda: null });
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

describe('nota de autorización (spec 7.2)', () => {
  const firmaTitular = { titular: { nombre: 'Persona Titular', cargo: 'Cargo Titular' }, presentante: null, leyenda: null };
  const autorizacion = construirNotaDeAutorizacion({ numero: 15, anio: 2026, fecha: '2026-11-25', firma: firmaTitular, autorizacion: AUTORIZADA });

  it('asunto, texto y firma del titular, sin gestión, tablas ni justificación', () => {
    assert.equal(autorizacion.asunto, 'Nota Digital N° 15/26 – Ref.: Autorización para la presentación de Notas Digitales (licencia del 26/11/2026 al 14/01/2027)');
    assert.equal(autorizacion.tipo, 'autorizacion');
    assert.equal(autorizacion.gestion, null);
    assert.equal(autorizacion.parrafoInicial, 'Por medio de la presente informo que, durante mi licencia del 26/11/2026 al 14/01/2027, autorizo expresamente a Persona Autorizada, Cargo Autorizado, a presentar en mi nombre las Notas Digitales de esta Dirección, con el objetivo de mantener el correcto flujo de trabajo.');
    assert.deepEqual(autorizacion.firma, { nombre: 'Persona Titular', cargo: 'Cargo Titular', presentante: null, leyenda: null });
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
          'las fechas de última y próxima actualización sean coherentes con la frecuencia del conjunto de datos;',
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
      ['Próxima Actualización', '15/03/2026', '15/03/2027']
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
