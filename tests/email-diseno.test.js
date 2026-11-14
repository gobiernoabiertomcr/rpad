// Diseño de los emails del sistema ("celeste institucional"): un solo marco para todas las plantillas de
// services/emailTemplates.js (las Notas Digitales tienen su propio armado y no cambian), sin degradés, sombras ni emojis,
// con los textos fijos con tildes, y un solo remitente para todos los envíos. Asuntos y contenido quedan como estaban.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import * as plantillas from '../services/emailTemplates.js';
import { remitente } from '../services/emailService.js';
import { casosDeEmail, textoVisible, AVISO_DE_RESTITUCION, modeloDelDatoQuincena } from './emails-fixtures.js';

const casos = casosDeEmail(plantillas);
const fuente = (archivo) => readFileSync(new URL(`../services/${archivo}`, import.meta.url), 'utf8');

// Rangos Unicode de emojis y pictogramas (incluye el selector de variación y el unión de ancho cero)
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
// Colores del diseño anterior: no queda ninguno
const COLORES_VIEJOS = ['#0066cc', '#1a1a2e', '#28a745', '#ffc107', '#dc3545', '#fd7e14', '#6c757d', '#f8f9fa', '#e9ecef'];
// Botón "a prueba de balas": el color y el padding van en la celda, con el link adentro (Outlook de escritorio)
const BOTON = /<td [^>]*bgcolor="#3E6B96" style="background-color: #3E6B96; border-radius: 6px; padding: 10px 20px;[^"]*">\s*<a [^>]*style="[^"]*color: #FFFFFF;/;
const AREAS = 'aviso a las áreas';

describe('Diseño de los emails: un marco común', () => {
  for (const { nombre, email: { html } } of casos) {
    it(`${nombre}: HTML de email (tablas, estilos en línea, ancho máximo 600px) sin degradés, sombras, rgba ni emojis`, () => {
      assert.ok(html.startsWith('<!DOCTYPE html>'), 'empieza con <!DOCTYPE html>');
      assert.equal(html.split('<!DOCTYPE html>').length, 2, 'un solo documento');
      assert.ok(html.includes('<html lang="es">'));
      assert.ok(html.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">'));
      assert.ok(html.includes('<table role="presentation"'));
      assert.ok(html.includes("font-family: 'Segoe UI', Arial, sans-serif"));
      assert.ok(html.includes('max-width: 600px'));
      assert.ok(html.includes('background-color: #F7F9FB'), 'fondo de la página');
      assert.ok(html.includes('border: 1px solid #E4E9EF; border-radius: 8px'), 'tarjeta');
      for (const prohibido of ['linear-gradient', 'box-shadow', 'rgba(', '<style']) assert.ok(!html.includes(prohibido), prohibido);
      assert.doesNotMatch(html, EMOJI);
      for (const color of COLORES_VIEJOS) assert.ok(!html.toLowerCase().includes(color), `color viejo ${color}`);
    });

    it(`${nombre}: encabezado celeste pálido y pie gris claro`, () => {
      assert.ok(html.includes('background-color: #E3EEF8; border-bottom: 1px solid #CFE0F0'), 'encabezado');
      assert.match(html, /<h1 style="[^"]*color: #1F3A5F; font-size: 18px; font-weight: 600;/);
      assert.match(html, /<p style="[^"]*color: #5A7391; font-size: 13px;/);
      assert.ok(html.includes('background-color: #F7F9FB; border-top: 1px solid #E4E9EF'), 'pie');
      assert.match(html, /color: #8A97A6; font-size: 12px;/);
      const texto = textoVisible(html);
      if (nombre === AREAS) {
        assert.ok(texto.startsWith('Municipalidad de Comodoro Rivadavia Dirección General de Modernización e Investigación Territorial '));
        assert.ok(texto.endsWith('Este es un mensaje automático del sistema RPAD. Portal de Datos Abiertos: datos.comodoro.gov.ar'));
      } else {
        assert.ok(texto.startsWith('RPAD Registro Permanente de Actualización de Datasets '));
        assert.ok(texto.endsWith(' Dirección de Datos Públicos y Comunicación Municipalidad de Comodoro Rivadavia'));
      }
    });

    it(`${nombre}: textos fijos con tildes y sin "v1.5.0", "Sistema de Aprobaciones" ni "Sistema de Notificaciones"`, () => {
      for (const viejo of ['v1.5.0', 'Sistema de Aprobaciones', 'Sistema de Notificaciones', 'Direccion', 'Publicos', 'Comunicacion', 'Accion', 'revision<']) {
        assert.ok(!html.includes(viejo), viejo);
      }
      assert.ok(html.includes('Dirección de Datos Públicos y Comunicación'));
    });
  }

  it('los emails con botón lo pintan azul suave (#3E6B96) y los demás no tienen botón', () => {
    for (const { nombre, email: { html }, boton } of casos) {
      if (boton) {
        assert.equal(html.split('background-color: #3E6B96').length - 1, 1, nombre);
        assert.match(html, BOTON, nombre);
      } else {
        assert.ok(!html.includes('background-color: #3E6B96'), nombre);
      }
      // Ningún link lleva fondo: el del botón es solo el texto blanco
      assert.ok(!/<a [^>]*background-color/.test(html), nombre);
    }
  });

  it('los links son #3E6B96 y el del botón, blanco', () => {
    const color = (valor) => new RegExp(`(^|[;" ])color: ${valor}`);
    for (const { nombre, email: { html }, boton } of casos) {
      const links = [...html.matchAll(/<a [^>]*>/g)].map(([link]) => link);
      const blancos = links.filter(link => color('#FFFFFF').test(link));
      assert.equal(blancos.length, boton ? 1 : 0, nombre);
      for (const link of links.filter(l => !blancos.includes(l))) assert.match(link, color('#3E6B96'), `${nombre}: ${link}`);
    }
  });

  it('Outlook de escritorio: la tarjeta va dentro de una tabla de 600 solo para Outlook y sigue adaptándose en el celular', () => {
    for (const { nombre, email: { html } } of casos) {
      const abre = html.indexOf('<!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0"><tr><td><![endif]-->');
      const tarjeta = html.indexOf('style="width: 100%; max-width: 600px;');
      const cierra = html.indexOf('<!--[if mso]></td></tr></table><![endif]-->');
      assert.ok(abre > 0 && abre < tarjeta && tarjeta < cierra, nombre);
    }
  });

  it('Outlook de escritorio: las tarjetas se separan con filas de alto fijo, sin margin entre tablas', () => {
    const separador = '<td height="10" style="height: 10px; font-size: 0; line-height: 0;">&nbsp;</td>';
    const cuenta = (nombre) => casos.find(c => c.nombre === nombre).email.html.split(separador).length - 1;
    assert.equal(cuenta('cambios pendientes'), 2);
    assert.equal(cuenta('sin auditor (varios)'), 1);
    assert.equal(cuenta('sin auditor (uno)'), 0);
    assert.equal(cuenta(AREAS), 1);
    // La única tabla con margin es la tarjeta del marco, centrada (margin: 0 auto)
    for (const { nombre, email: { html } } of casos) {
      for (const [tabla] of html.matchAll(/<table [^>]*>/g)) assert.ok(!/margin: (?!0 auto;)/.test(tabla), `${nombre}: ${tabla}`);
    }
  });

  it('cambios pendientes: "Cambios pendientes de revisión" y "Acción requerida:" en un recuadro celeste muy claro', () => {
    for (const { email: { html } } of casos.filter(c => c.nombre.startsWith('cambios pendientes'))) {
      assert.ok(html.includes('Cambios pendientes de revisión'));
      assert.ok(html.includes('Acción requerida:'));
      assert.ok(html.includes('background-color: #F4F8FC; border: 1px solid #E1EAF3; border-radius: 6px'), 'recuadro informativo');
      assert.match(html, /<h2 style="[^"]*color: #1F3A5F;/);
    }
  });

  it('cambios pendientes de respaldo: el aviso "Te llega como respaldo" va en un recuadro ámbar pálido', () => {
    const { email: { html } } = casos.find(c => c.nombre === 'cambios pendientes de respaldo');
    assert.match(html, /background-color: #FBF1DC; border: 1px solid #F0DDB0;[^>]*>(\s*<(tr|td)[^>]*>)*\s*<p [^>]*color: #7A5A14;[^>]*><strong>Te llega como respaldo: no hay auditores disponibles\.<\/strong>/);
    const { email: { html: sinRespaldo } } = casos.find(c => c.nombre === 'cambios pendientes');
    assert.ok(!sinRespaldo.includes('#FBF1DC'));
  });

  it('las etiquetas del tipo de cambio son pastel, con radio 10px y en capitalización normal', () => {
    const { email: { html } } = casos.find(c => c.nombre === 'cambios pendientes');
    const etiqueta = (fondo, color, texto) => new RegExp(`<span style="[^"]*background-color: ${fondo}; color: ${color};[^"]*border-radius: 10px;[^"]*">${texto}</span>`);
    assert.match(html, etiqueta('#DCEAF7', '#24507A', 'Editar'));
    assert.match(html, etiqueta('#DDF1E6', '#2E6B4C', 'Crear'));
    assert.match(html, etiqueta('#F8E1E1', '#8A3434', 'Eliminar'));
    assert.match(casos.find(c => c.nombre === 'sin auditor (varios)').email.html, etiqueta('#DDF1E6', '#2E6B4C', 'Crear'));
    for (const { email } of casos) assert.ok(!/CREAR|EDITAR|ELIMINAR/.test(email.html));
    // Un tipo desconocido conserva su texto, en capitalización normal
    const raro = plantillas.cambiosPendientesTemplate([{ tipo_cambio: 'restaurar', dataset_titulo: 'X', usuario_username: 'u', tiempo_pendiente: 'Hace 1 hora' }]);
    assert.match(raro.html, />Restaurar<\/span>/);
  });

  // Como la nota de auditoría, el Libro y Mi Perfil (spec 2026-10-17-fechas-datasets, 9): un registro de actualización es una
  // edición con la marca registro_actualizacion en datos_nuevos
  it('un registro de actualización lleva la etiqueta "Actualización" (en el recordatorio y en el aviso sin auditor); las demás ediciones, "Editar"', () => {
    const etiqueta = (texto) => new RegExp(`<span style="[^"]*background-color: #DCEAF7; color: #24507A;[^"]*border-radius: 10px;[^"]*">${texto}</span>`);
    const registro = { tipo_cambio: 'editar', dataset_titulo: 'Pauta', datos_nuevos: { datos_al: '2026-09-30', registro_actualizacion: true } };
    const edicion = { tipo_cambio: 'editar', dataset_titulo: 'Arbolado', datos_nuevos: { titulo: 'Arbolado urbano' } };
    const recordatorio = plantillas.cambiosPendientesTemplate([
      { ...registro, usuario_nombre: 'Persona', tiempo_pendiente: 'Hace 2 horas' },
      { ...edicion, usuario_nombre: 'Persona', tiempo_pendiente: 'Hace 3 horas' }
    ]).html;
    assert.match(recordatorio, etiqueta('Actualización'));
    assert.match(recordatorio, etiqueta('Editar'));
    assert.match(textoVisible(recordatorio), /Actualización Pauta Propuesto por: Persona Hace 2 horas Editar Arbolado Propuesto por/);
    const sinAuditor = plantillas.sinAuditorTemplate([{ ...registro, fecha_propuesta: '2026-10-01' }]).html;
    assert.match(sinAuditor, etiqueta('Actualización'));
    assert.doesNotMatch(sinAuditor, />Editar</);
    // Solo una edición puede ser un registro, la marca tiene que ser true y un cambio sin datos_nuevos sigue como antes
    const otros = plantillas.cambiosPendientesTemplate([
      { tipo_cambio: 'crear', datos_nuevos: { titulo: 'Alta', registro_actualizacion: true }, tiempo_pendiente: 'Hace 1 hora' },
      { tipo_cambio: 'editar', dataset_titulo: 'X', datos_nuevos: { registro_actualizacion: 'true' }, tiempo_pendiente: 'Hace 1 hora' },
      { tipo_cambio: 'editar', dataset_titulo: 'Y', tiempo_pendiente: 'Hace 1 hora' }
    ]).html;
    assert.doesNotMatch(otros, />Actualización<\/span>/);
    assert.equal(otros.split('>Editar</span>').length - 1, 2);
    assert.match(otros, />Crear<\/span>/);
  });

  it('un cambio sin nombre ni usuario de quien lo propuso muestra "Propuesto por:" vacío, como antes', () => {
    const { html } = plantillas.cambiosPendientesTemplate([{ tipo_cambio: 'editar', dataset_titulo: 'X', usuario_nombre: null, usuario_username: null }]);
    assert.ok(textoVisible(html).includes('Propuesto por: Revisar cambios en RPAD'));
    assert.ok(!/null|undefined/.test(html));
  });

  it('el botón del recordatorio de cambios lleva a Para revisar', () => {
    const { html } = plantillas.cambiosPendientesTemplate([{ tipo_cambio: 'editar', dataset_titulo: 'X', usuario_nombre: 'Y' }]);
    assert.ok(html.includes('/perfil.html#para-revisar"'));
  });

  it('cada cambio y cada dataset van en una tarjeta blanca con borde fino', () => {
    const tarjeta = 'background-color: #FFFFFF; border: 1px solid #E4E9EF; border-radius: 6px';
    const cuenta = (html) => html.split(tarjeta).length - 1;
    assert.equal(cuenta(casos.find(c => c.nombre === 'cambios pendientes').email.html), 3);
    assert.equal(cuenta(casos.find(c => c.nombre === 'sin auditor (varios)').email.html), 2);
    assert.equal(cuenta(casos.find(c => c.nombre === AREAS).email.html), 2);
  });

  it('aviso a las áreas: la URL del dataset va escapada en el href (una comilla no rompe el atributo)', () => {
    const { html } = plantillas.areaAviso40dias({
      area_nombre: 'Área', datasets: [{ titulo: 'D', frecuencia_nombre: 'Anualmente', url_dataset: 'https://datos.rpad.test/d?a=1&b="x" onclick="alert(1)' }]
    });
    assert.ok(html.includes('href="https://datos.rpad.test/d?a=1&amp;b=&quot;x&quot; onclick=&quot;alert(1)"'));
    assert.ok(!html.includes('onclick="'));
  });

  it('aviso a las áreas: la firma lleva un borde izquierdo celeste, sin fondo', () => {
    const { email: { html } } = casos.find(c => c.nombre === AREAS);
    assert.match(html, /<td style="border-left: 3px solid #A9C7E4; padding-left: 12px;">\s*<p [^>]*>Dirección de Datos Públicos y Comunicación<\/p>/);
  });

  // Datos solicitados (spec 2026-10-17-fechas-datasets, 9) y, desde el 18/10/2026, sin la fecha sugerida de envío y con la
  // frecuencia "(Acumulado)" (spec 18): los renglones de cada tarjeta son la frecuencia y los datos que se solicitarán
  describe('aviso a las áreas: frecuencia y datos solicitados, sin fecha sugerida de envío', () => {
    const DATOS = 'Datos que se solicitarán:';
    const FECHA = 'Fecha sugerida de envío:';
    const aviso = (dataset) => textoVisible(plantillas.areaAviso40dias({
      area_nombre: 'Área', datasets: [{ titulo: 'D', frecuencia_nombre: 'Anualmente', url_dataset: null, ...dataset }]
    }).html);
    const pedido = (texto) => ({ desde: null, hasta: null, texto });

    it('los renglones son la frecuencia y los datos que se solicitarán, con el texto del pedido en minúscula inicial; ninguno es una fecha sugerida de envío', () => {
      const texto = aviso({ vencimiento: '2026-11-30', pedido: pedido('Del 01/11/2025 al 31/10/2026') });
      assert.ok(texto.includes('1. D Frecuencia de actualización: Anualmente Datos que se solicitarán: del 01/11/2025 al 31/10/2026 Gracias'), texto);
      assert.ok(!texto.includes('Fecha sugerida') && !texto.includes('30/11/2026'), texto);
    });

    it('cada renglón es un párrafo de texto secundario de 13px, pegado al anterior, y no hay un tercero con la fecha', () => {
      const { html } = plantillas.areaAviso40dias({
        area_nombre: 'Área',
        datasets: [{ titulo: 'D', frecuencia_nombre: 'Anualmente', url_dataset: null, vencimiento: '2026-11-30', pedido: pedido('Vigente al 31/10/2026') }]
      });
      const renglon = (margen, texto) => `<p style="margin: ${margen} 0 0 0; color: #6B7A8C; font-size: 13px;">${texto}</p>`;
      assert.ok(html.includes(renglon('4px', 'Frecuencia de actualización: Anualmente')));
      assert.ok(html.includes(renglon('2px', 'Datos que se solicitarán: vigente al 31/10/2026')));
      assert.ok(!html.includes('Fecha sugerida'), 'sobra la fecha sugerida de envío');
      assert.ok(!html.includes('30/11/2026'), 'sobra la fecha del vencimiento');
    });

    it('la primera letra pasa a minúscula en cada texto de pedido, con tilde o sin ella', () => {
      for (const [original, esperado] of [
        ['Del 01/01/2026 al 31/12/2026', 'del 01/01/2026 al 31/12/2026'],
        ['Vigente al 31/10/2026', 'vigente al 31/10/2026'],
        ['Presupuesto del ejercicio 2027', 'presupuesto del ejercicio 2027'],
        ['Presupuestos de los ejercicios 2025 y 2026', 'presupuestos de los ejercicios 2025 y 2026'],
        ['Próxima edición disponible', 'próxima edición disponible'],
        ['Relevamiento actualizado', 'relevamiento actualizado']
      ]) {
        assert.ok(aviso({ vencimiento: '2026-11-30', pedido: pedido(original) }).includes(`${DATOS} ${esperado} Gracias`), original);
      }
    });

    it('un dataset sin pedido no lleva "Datos que se solicitarán": queda solo la frecuencia, con o sin vencimiento', () => {
      for (const sinPedido of [{ pedido: null }, {}, { pedido: pedido('') }]) {
        for (const vencimiento of ['2026-11-30', null, undefined]) {
          const texto = aviso({ vencimiento, ...sinPedido });
          assert.ok(!texto.includes(DATOS) && !texto.includes(FECHA), texto);
          assert.ok(texto.includes('1. D Frecuencia de actualización: Anualmente Gracias'), texto);
        }
      }
    });

    it('el vencimiento del dataset no se muestra: con o sin él, el email es el mismo', () => {
      const conPedido = { pedido: pedido('Del 01/01/2026 al 31/10/2026') };
      assert.equal(aviso({ ...conPedido, vencimiento: '2026-11-30' }), aviso({ ...conPedido, vencimiento: null }));
      assert.equal(aviso({ ...conPedido, vencimiento: '2026-11-30' }), aviso(conPedido));
    });

    it('la frecuencia de un acumulado menor al año lleva "(Acumulado)"; los anuales y los demás tipos, no', () => {
      assert.ok(aviso({ frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'acumulado', meses: 3 })
        .includes('Frecuencia de actualización: Trimestralmente (Acumulado) Gracias'));
      assert.ok(aviso({ frecuencia_nombre: 'Cada medio año', tipo_pedido: 'acumulado', meses: 6, pedido: pedido('Del 01/01/2026 al 30/06/2026') })
        .includes('Frecuencia de actualización: Cada medio año (Acumulado) Datos que se solicitarán: del 01/01/2026 al 30/06/2026 Gracias'));
      for (const sinMarca of [
        { frecuencia_nombre: 'Anualmente', tipo_pedido: 'acumulado', meses: 12 },
        { frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'foto', meses: 3 },
        { frecuencia_nombre: 'Trimestralmente', tipo_pedido: null, meses: 3 },
        { frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'acumulado', meses: null },
        { frecuencia_nombre: 'Trimestralmente', tipo_pedido: 'acumulado', meses: '3' },
        { frecuencia_nombre: 'Cada dos años', tipo_pedido: 'acumulado', meses: 24 },
        { frecuencia_nombre: 'Trimestralmente' }
      ]) {
        assert.ok(!aviso(sinMarca).includes('Acumulado'), JSON.stringify(sinMarca));
      }
    });

    it('sin nombre de frecuencia sigue "Sin definir", también con un acumulado', () => {
      for (const frecuencia_nombre of [null, undefined, '']) {
        const texto = aviso({ frecuencia_nombre, tipo_pedido: 'acumulado', meses: 3 });
        assert.ok(texto.includes('1. D Frecuencia de actualización: Sin definir Gracias'), texto);
        assert.ok(!texto.includes('Acumulado'), texto);
      }
    });

    it('sin pedido ni vencimiento queda como antes', () => {
      const texto = aviso({});
      assert.ok(!texto.includes(DATOS) && !texto.includes(FECHA));
      assert.ok(texto.includes('1. D Frecuencia de actualización: Anualmente Gracias'), texto);
    });

    it('el texto del pedido va escapado', () => {
      const { html } = plantillas.areaAviso40dias({
        area_nombre: 'Área', datasets: [{ titulo: 'D', frecuencia_nombre: 'Anualmente', url_dataset: null, vencimiento: '2026-11-30', pedido: pedido('<img src=x onerror=alert(1)> & más') }]
      });
      assert.ok(!html.includes('<img'));
      assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; más'));
    });

    it('el aviso conserva las dos tarjetas y el único separador entre ellas', () => {
      const { html } = casos.find(c => c.nombre === AREAS).email;
      assert.equal(html.split('background-color: #FFFFFF; border: 1px solid #E4E9EF; border-radius: 6px').length - 1, 2);
      assert.equal(html.split('<td height="10"').length - 1, 1);
    });
  });

  it('las plantillas no repiten el marco: un solo <!DOCTYPE html> en emailTemplates.js y ningún degradé', () => {
    const codigo = fuente('emailTemplates.js');
    assert.equal(codigo.split('<!DOCTYPE html>').length, 2);
    assert.ok(!codigo.includes('linear-gradient'));
    assert.ok(!codigo.includes('const COLORS'));
  });
});

describe('Diseño de los emails: asuntos y contenido sin cambios', () => {
  // Asuntos de las mismas plantillas con los mismos datos antes del rediseño (a58f567)
  const ASUNTOS = {
    'cambios pendientes': '[RPAD] 3 cambios esperan tu auditoría',
    'cambios pendientes de respaldo': '[RPAD] 1 cambio espera tu auditoría',
    'sin auditor (uno)': '[RPAD] Tu cambio en Arbolado urbano queda sin auditor disponible por ahora',
    'sin auditor (varios)': '[RPAD] 2 cambios tuyos quedan sin auditor disponible hasta el 11/01/2027',
    'aviso a las áreas': 'Aviso: Solicitud próxima de actualización de datos - Dirección de Prueba',
    'contacto': '[RPAD Contacto] Consulta general - Persona Consultante',
    'invitación': 'Tu acceso al RPAD',
    'recuperación': 'Restablecé tu contraseña del RPAD',
    'aviso al superadmin': 'RPAD: cambio en los usuarios',
    'resumen de avisos retenidos': 'RPAD: cambios en los usuarios durante tu licencia',
    'vencimiento de Mi espacio': 'RPAD: lo que vence pronto en Mi espacio',
    // Nuevo con los días restituidos de Mi espacio (spec 2026-10-31-mi-espacio-dias-restituidos, 10): solo, su propio asunto
    'días para restituir': 'RPAD: tenés días para restituir en Mi espacio',
    'aviso diario de la agenda': 'RPAD: tu agenda hasta el lunes 09/11',
    // Nuevos con la firma digital de las notas (spec 2026-11-03-notas-firma-digital, 4.4)
    'notas para firmar (una)': 'RPAD: hoy tenés 1 nota para firmar',
    'notas para firmar (varias)': 'RPAD: hoy tenés 2 notas para firmar',
    // Nuevos con la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 4)
    'evento: invitación': 'RPAD: te sumaron a un evento',
    'evento: cambio': 'RPAD: cambió un evento',
    'evento: cancelación': 'RPAD: se canceló un evento',
    'evento: recordatorio': 'RPAD: Reunión de equipo, hoy a las 10:00',
    // Nuevo con el correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 10): la fecha de la edición
    'dato de la quincena': 'Dato de la Quincena - 09/11/2026'
  };

  it('el asunto de cada plantilla es el de antes', () => {
    assert.deepEqual(Object.fromEntries(casos.map(c => [c.nombre, c.email.subject])), ASUNTOS);
  });

  // Texto visible de antes (a58f567) sin emojis, con el encabezado y el pie nuevos, las tildes corregidas y las etiquetas
  // en capitalización normal. En contacto, "Nueva Consulta" y "Formulario de Contacto RPAD" pasan del encabezado al cuerpo
  // y la fecha y la IP, del pie al final del cuerpo.
  const RPAD = 'RPAD Registro Permanente de Actualización de Datasets';
  const PIE = 'Dirección de Datos Públicos y Comunicación Municipalidad de Comodoro Rivadavia';
  const TEXTOS = {
    'cambios pendientes': `${RPAD} Cambios pendientes de revisión Hay 3 cambios esperando tu auditoría Acción requerida: Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otras personas. Cambios pendientes: Editar Padrón de comercios <b>2026</b> Propuesto por: Persona Editora Hace 2 días Crear Alta de prueba Propuesto por: Persona Admin Hace 3 horas Eliminar Dataset viejo Propuesto por: pusuario Hace 1 hora Revisar cambios en RPAD ${PIE}`,
    'cambios pendientes de respaldo': `${RPAD} Cambios pendientes de revisión Hay 1 cambio esperando tu auditoría Acción requerida: Por favor, revisa y aprueba o rechaza los siguientes cambios propuestos por otras personas. Te llega como respaldo: no hay auditores disponibles. Cambios pendientes: Editar Padrón de comercios <b>2026</b> Propuesto por: Persona Editora Hace 2 días Revisar cambios en RPAD ${PIE}`,
    'sin auditor (uno)': `${RPAD} Sin auditor disponible Por ahora no hay ningún auditor disponible para revisar este cambio. Cambios pendientes: Editar Arbolado urbano Fecha de la propuesta: 01/10/2026 Mientras tanto, el conjunto de datos sigue bloqueado para nuevas modificaciones. Apenas vuelva a haber un auditor disponible, le llega el recordatorio. ${PIE}`,
    'sin auditor (varios)': `${RPAD} Sin auditor disponible Hasta el 11/01/2027 no hay ningún auditor disponible para revisar estos cambios. Cambios pendientes: Editar Arbolado urbano Fecha de la propuesta: 01/10/2026 Crear Alta nueva Fecha de la propuesta: 02/10/2026 Mientras tanto, el conjunto de datos sigue bloqueado para nuevas modificaciones. Apenas vuelva a haber un auditor disponible, le llega el recordatorio. ${PIE}`,
    'aviso a las áreas': 'Municipalidad de Comodoro Rivadavia Dirección General de Modernización e Investigación Territorial Estimados/as: Nos comunicamos desde la Dirección General de Modernización e Investigación Territorial de la Municipalidad de Comodoro Rivadavia para informarles que próximamente recibirán una nota formal solicitando la actualización de los siguientes datasets publicados en el Portal de Datos Abiertos: 1. Dataset A Frecuencia de actualización: Anualmente Datos que se solicitarán: del 01/01/2026 al 30/11/2026 Ver dataset en el portal 2. Dataset B & C Frecuencia de actualización: Sin definir Gracias a su colaboración, mantener estos datos al día no solo permite dar cumplimiento a las obligaciones establecidas en la Ordenanza N.º 17.662/23 de Gobierno Abierto, sino que también facilita el acceso de la ciudadanía a información actualizada y agiliza los procesos administrativos tanto del Municipio como de otras organizaciones, reduciendo la necesidad de solicitar los datos por canales tradicionales. Quedamos a disposición para cualquier consulta. ¡Muchas gracias! Dirección de Datos Públicos y Comunicación Dirección General de Modernización e Investigación Territorial E-mail: datospublicos@comodoro.gov.ar Este es un mensaje automático del sistema RPAD. Portal de Datos Abiertos: datos.comodoro.gov.ar',
    'contacto': `${RPAD} Nueva Consulta Formulario de Contacto RPAD Tipo de consulta Consulta general Datos del remitente Nombre Persona Consultante Email consulta@rpad.test Mensaje Hola. Quería saber cuándo se actualiza el padrón. Responder a Persona Consultante Recibido el viernes, 16 de octubre de 2026, 10:30 IP: 127.0.0.1 ${PIE}`,
    'invitación': `${RPAD} Tu acceso al RPAD Hola, Persona Nueva. Te dieron acceso al Registro Permanente de Actualización de Datasets (RPAD) con el usuario pnueva y el rol Administrador. Para empezar, elegí tu contraseña con el botón de abajo. Elegir mi contraseña El link sirve una sola vez y vence el 19 de octubre de 2026 a las 10:30 h. Si vence, pedí uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de ingreso, o pedíselo a un administrador. ${PIE}`,
    'recuperación': `${RPAD} Restablecé tu contraseña Hola, Persona Nueva. Recibimos un pedido para restablecer la contraseña del usuario pnueva en el RPAD. Elegir una contraseña nueva El link sirve una sola vez y vence el 19 de octubre de 2026 a las 10:30 h. Si no lo pediste, ignorá este email: tu contraseña actual sigue funcionando. ${PIE}`,
    'aviso al superadmin': `${RPAD} Cambio en los usuarios del RPAD Persona Admin (padmin) hizo este cambio: Persona Lectora (plectora): Lector → Administrador Fecha: 16 de octubre de 2026 a las 10:30 h Ver el panel de usuarios Este aviso te llega porque sos superadmin y el cambio lo hizo otro administrador. ${PIE}`,
    'resumen de avisos retenidos': `${RPAD} Cambios en los usuarios durante tu licencia Mientras estabas de licencia hubo 2 cambios que te habrían llegado como aviso: 10 de noviembre de 2026 a las 10:00 h – Persona Admin (padmin): Persona Lectora (plectora): Desactivado 10 de noviembre de 2026 a las 12:30 h – Persona Admin (padmin): Persona Lectora (plectora): Lector → Administrador Ver el panel de usuarios Este resumen te llega porque sos superadmin y estos avisos no se enviaron durante tu licencia. ${PIE}`,
    // Nuevo con Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 9): sin el tipo de ninguna licencia médica
    'vencimiento de Mi espacio': `${RPAD} Lo que vence pronto Hola, Persona de Prueba. Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10. Tenés 3 días de la licencia 2024: vence el 31/12/2026. Ver en Mi espacio Este aviso te llega una sola vez por cada cosa. Lo que cargás en Mi espacio lo ves solo vos. ${PIE}`,
    // Nuevo con los días restituidos de Mi espacio (spec 2026-10-31-mi-espacio-dias-restituidos, 10): el email de la maqueta
    'aviso diario de la agenda': `${RPAD} Tu agenda hasta el lunes 09/11 Graciela, esto es lo que tenés hasta el próximo día hábil. Lunes 09/11 11:00 · Reunión de portal de datos Revisar la lista. Laboral, de Federico De quienes dependen de vos Lunes 09/11 08:00 · Micaela: Fuera de la oficina Hasta las 10:00 Ver en Mi espacio De quienes dependen de vos, te llega solo el texto corto de lo que publican. Lo tuyo lo podés apagar desde la Agenda de Mi espacio; lo demás te llega siempre. ${PIE}`,
    'días para restituir': `${RPAD} Días para restituir Hola, Julieta Ferreyra. Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés 2 días restituidos de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el viernes 30/04/2027, con la nota al Director General. Si no, se pierden. En Mi espacio podés cargarlos y bajar la nota en Word. Ver en Mi espacio Te va a llegar otro aviso 5 días hábiles antes del plazo. Lo que cargás en Mi espacio lo ves solo vos. ${PIE}`,
    // Nuevos con la firma digital de las notas (spec 2026-11-03-notas-firma-digital, 4.4): el nombre, escapado; el primero, solo
    'notas para firmar (una)': `${RPAD} Notas para firmar hoy Buen día, Julieta. Hoy tenés 1 nota para firmar. Te la adjuntamos para que no tengas que bajarla: Nota Digital N° 12/26: reiteración, gestión externa. Firmala en el Firmador de firmar.gob.ar y subila en su fila, en la pantalla que abre el botón de abajo. Si el archivo no es esa nota, el RPAD te avisa. Antes de enviarla vas a poder mirarla. Subir la nota firmada A las 14:00 sale lo que quede: firmada si la subiste y la confirmaste, con la leyenda al pie; si no, con la imagen de tu firma y sin la leyenda, como siempre. Si hoy no podés, no hace falta que hagas nada. ¡Gracias! ${PIE}`,
    'notas para firmar (varias)': `${RPAD} Notas para firmar hoy Buen día, Julieta. Hoy tenés 2 notas para firmar. Te las adjuntamos para que no tengas que bajarlas: Nota Digital N° 12/26: reiteración, gestión externa. Nota Digital N° 1/27: auditoría. Firmalas en el Firmador de firmar.gob.ar, de a una, y subí cada una en su fila, en la pantalla que abre el botón de abajo. Si un archivo no es esa nota, el RPAD te avisa. Antes de enviarlas vas a poder mirarlas. Subir las notas firmadas A las 14:00 sale lo que quede: firmada si la subiste y la confirmaste, con la leyenda al pie; si no, con la imagen de tu firma y sin la leyenda, como siempre. Si hoy no podés, no hace falta que hagas nada. ¡Gracias! ${PIE}`,
    // Nuevos con la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 4): el detalle va en su párrafo, después de la
    // línea del evento
    'evento: invitación': `${RPAD} Te sumaron a un evento Persona de Prueba te sumó a un evento: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00. Sala de reuniones del 2.º piso. Ver en Mi espacio Solo quien lo creó lo puede cambiar. Si cambia o se cancela, te llega otro email. ${PIE}`,
    'evento: cambio': `${RPAD} Cambió un evento Cambió un evento: Reunión de equipo, miércoles 28/10/2026 de 10:00 a 11:00. Antes: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00 Sala de reuniones del 2.º piso. Lo cambió Persona de Prueba. Ver en Mi espacio ${PIE}`,
    'evento: cancelación': `${RPAD} Se canceló un evento Se canceló: Reunión de equipo, martes 27/10/2026 a las 10:00. Sala de reuniones del 2.º piso. Lo canceló Persona de Prueba. Ver en Mi espacio ${PIE}`,
    'evento: recordatorio': `${RPAD} Recordatorio Hoy a las 10:00: Reunión de equipo Sala de reuniones del 2.º piso. Ver en Mi espacio Te llega porque el evento tiene un recordatorio por email. Lo podés apagar desde el evento, en la Agenda de Mi espacio. ${PIE}`,
    // Nuevo con el correo del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 10): el de la maqueta, con datos
    // inventados. La infografía es una imagen: su texto alternativo no es texto visible
    'dato de la quincena': `${RPAD} Dato de la Quincena - 09/11/2026 Edición N.º 1 2 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas. Buen día, Persona. La infografía de la propuesta principal. Va adjunta en PNG y en SVG (para editarla). Agenda de la quincena 12/11/2026 Jornada inventada Un evento inventado para las pruebas. Ver 20/11/2026 Efeméride inventada Efeméride Una fecha inventada. Con un segundo renglón. Ver Propuesta 1 de 2 Principal Validar Un título inventado 1.234 casos · octubre de 2026 Dataset: Dataset de prueba A En el RPAD ese día: Actualizado. Datos al 31/10/2026. Última actualización 05/11/2026. Próxima en 25 días. Para validar antes de publicar • Confirmar la cifra con el área. • Revisar la fuente. Por qué hoy Una razón inventada. Ángulo Un ángulo inventado. Idea de placa Una placa inventada. Texto para redes Un texto para redes inventado. Con un segundo renglón. Puntos centrales Primer punto. Segundo punto. Tercer punto. Borrador de nota Un borrador inventado Primer párrafo. Segundo párrafo. Fuentes https://datos.ejemplo.test/a.csv https://datos.ejemplo.test/b.csv Propuesta 2 de 2 Agenda Otro título inventado 56 casos · octubre de 2026 Dataset: Dataset de prueba B En el RPAD ese día: Vencido. Datos al —. Última actualización 03/06/2026. Venció hace 4 días. Por qué hoy Otra razón inventada. Ángulo Otro ángulo inventado. Idea de placa Otra placa inventada. Texto para redes Otro texto para redes inventado. Puntos centrales Un punto. Otro punto. Un tercer punto. Borrador de nota Otro borrador inventado Un párrafo. Otro párrafo. Un tercer párrafo. Fuentes https://datos.ejemplo.test/c.csv Ver la edición en el RPAD En el RPAD también están el texto del correo de Datito, los cálculos y la edición completa. Te llega porque estás en la lista del dato de la quincena; para dejar de recibirlo, avisale a la Dirección. ${PIE}`
  };

  for (const { nombre, email } of casos) {
    it(`${nombre}: el texto visible es el de antes`, () => {
      assert.equal(textoVisible(email.html), TEXTOS[nombre]);
    });
  }

  it('los textos alternativos (text) no tienen emojis', () => {
    for (const { nombre, email } of casos.filter(c => c.email.text)) assert.doesNotMatch(email.text, EMOJI, nombre);
  });
});

// Los dos avisos al superadmin abren Configuración (spec 2026-10-24-configuracion, 3): el botón y el texto llevan a
// configuracion.html (abre en la pestaña Usuarios), y el botón sigue diciendo "Ver el panel de usuarios". Sin depender del
// dominio (RPAD_URL sale de APP_URL)
describe('Los avisos al superadmin abren Configuración', () => {
  for (const nombre of ['aviso al superadmin', 'resumen de avisos retenidos']) {
    it(`${nombre}: el botón y el texto llevan a configuracion.html, no a usuarios.html`, () => {
      const { email: { html, text } } = casos.find(c => c.nombre === nombre);
      assert.ok(html.includes('/configuracion.html"'));
      assert.match(html, /<a href="[^"]*\/configuracion\.html" [^>]*>Ver el panel de usuarios<\/a>/);
      assert.ok(text.includes('/configuracion.html'));
      assert.match(text, /^Panel de usuarios: \S+\/configuracion\.html$/m);
      for (const texto of [html, text]) assert.ok(!texto.includes('usuarios.html'), nombre);
    });
  }
});

// El aviso de vencimiento de Mi espacio (spec 2026-10-26-mi-espacio-licencias-y-horas, 9): el botón abre el Resumen, el texto
// alternativo dice lo mismo y el nombre y los renglones van escapados
describe('El aviso de vencimiento de Mi espacio', () => {
  const NOMBRE = 'vencimiento de Mi espacio';

  it('el botón «Ver en Mi espacio» abre mi-espacio.html#resumen', () => {
    const { email: { html } } = casos.find(c => c.nombre === NOMBRE);
    assert.match(html, /<a href="[^"]*\/mi-espacio\.html#resumen" [^>]*>Ver en Mi espacio<\/a>/);
  });

  it('el texto alternativo: el saludo, un renglón por cosa, el link y la nota', () => {
    const { email: { text } } = casos.find(c => c.nombre === NOMBRE);
    assert.equal(text, [
      'Hola, Persona de Prueba.',
      '',
      'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.',
      'Tenés 3 días de la licencia 2024: vence el 31/12/2026.',
      '',
      `Ver en Mi espacio: ${plantillas.RPAD_URL}/mi-espacio.html#resumen`,
      '',
      'Este aviso te llega una sola vez por cada cosa. Lo que cargás en Mi espacio lo ves solo vos.'
    ].join('\n'));
  });

  it('el nombre y los renglones van escapados en el HTML y tal cual en el texto', () => {
    const raro = '<img src=x onerror=alert(1)> & más';
    const { html, text } = plantillas.vencimientoMiEspacioTemplate({ nombre_completo: raro, avisos: [{ clave: 'x', texto: raro }] });
    assert.ok(!html.includes('<img'));
    assert.equal(html.split('&lt;img src=x onerror=alert(1)&gt; &amp; más').length - 1, 2);
    assert.equal(text.split(raro).length - 1, 2);
  });
});

// Los días para restituir en el aviso de vencimiento de Mi espacio (spec 2026-10-31-mi-espacio-dias-restituidos, 10): cada aviso
// de restitución va con sus párrafos y sus negritas (escapados acá; las marcas las pone el código), solos llevan su asunto y su
// título, y la nota del pie dice que va a llegar otro aviso solo si va el primero sin el segundo de su grupo
describe('Los días para restituir en el aviso de Mi espacio', () => {
  const NOMBRE = 'días para restituir';
  // El segundo aviso del mismo grupo (desde 5 días hábiles antes del plazo) y un franco, otra cosa que vence
  const SEGUNDO = {
    ...AVISO_DE_RESTITUCION, clave: 'restitucion-1-2024-0-2', restitucion: { ...AVISO_DE_RESTITUCION.restitucion, primero: false }
  };
  const FRANCO = {
    clave: 'franco-2027-04', texto: 'Tenés 1 franco compensatorio para usar en abril: el último día hábil es el viernes 30/04.'
  };
  const OTRO_AVISO = 'Te va a llegar otro aviso 5 días hábiles antes del plazo.';
  const NOTA_DE_SIEMPRE = 'Este aviso te llega una sola vez por cada cosa. Lo que cargás en Mi espacio lo ves solo vos.';
  const NOTA_CON_OTRO_AVISO = `${OTRO_AVISO} Lo que cargás en Mi espacio lo ves solo vos.`;
  const PARRAFO = '<p style="margin: 12px 0 0 0; color: #2B3A4A; font-size: 14px; line-height: 1.6;">';
  const email = (avisos, nombre = 'Julieta Ferreyra') => plantillas.vencimientoMiEspacioTemplate({ nombre_completo: nombre, avisos });

  it('el email de la maqueta: el asunto, el título y cada párrafo en el suyo, con sus negritas en <strong>', () => {
    const { email: { subject, html } } = casos.find(c => c.nombre === NOMBRE);
    assert.equal(subject, 'RPAD: tenés días para restituir en Mi espacio');
    assert.ok(html.includes('<title>Días para restituir</title>'));
    assert.match(html, /<h2 [^>]*>Días para restituir<\/h2>/);
    assert.ok(html.includes(`${PARRAFO}Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: `
      + `tenés <strong>2 días restituidos de la licencia 2024</strong>.</p>${PARRAFO}Como esa licencia ya venció, tomalos todos `
      + 'juntos, empezando a más tardar el <strong>viernes 30/04/2027</strong>, con la nota al Director General. Si no, se '
      + `pierden.</p>${PARRAFO}En Mi espacio podés cargarlos y bajar la nota en Word.</p>`), html);
    assert.match(html, /<a href="[^"]*\/mi-espacio\.html#resumen" [^>]*>Ver en Mi espacio<\/a>/);
    assert.ok(html.includes(`>${NOTA_CON_OTRO_AVISO}</p>`), html);
    assert.equal(html.split('<strong>').length - 1, 2);
  });

  it('el texto alternativo: el saludo, el texto de cada aviso en un renglón, el link y la nota del pie', () => {
    const { email: { text } } = casos.find(c => c.nombre === NOMBRE);
    assert.equal(text, [
      'Hola, Julieta Ferreyra.',
      '',
      AVISO_DE_RESTITUCION.texto,
      '',
      `Ver en Mi espacio: ${plantillas.RPAD_URL}/mi-espacio.html#resumen`,
      '',
      NOTA_CON_OTRO_AVISO
    ].join('\n'));
    assert.ok(!text.includes('<'), text);
  });

  it('el segundo aviso, solo: su asunto y su título, sin «Te va a llegar otro aviso…» y con la nota de siempre', () => {
    const { subject, html, text } = email([SEGUNDO]);
    assert.equal(subject, 'RPAD: tenés días para restituir en Mi espacio');
    assert.match(html, /<h2 [^>]*>Días para restituir<\/h2>/);
    for (const parte of [html, text]) {
      assert.ok(!parte.includes(OTRO_AVISO), parte);
      assert.ok(parte.includes(NOTA_DE_SIEMPRE), parte);
    }
  });

  it('los dos avisos de un mismo grupo juntos: sin «Te va a llegar otro aviso…»; uno de otro grupo, sí', () => {
    for (const parte of Object.values(email([AVISO_DE_RESTITUCION, SEGUNDO]))) assert.ok(!parte.includes(OTRO_AVISO), parte);
    // El primero de otro grupo (otra licencia de origen), con el segundo de este: va a llegar el segundo de ese otro
    const deOtroGrupo = {
      ...AVISO_DE_RESTITUCION, clave: 'restitucion-1-2025-0-1', restitucion: { ...AVISO_DE_RESTITUCION.restitucion, grupo: '1-2025-0' }
    };
    const { html, text } = email([SEGUNDO, deOtroGrupo]);
    assert.ok(html.includes(`>${NOTA_CON_OTRO_AVISO}</p>`), html);
    assert.ok(text.endsWith(NOTA_CON_OTRO_AVISO), text);
  });

  it('con otra cosa que vence (un franco): el asunto y el título de siempre, el franco en su renglón y la restitución con sus '
    + 'párrafos', () => {
    const { subject, html, text } = email([FRANCO, SEGUNDO]);
    assert.equal(subject, 'RPAD: lo que vence pronto en Mi espacio');
    assert.match(html, /<h2 [^>]*>Lo que vence pronto<\/h2>/);
    assert.ok(textoVisible(html).includes(`Lo que vence pronto Hola, Julieta Ferreyra. ${FRANCO.texto} `
      + `${AVISO_DE_RESTITUCION.texto} Ver en Mi espacio ${NOTA_DE_SIEMPRE}`), textoVisible(html));
    assert.ok(html.includes(`${PARRAFO}${FRANCO.texto}</p>${PARRAFO}Los asuetos del 24`), html);
    assert.ok(html.includes('<strong>viernes 30/04/2027</strong>'));
    assert.equal(text, ['Hola, Julieta Ferreyra.', '', FRANCO.texto, AVISO_DE_RESTITUCION.texto, '',
      `Ver en Mi espacio: ${plantillas.RPAD_URL}/mi-espacio.html#resumen`, '', NOTA_DE_SIEMPRE].join('\n'));
    // Con el primero, la nota dice el otro aviso también acá
    assert.ok(email([FRANCO, AVISO_DE_RESTITUCION]).text.endsWith(NOTA_CON_OTRO_AVISO));
  });

  it('el nombre y lo que viene en las partes van escapados en el HTML y tal cual en el texto; las marcas las pone el código',
    () => {
    const raro = '<img src=x onerror=alert(1)> & "más"';
    const aviso = {
      clave: 'restitucion-9-2024-0-1',
      texto: `${raro} ${raro}`,
      restitucion: { grupo: '9-2024-0', partes: [[raro, { negrita: raro }], ['<b>x</b>']], primero: true }
    };
    const { html, text } = email([aviso], raro);
    assert.ok(!html.includes('<img'), html);
    assert.ok(!html.includes('<b>'), html);
    const escapado = '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;más&quot;';
    assert.ok(html.includes(`${PARRAFO}${escapado}<strong>${escapado}</strong></p>${PARRAFO}&lt;b&gt;x&lt;/b&gt;</p>`), html);
    assert.equal(html.split(escapado).length - 1, 3);
    assert.equal(text.split(raro).length - 1, 3);
  });

  // Dos grupos en el mismo email: dos licencias de origen de las mismas vacaciones (el 24/12, de la 2025, y el 31/12, de la 2026:
  // los dos caso B) o uno de cada caso (el 24/12 de la 2024, caso A, y el 31/12 de la 2026, caso B). Cada aviso con sus partes,
  // como las arma partesDelEmailDeRestitucion, y su texto
  describe('con dos grupos, los párrafos de cierre iguales van una sola vez, al final de los de restitución', () => {
    const DE_LAS_VACACIONES = 'cayó en tus vacaciones del 11/12/2026 al 08/01/2027: ';
    const PLAZO = { negrita: 'viernes 30/04/2027' };
    const CIERRE_B = 'En Mi espacio podés pedirla y bajar la nota en Word.';
    const CIERRE_A = 'En Mi espacio podés cargarlo y bajar la nota en Word.';
    const textoDe = (partes) => partes.map((p) => p.map((x) => (typeof x === 'string' ? x : x.negrita)).join('')).join(' ');
    const avisoDe = (grupo, partes) => ({
      clave: `restitucion-${grupo}-1`, texto: textoDe(partes), restitucion: { grupo, partes, primero: true }
    });
    const B = (anio, dia) => avisoDe(`1-${anio}-0`, [
      [`El asueto del ${dia}/12/2026 ${DE_LAS_VACACIONES}podés pedir que te restituyan `,
        { negrita: `1 día a tu licencia ${anio}` }, '.'],
      ['Pedilo con la nota al Director General a más tardar el ', PLAZO, '. Si no, se pierde.'],
      [CIERRE_B]
    ]);
    const A_2024 = avisoDe('1-2024-0', [
      [`El asueto del 24/12/2026 ${DE_LAS_VACACIONES}tenés `, { negrita: '1 día restituido de la licencia 2024' }, '.'],
      ['Como esa licencia ya venció, tomalo a más tardar el ', PLAZO, ', con la nota al Director General. Si no, se pierde.'],
      [CIERRE_A]
    ]);
    const B_2025 = B(2025, 24);
    const B_2026 = B(2026, 31);
    // Los dos primeros párrafos de un aviso, en texto plano: lo que va sin el cierre
    const sinElCierre = (aviso) => textoDe(aviso.restitucion.partes.slice(0, -1));
    const veces = (texto, parte) => texto.split(parte).length - 1;

    it('dos grupos B: «En Mi espacio podés pedirla…» una sola vez, después de los párrafos de los dos', () => {
      const { subject, html, text } = email([B_2025, B_2026]);
      assert.equal(subject, 'RPAD: tenés días para restituir en Mi espacio');
      assert.equal(veces(html, CIERRE_B), 1, html);
      assert.equal(textoVisible(html), 'RPAD Registro Permanente de Actualización de Datasets Días para restituir Hola, Julieta '
        + `Ferreyra. ${sinElCierre(B_2025)} ${sinElCierre(B_2026)} ${CIERRE_B} Ver en Mi espacio ${NOTA_CON_OTRO_AVISO} `
        + 'Dirección de Datos Públicos y Comunicación Municipalidad de Comodoro Rivadavia');
      assert.ok(html.includes(`${PARRAFO}Pedilo con la nota al Director General a más tardar el <strong>viernes 30/04/2027`
        + `</strong>. Si no, se pierde.</p>${PARRAFO}${CIERRE_B}</p>\n`), html);
      // En el texto plano, un renglón por aviso, y el cierre una sola vez, al final del último
      assert.equal(text, ['Hola, Julieta Ferreyra.', '', sinElCierre(B_2025), `${sinElCierre(B_2026)} ${CIERRE_B}`, '',
        `Ver en Mi espacio: ${plantillas.RPAD_URL}/mi-espacio.html#resumen`, '', NOTA_CON_OTRO_AVISO].join('\n'));
    });

    it('uno A y uno B: cada cierre una vez, en el orden de sus avisos, después de los párrafos de los dos', () => {
      const { html, text } = email([A_2024, B_2026]);
      assert.equal(veces(html, CIERRE_A), 1, html);
      assert.equal(veces(html, CIERRE_B), 1, html);
      assert.ok(textoVisible(html).includes(`Hola, Julieta Ferreyra. ${sinElCierre(A_2024)} ${sinElCierre(B_2026)} ${CIERRE_A} `
        + `${CIERRE_B} Ver en Mi espacio`), textoVisible(html));
      assert.ok(html.includes(`${PARRAFO}${CIERRE_A}</p>${PARRAFO}${CIERRE_B}</p>\n`), html);
      assert.equal(text.split('\n')[2], sinElCierre(A_2024));
      assert.equal(text.split('\n')[3], `${sinElCierre(B_2026)} ${CIERRE_A} ${CIERRE_B}`);
      for (const cierre of [CIERRE_A, CIERRE_B]) assert.equal(veces(text, cierre), 1, text);
    });

    it('con un franco antes: el franco en su párrafo y los cierres al final de los de restitución', () => {
      const { subject, html } = email([FRANCO, B_2025, B_2026]);
      assert.equal(subject, 'RPAD: lo que vence pronto en Mi espacio');
      assert.ok(textoVisible(html).includes(`Hola, Julieta Ferreyra. ${FRANCO.texto} ${sinElCierre(B_2025)} ${sinElCierre(B_2026)} `
        + `${CIERRE_B} Ver en Mi espacio`), textoVisible(html));
    });

    it('un solo grupo queda igual: sus tres párrafos y, en el texto plano, su texto', () => {
      const { html, text } = email([B_2025]);
      assert.ok(textoVisible(html).includes(`Hola, Julieta Ferreyra. ${B_2025.texto} Ver en Mi espacio`), textoVisible(html));
      assert.equal(text.split('\n')[2], B_2025.texto);
    });
  });

  it('un aviso de restitución sin partes que sirvan se dibuja con su texto, en un párrafo', () => {
    const sinPartes = { ...AVISO_DE_RESTITUCION, restitucion: { ...AVISO_DE_RESTITUCION.restitucion, partes: [] } };
    const { html } = email([sinPartes]);
    assert.ok(html.includes(`${PARRAFO}${AVISO_DE_RESTITUCION.texto}</p>`), html);
    assert.ok(!html.includes('<strong>'), html);
  });
});

// Los cuatro emails de los eventos de la agenda de Mi espacio (spec 2026-10-26-mi-espacio-agenda, 4): la invitación, el cambio
// y la cancelación salen al guardar un evento (services/miEspacioEventosEmails.js) y el recordatorio, de la corrida. Todos con
// el botón «Ver en Mi espacio» a la pestaña Agenda y el detalle en su párrafo; lo que escribió una persona (el título, el
// detalle y el nombre de quien lo creó) va escapado (Review Focus 2)
describe('Los emails de los eventos de la agenda', () => {
  const EVENTOS = ['evento: invitación', 'evento: cambio', 'evento: cancelación', 'evento: recordatorio'];
  const URL_DE_LA_PESTANA = `${plantillas.RPAD_URL}/mi-espacio.html#agenda`;
  const EVENTO = Object.freeze({
    titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: 'Sala de reuniones del 2.º piso.'
  });
  const caso = (nombre) => casos.find(c => c.nombre === nombre).email;
  // Los cuatro con un mismo evento (el cambio lo pasa al miércoles 28/10) y un mismo nombre de quien lo creó
  const losCuatro = (evento, creador = 'Persona de Prueba') => ({
    invitacion: plantillas.eventoInvitacionTemplate({ creador, evento }),
    cambio: plantillas.eventoCambioTemplate({ creador, antes: evento, despues: { ...evento, fecha: '2026-10-28' } }),
    cancelacion: plantillas.eventoCancelacionTemplate({ creador, evento }),
    recordatorio: plantillas.eventoRecordatorioTemplate({ evento, hoy: '2026-10-27' })
  });
  // Los párrafos del cuerpo (los de plantillaSimple, en el color del texto)
  const parrafos = (html) => html.split('color: #2B3A4A; font-size: 14px; line-height: 1.6;').length - 1;

  it('los cuatro: el botón «Ver en Mi espacio» abre mi-espacio.html#agenda, y el texto alternativo lleva el link', () => {
    for (const nombre of EVENTOS) {
      const { html, text } = caso(nombre);
      assert.match(html, /<a href="[^"]*\/mi-espacio\.html#agenda" [^>]*>Ver en Mi espacio<\/a>/, nombre);
      assert.ok(text.includes(`Ver en Mi espacio: ${URL_DE_LA_PESTANA}`), nombre);
    }
  });

  it('la invitación: quien lo creó y el título en negrita, cuándo es con la hora de fin y la nota', () => {
    const { html } = caso('evento: invitación');
    assert.ok(html.includes('><strong>Persona de Prueba</strong> te sumó a un evento: <strong>Reunión de equipo</strong>, martes 27/10/2026 de 10:00 a 11:00.</p>'));
    assert.match(html, /<p [^>]*>Sala de reuniones del 2\.º piso\.<\/p>/);
    assert.match(html, /<p [^>]*color: #6B7A8C; font-size: 12px;[^>]*>Solo quien lo creó lo puede cambiar\. Si cambia o se cancela, te llega otro email\.<\/p>/);
  });

  it('el cambio: el evento nuevo en negrita y lo de antes tachado, con <s> dentro de un párrafo', () => {
    const { html } = caso('evento: cambio');
    assert.ok(html.includes('>Cambió un evento: <strong>Reunión de equipo</strong>, miércoles 28/10/2026 de 10:00 a 11:00.</p>'));
    assert.match(html, /<p [^>]*>Antes: <s>Reunión de equipo, martes 27\/10\/2026 de 10:00 a 11:00<\/s><\/p>/);
    assert.match(html, /<p [^>]*>Lo cambió Persona de Prueba\.<\/p>/);
    assert.equal(html.split('<s>').length - 1, 1);
  });

  it('la cancelación: cuándo empieza, sin la hora de fin, y quién la canceló', () => {
    const { html } = caso('evento: cancelación');
    assert.ok(html.includes('>Se canceló: <strong>Reunión de equipo</strong>, martes 27/10/2026 a las 10:00.</p>'));
    assert.match(html, /<p [^>]*>Lo canceló Persona de Prueba\.<\/p>/);
  });

  it('el recordatorio dice hoy, mañana o el día, en el asunto (en minúscula) y en el párrafo, con la nota', () => {
    for (const [evento, hoy, asunto, comienzo] of [
      [EVENTO, '2026-10-27', 'RPAD: Reunión de equipo, hoy a las 10:00', 'Hoy a las 10:00'],
      [EVENTO, '2026-10-26', 'RPAD: Reunión de equipo, mañana a las 10:00', 'Mañana a las 10:00'],
      [{ ...EVENTO, fecha: '2026-11-02' }, '2026-10-27', 'RPAD: Reunión de equipo, el lunes 02/11 a las 10:00', 'El lunes 02/11 a las 10:00']
    ]) {
      const { subject, html, text } = plantillas.eventoRecordatorioTemplate({ evento, hoy });
      assert.equal(subject, asunto);
      assert.ok(html.includes(`>${comienzo}: <strong>Reunión de equipo</strong></p>`), comienzo);
      assert.ok(text.startsWith(`${comienzo}: Reunión de equipo\n`), comienzo);
    }
    assert.match(caso('evento: recordatorio').html,
      /<p [^>]*>Te llega porque el evento tiene un recordatorio por email\. Lo podés apagar desde el evento, en la Agenda de Mi espacio\.<\/p>/);
  });

  it('sin hora de fin, la invitación y lo de antes dicen «a las 10:00»', () => {
    const sinFin = { ...EVENTO, hasta: null };
    assert.ok(textoVisible(plantillas.eventoInvitacionTemplate({ creador: 'Persona de Prueba', evento: sinFin }).html)
      .includes('Persona de Prueba te sumó a un evento: Reunión de equipo, martes 27/10/2026 a las 10:00.'));
    assert.ok(textoVisible(plantillas.eventoCambioTemplate({ creador: 'Persona de Prueba', antes: sinFin, despues: EVENTO }).html)
      .includes('Antes: Reunión de equipo, martes 27/10/2026 a las 10:00 Sala de reuniones del 2.º piso. Lo cambió'));
  });

  it('los textos alternativos: los párrafos separados por un renglón en blanco, el link y la nota', () => {
    const link = `Ver en Mi espacio: ${URL_DE_LA_PESTANA}`;
    const detalle = 'Sala de reuniones del 2.º piso.';
    assert.equal(caso('evento: invitación').text, [
      'Persona de Prueba te sumó a un evento: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00.', detalle, link,
      'Solo quien lo creó lo puede cambiar. Si cambia o se cancela, te llega otro email.'
    ].join('\n\n'));
    assert.equal(caso('evento: cambio').text, [
      'Cambió un evento: Reunión de equipo, miércoles 28/10/2026 de 10:00 a 11:00.',
      'Antes: Reunión de equipo, martes 27/10/2026 de 10:00 a 11:00', detalle, 'Lo cambió Persona de Prueba.', link
    ].join('\n\n'));
    assert.equal(caso('evento: cancelación').text, [
      'Se canceló: Reunión de equipo, martes 27/10/2026 a las 10:00.', detalle, 'Lo canceló Persona de Prueba.', link
    ].join('\n\n'));
    assert.equal(caso('evento: recordatorio').text, [
      'Hoy a las 10:00: Reunión de equipo', detalle, link,
      'Te llega porque el evento tiene un recordatorio por email. Lo podés apagar desde el evento, en la Agenda de Mi espacio.'
    ].join('\n\n'));
  });

  it('el detalle: sus saltos de línea son <br> en el HTML y quedan en el texto; sin detalle, no hay párrafo', () => {
    const conRenglones = losCuatro({ ...EVENTO, detalle: 'Sala 2.\nTraer la notebook.\r\nCon café.' });
    for (const [nombre, { html, text }] of Object.entries(conRenglones)) {
      assert.ok(html.includes('>Sala 2.<br>Traer la notebook.<br>Con café.</p>'), nombre);
      assert.ok(text.includes('Sala 2.\nTraer la notebook.\r\nCon café.'), nombre);
    }
    const conDetalle = losCuatro(EVENTO);
    for (const detalle of [null, undefined, '', '   ']) {
      for (const [nombre, { html, text }] of Object.entries(losCuatro({ ...EVENTO, detalle }))) {
        assert.equal(parrafos(html), parrafos(conDetalle[nombre].html) - 1, `${nombre} ${detalle}`);
        assert.ok(!text.includes('\n\n\n'), `${nombre} ${detalle}`);
        assert.ok(!/null|undefined/.test(html + text), `${nombre} ${detalle}`);
      }
    }
  });

  // Review Focus 2: lo que escribió una persona nunca entra como HTML. En el HTML, escapado una sola vez (plantillaSimple no
  // escapa sus párrafos: lo hace cada plantilla); en el texto alternativo y en el asunto, tal cual
  it('Review Focus 2: un título, un detalle y un nombre con HTML van escapados en los cuatro, y tal cual en el texto', () => {
    const raro = '<img src=x onerror=alert(1)> & más';
    const escapado = '&lt;img src=x onerror=alert(1)&gt; &amp; más';
    const emails = losCuatro({ ...EVENTO, titulo: raro, detalle: raro }, raro);
    // Cuántas veces aparece cada uno: el título (dos en el cambio, con lo de antes), el detalle y el nombre (no en el recordatorio)
    const veces = { invitacion: 3, cambio: 4, cancelacion: 3, recordatorio: 2 };
    for (const [nombre, { subject, html, text }] of Object.entries(emails)) {
      assert.ok(!html.includes('<img'), nombre);
      assert.ok(!html.includes('&amp;lt;'), `${nombre}: escapado dos veces`);
      assert.equal(html.split(escapado).length - 1, veces[nombre], nombre);
      assert.equal(text.split(raro).length - 1, veces[nombre], nombre);
      assert.ok(!subject.includes('&lt;'), nombre);
    }
    assert.equal(emails.recordatorio.subject, `RPAD: ${raro}, hoy a las 10:00`);
    assert.ok(emails.cambio.html.includes(`>Antes: <s>${escapado}, martes 27/10/2026 de 10:00 a 11:00</s></p>`));
    assert.ok(emails.invitacion.html.includes(`><strong>${escapado}</strong> te sumó a un evento: <strong>${escapado}</strong>,`));
  });
});

// El mail del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 2.8 y 10), como la maqueta aprobada: el título, el
// número y la bajada; el saludo; la infografía en línea; la agenda; una tarjeta por propuesta con su franja; el botón y la nota.
// El texto plano y el nombre del bot, en tests/dato-quincena-correo-reglas.test.js
describe('El mail del dato de la quincena', () => {
  const { email: { html } } = casos.find(c => c.nombre === 'dato de la quincena');
  const mail = (cambiar = () => {}, opciones = { conSvg: true }) => {
    const modelo = modeloDelDatoQuincena();
    cambiar(modelo);
    return plantillas.datoQuincenaTemplate(modelo, opciones);
  };
  const veces = (texto, parte) => texto.split(parte).length - 1;
  const ESCAPADO = '&lt;b&gt;x&lt;/b&gt;';

  it('el asunto es el del modelo (con «[PRUEBA] » en una prueba) y el título del cuerpo va arriba, con el número y la bajada', () => {
    assert.equal(mail((m) => { m.asunto = '[PRUEBA] Dato de la Quincena - 09/11/2026'; }).subject, '[PRUEBA] Dato de la Quincena - 09/11/2026');
    assert.match(html, /<h2 style="[^"]*color: #1F3A5F; font-size: 18px;[^"]*">Dato de la Quincena - 09\/11\/2026<\/h2><p [^>]*>Edición N\.º 1<\/p><p [^>]*>2 propuestas de comunicación/);
    assert.ok(textoVisible(html).includes('Son internas: todavía no están aprobadas ni publicadas. Buen día, Persona. La infografía'));
  });

  it('sin número (un piloto sin marca) no va el renglón; sin primer nombre, «Buen día.»', () => {
    const otro = mail((m) => { m.numero = null; m.primerNombre = null; }).html;
    assert.ok(textoVisible(otro).includes('Dato de la Quincena - 09/11/2026 2 propuestas de comunicación'));
    assert.ok(textoVisible(otro).includes('publicadas. Buen día. La infografía'));
    assert.ok(textoVisible(mail((m) => { m.numero = 'Piloto 4'; }).html).includes('09/11/2026 Piloto 4 2 propuestas'));
  });

  it('la infografía va en línea con el cid de CID_INFOGRAFIA, a 552 de ancho, con el título de la principal en el texto alternativo', () => {
    assert.equal(plantillas.CID_INFOGRAFIA, 'infografia-dato-quincena');
    assert.equal(veces(html, '<img '), 1);
    assert.ok(html.includes('<img src="cid:infografia-dato-quincena" width="552" alt="Infografía de la propuesta principal: Un título inventado" style="display: block; width: 100%; max-width: 552px; height: auto;'));
    // La principal no es siempre la primera
    const segunda = mail((m) => { m.propuestas[0].principal = false; m.propuestas[1].principal = true; }).html;
    assert.ok(segunda.includes('alt="Infografía de la propuesta principal: Otro título inventado"'));
  });

  it('el pie de la infografía dice que va el SVG solo con conSvg en true', () => {
    assert.ok(html.includes('>La infografía de la propuesta principal. Va adjunta en PNG y en SVG (para editarla).</p>'));
    for (const opciones of [{}, { conSvg: false }, { conSvg: 'true' }, undefined]) {
      const sinSvg = plantillas.datoQuincenaTemplate(modeloDelDatoQuincena(), opciones);
      assert.ok(sinSvg.html.includes('>La infografía de la propuesta principal. Va adjunta en PNG.</p>'), JSON.stringify(opciones));
      assert.ok(!sinSvg.html.includes('SVG') && !sinSvg.text.includes('SVG'), JSON.stringify(opciones));
    }
  });

  it('la agenda va en un recuadro, con la fecha en su columna, «Ver» si la dirección es https:// y la etiqueta suave «Efeméride»', () => {
    assert.ok(html.includes('background-color: #F4F8FC; border: 1px solid #E1EAF3; border-radius: 6px'));
    assert.match(html, /<h3 [^>]*>Agenda de la quincena<\/h3>/);
    assert.match(html, /<td valign="top" style="[^"]*width: 84px;[^"]*white-space: nowrap;">20\/11\/2026<\/td>/);
    assert.equal(veces(html, '>Efeméride</span>'), 1);
    assert.match(html, /<strong>Efeméride inventada<\/strong> <span style="[^"]*background-color: #E4E9EF; color: #2B3A4A;[^"]*">Efeméride<\/span><br>Una fecha inventada\.<br>Con un segundo renglón\. <a href="https:\/\/datos\.ejemplo\.test\/agenda\/efemeride" style="color: #3E6B96;[^"]*">Ver<\/a>/);
    const sinEnlace = mail((m) => { m.agenda[0].url = 'http://datos.ejemplo.test/agenda'; }).html;
    assert.equal(veces(sinEnlace, '>Ver</a>'), 1);
    assert.ok(!sinEnlace.includes('http://'));
    const sinAgenda = mail((m) => { m.agenda = []; }).html;
    assert.ok(!sinAgenda.includes('Agenda de la quincena'));
    assert.ok(textoVisible(sinAgenda).includes('(para editarla). Propuesta 1 de 2'));
  });

  it('cada propuesta en su tarjeta con su franja: la principal en #1F3A5F, con «Principal» y borde de 2 px; las demás en el celeste del encabezado', () => {
    assert.equal(veces(html, 'border: 2px solid #1F3A5F'), 1);
    assert.match(html, /<td bgcolor="#1F3A5F" style="padding: 10px 16px; background-color: #1F3A5F; border-bottom: 1px solid #1F3A5F;"><span style="color: #FFFFFF; font-size: 13px; font-weight: 700;">Propuesta 1 de 2<\/span><span style="color: #FFFFFF; font-size: 13px;">&nbsp;&nbsp;Principal<\/span><\/td>/);
    assert.match(html, /<td bgcolor="#E3EEF8" style="padding: 10px 16px; background-color: #E3EEF8; border-bottom: 1px solid #CFE0F0;"><span style="color: #1F3A5F; font-size: 13px; font-weight: 700;">Propuesta 2 de 2<\/span><\/td>/);
    assert.equal(veces(html, 'background-color: #FFFFFF; border: 1px solid #E1EAF3; border-radius: 6px'), 1);
    // 28 px entre una propuesta y la otra, con una fila de alto fijo (Outlook)
    assert.equal(veces(html, '<td height="28" style="height: 28px; font-size: 0; line-height: 0;">&nbsp;</td>'), 1);
    const tres = mail((m) => { m.propuestas.push({ ...modeloDelDatoQuincena().propuestas[1], franja: 'Propuesta 3 de 3' }); }).html;
    assert.equal(veces(tres, '<td height="28"'), 2);
  });

  it('las etiquetas Validar y Agenda van en pastillas; Principal, solo en la franja', () => {
    assert.match(html, /<span style="[^"]*background-color: #FBF1DC; color: #7A5A14;[^"]*border-radius: 10px;[^"]*">Validar<\/span>/);
    assert.match(html, /<span style="[^"]*background-color: #E3EEF8; color: #1F3A5F;[^"]*border-radius: 10px;[^"]*">Agenda<\/span>/);
    assert.equal(veces(html, 'Principal</span>'), 1);
  });

  it('la cifra en negrita de 16 px; el dataset con su enlace y la foto del RPAD en gris de 12 px', () => {
    assert.match(html, /<p style="margin: 8px 0 0 0; color: #2B3A4A; font-size: 16px; font-weight: 600;[^"]*">1\.234 casos · octubre de 2026<\/p>/);
    assert.ok(html.includes('Dataset: <a href="https://datos.ejemplo.test/dataset/a" style="color: #3E6B96; text-decoration: none;">Dataset de prueba A</a>'));
    assert.match(html, /<p style="margin: 4px 0 0 0; color: #6B7A8C; font-size: 12px;[^"]*">En el RPAD ese día: Actualizado\. Datos al 31\/10\/2026\. Última actualización 05\/11\/2026\. Próxima en 25 días\.<\/p>/);
  });

  it('«Para validar antes de publicar» va en el aviso ámbar, solo en la propuesta que tiene notas', () => {
    assert.equal(veces(html, 'Para validar antes de publicar'), 1);
    assert.match(html, /background-color: #FBF1DC; border: 1px solid #F0DDB0;[^>]*>(\s*<(tr|td)[^>]*>)*\s*<p [^>]*color: #7A5A14;[^>]*><strong>Para validar antes de publicar<\/strong><br>• Confirmar la cifra con el área\.<br>• Revisar la fuente\.<\/p>/);
  });

  it('el texto para redes y el borrador van en recuadros; los puntos, en una lista; las fuentes https://, como enlaces', () => {
    // La agenda y dos por propuesta
    assert.equal(veces(html, 'background-color: #F4F8FC; border: 1px solid #E1EAF3; border-radius: 6px'), 5);
    for (const titulo of ['Por qué hoy', 'Ángulo', 'Idea de placa', 'Texto para redes', 'Puntos centrales', 'Borrador de nota', 'Fuentes']) {
      assert.equal(veces(html, `>${titulo}</h3>`), 2, titulo);
    }
    assert.ok(html.includes('<li>Primer punto.</li><li>Segundo punto.</li><li>Tercer punto.</li>'));
    assert.ok(html.includes('<a href="https://datos.ejemplo.test/a.csv" style="color: #3E6B96; text-decoration: none;">https://datos.ejemplo.test/a.csv</a><br><a href="https://datos.ejemplo.test/b.csv"'));
    assert.ok(html.includes('>Un texto para redes inventado.<br>Con un segundo renglón.</p>'));
  });

  it('la plantilla no nombra al bot: lo trae el modelo; sin nombre, la nota dice «del bot»', () => {
    assert.ok(!fuente('emailTemplates.js').includes('Datito'));
    for (const nombreDelBot of [null, '', '   ', 7]) {
      const { html: sinNombre, text } = mail((m) => { m.nombreDelBot = nombreDelBot; });
      const nota = 'En el RPAD también están el texto del correo del bot, los cálculos y la edición completa.';
      assert.ok(sinNombre.includes(nota) && text.includes(nota), String(nombreDelBot));
    }
  });

  it('el botón «Ver la edición en el RPAD» abre la edición y la nota del pie dice por qué llega', () => {
    assert.ok(html.includes('<a href="https://rpad.test/dato-quincena.html?id=12" style="display: inline-block; color: #FFFFFF;'));
    assert.ok(html.includes('>Ver la edición en el RPAD</a>'));
    assert.match(html, /<p style="margin: 0; color: #6B7A8C; font-size: 12px; line-height: 1\.5;">En el RPAD también están el texto del correo de Datito, los cálculos y la edición completa\. Te llega porque estás en la lista del dato de la quincena; para dejar de recibirlo, avisale a la Dirección\.<\/p>/);
  });

  // spec 2026-11-14-dato-quincena-v1-3, 5: «Repite» en una pastilla blanca con borde; «Efeméride» en una propuesta, la misma de la
  // agenda; y la caja de la repetición, después de la foto y antes de «Para validar», con el enlace a la edición previa solo con un id
  const REPETICION = Object.freeze({
    texto: 'Repite el dataset de la edición del 02/11/2026.',
    motivo: 'Datos nuevos: Llegaron los datos de octubre, que la edición anterior no tenía.',
    id_edicion: 12
  });
  const repitiendo = (cambios = {}, i = 0) => (m) => {
    m.propuestas[i].etiquetas.push('Repite');
    m.propuestas[i].repeticion = { ...REPETICION, ...cambios };
  };
  const CAJA_DE_LA_REPETICION = 'background-color: #F4F7FA; border: 1px solid #DAE3ED; border-radius: 6px';

  it('«Repite» va en una pastilla blanca con borde; «Efeméride» en una propuesta, la suave de la agenda; las demás, sin borde', () => {
    const conEtiquetas = mail((m) => {
      repitiendo({}, 1)(m);
      m.propuestas[1].etiquetas = ['Agenda', 'Efeméride', 'Repite'];
    }).html;
    assert.match(conEtiquetas, /<span style="[^"]*background-color: #FFFFFF; color: #2B3A4A; border: 1px solid #76879F;[^"]*border-radius: 10px;[^"]*">Repite<\/span>/);
    assert.equal(veces(conEtiquetas, '>Efeméride</span>'), 2, 'la de la agenda y la de la propuesta');
    assert.equal(veces(conEtiquetas, 'background-color: #E4E9EF; color: #2B3A4A; font-size: 12px;'), 2);
    assert.equal(veces(conEtiquetas, 'border: 1px solid #76879F'), 1);
    assert.ok(!html.includes('#76879F'), 'sin Repite, ninguna pastilla con borde');
    // La pastilla con borde mide lo mismo que las otras: un píxel menos de relleno de cada lado
    assert.match(conEtiquetas, /border: 1px solid #76879F; font-size: 12px; font-weight: 600; padding: 1px 9px; border-radius: 10px;">Repite</);
    assert.match(conEtiquetas, /color: #1F3A5F; font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 10px;">Agenda</);
  });

  it('la caja de la repetición, después de la foto y antes de «Para validar»: el texto en negrita, con el enlace, y abajo el motivo', () => {
    const conCaja = mail(repitiendo()).html;
    assert.equal(veces(conCaja, CAJA_DE_LA_REPETICION), 1);
    // Subrayado: es negrita, como el texto sin enlace, y el color solo no lo distingue (la maqueta lo tenía así)
    const enlace = `<a href="${plantillas.RPAD_URL}/dato-quincena.html?id=12" style="color: #3E6B96; text-decoration: underline;">`
      + 'Repite el dataset de la edición del 02/11/2026.</a>';
    assert.match(conCaja, new RegExp(`${CAJA_DE_LA_REPETICION}[^>]*>(\\s*<(tr|td)[^>]*>)*\\s*<p style="margin: 0; color: #2B3A4A; `
      + `font-size: 14px; line-height: 1\\.6;"><strong>${enlace.replace(/[.?]/g, '\\$&')}</strong></p><p style="margin: 4px 0 0 0; `
      + 'color: #2B3A4A; font-size: 14px; line-height: 1\\.6;">Datos nuevos: Llegaron los datos de octubre, que la edición anterior no '
      + 'tenía\\.</p>'));
    const propuesta = conCaja.slice(conCaja.indexOf('Propuesta 1 de 2'), conCaja.indexOf('Propuesta 2 de 2'));
    const foto = propuesta.indexOf('En el RPAD ese día:');
    const caja = propuesta.indexOf(CAJA_DE_LA_REPETICION);
    assert.ok(foto > 0 && foto < caja && caja < propuesta.indexOf('Para validar antes de publicar'), 'entre la foto y Para validar');
    // Con aire arriba, en una celda (Outlook no respeta el margin de una tabla)
    assert.match(propuesta, /<td style="padding: 12px 0 0 0;">\s*<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width: 100%; background-color: #F4F7FA;/);
  });

  it('sin un id entero positivo, el texto sin enlace; sin repetición (null o sin la clave), ninguna caja', () => {
    // Los demás enlaces del mail siguen sin subrayar: solo el de la repetición lo lleva
    assert.equal(veces(mail(repitiendo()).html, 'text-decoration: underline'), 1);
    assert.ok(!html.includes('text-decoration: underline'));
    for (const id_edicion of [null, undefined, 0, -3, 1.5, '12', Number.MAX_SAFE_INTEGER + 1]) {
      const sinEnlace = mail(repitiendo({ id_edicion })).html;
      assert.ok(!sinEnlace.includes('text-decoration: underline'), String(id_edicion));
      assert.ok(sinEnlace.includes('<strong>Repite el dataset de la edición del 02/11/2026.</strong>'), String(id_edicion));
      assert.equal(veces(sinEnlace, '/dato-quincena.html?id='), 1, `solo el botón: ${String(id_edicion)}`);
    }
    assert.ok(!html.includes(CAJA_DE_LA_REPETICION), 'el modelo sin repetición');
    assert.deepEqual(modeloDelDatoQuincena().propuestas.map((p) => p.repeticion), [null, null]);
    const sinLaClave = mail((m) => { for (const p of m.propuestas) delete p.repeticion; }).html;
    assert.equal(sinLaClave, html);
    const conRaro = mail((m) => { m.propuestas[0].repeticion = 'sí'; }).html;
    assert.ok(!conRaro.includes(CAJA_DE_LA_REPETICION));
  });

  it('la repetición va escapada, con sus saltos de línea como <br>', () => {
    const raro = '<b>x</b>';
    const { html: escapado, text } = mail(repitiendo({ texto: raro, motivo: `${raro}\n${raro}`, id_edicion: 12 }));
    assert.ok(!escapado.includes(raro));
    assert.ok(escapado.includes(`<strong><a href="${plantillas.RPAD_URL}/dato-quincena.html?id=12" style="color: #3E6B96; text-decoration: underline;">${ESCAPADO}</a></strong>`));
    assert.ok(escapado.includes(`>${ESCAPADO}<br>${ESCAPADO}</p>`));
    assert.ok(text.includes(`${raro}\n${raro}\n${raro}`), 'el texto plano, tal cual');
  });

  it('todo texto de la edición va escapado, con sus saltos de línea como <br>; una dirección es enlace solo si es https://', () => {
    const raro = '<b>x</b>';
    const { html: escapado, text } = mail((m) => {
      m.primerNombre = raro;
      m.agenda[0].titulo = raro;
      m.agenda[0].detalle = `${raro}\r\n${raro}`;
      const [p] = m.propuestas;
      for (const campo of ['titulo', 'cifra_clave', 'por_que_hoy', 'angulo', 'idea_placa', 'texto_redes']) p[campo] = raro;
      p.dataset = { nombre: raro, id_enlace: null, url: 'javascript:alert(1)' };
      p.foto = [{ rotulo: raro, valor: raro }];
      p.notas_validacion = [raro];
      p.puntos_centrales = [raro];
      p.borrador_nota = { titulo: raro, parrafos: [raro] };
      p.fuentes = ['http://datos.ejemplo.test/sin-https.csv', 'https://datos.ejemplo.test/a.csv?b="c"&d=<e>'];
    });
    assert.ok(!escapado.includes(raro));
    assert.ok(!escapado.includes('&amp;lt;'), 'escapado dos veces');
    assert.ok(escapado.includes(`${ESCAPADO}<br>${ESCAPADO}`));
    assert.ok(escapado.includes(`alt="Infografía de la propuesta principal: ${ESCAPADO}"`));
    assert.ok(!escapado.includes('javascript:'));
    assert.ok(escapado.includes(`Dataset: ${ESCAPADO}</p>`));
    assert.ok(!escapado.includes('href="http://'));
    assert.ok(escapado.includes('>http://datos.ejemplo.test/sin-https.csv<br><a href="https://datos.ejemplo.test/a.csv?b=&quot;c&quot;&amp;d=&lt;e&gt;"'));
    // El texto plano lleva los textos tal cual
    assert.ok(text.startsWith(`Buen día, ${raro}.`));
  });
});

describe('Remitente único', () => {
  it('remitente(): "Dir. de Datos Públicos y Comunicación" con la casilla de SMTP_USER', () => {
    const antes = process.env.SMTP_USER;
    process.env.SMTP_USER = 'rpad@rpad.test';
    try {
      assert.equal(remitente(), '"Dir. de Datos Públicos y Comunicación" <rpad@rpad.test>');
    } finally {
      if (antes === undefined) delete process.env.SMTP_USER;
      else process.env.SMTP_USER = antes;
    }
  });

  it('se define en un solo lugar: ningún servicio arma otro nombre de remitente', () => {
    for (const archivo of ['emailService.js', 'accesoService.js', 'notasDigitales.js']) {
      const codigo = fuente(archivo);
      assert.ok(!/RPAD - Notificaciones|RPAD - Datos Abiertos MCR/.test(codigo), archivo);
      assert.equal(codigo.includes('"Dir. de Datos Públicos y Comunicación" <'), archivo === 'emailService.js', archivo);
    }
  });
});
