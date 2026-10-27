// Diseño de los emails del sistema ("celeste institucional"): un solo marco para todas las plantillas de
// services/emailTemplates.js (las Notas Digitales tienen su propio armado y no cambian), sin degradés, sombras ni emojis,
// con los textos fijos con tildes, y un solo remitente para todos los envíos. Asuntos y contenido quedan como estaban.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import * as plantillas from '../services/emailTemplates.js';
import { remitente } from '../services/emailService.js';
import { casosDeEmail, textoVisible } from './emails-fixtures.js';

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
    'vencimiento de Mi espacio': 'RPAD: lo que vence pronto en Mi espacio'
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
    'vencimiento de Mi espacio': `${RPAD} Lo que vence pronto Hola, Persona de Prueba. Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10. Tenés 3 días de la licencia 2024: vence el 31/12/2026. Ver en Mi espacio Este aviso te llega una sola vez por cada cosa. Lo que cargás en Mi espacio lo ves solo vos. ${PIE}`
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
