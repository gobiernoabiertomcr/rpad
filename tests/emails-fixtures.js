// Datos de ejemplo para las plantillas de services/emailTemplates.js: una entrada por email del sistema
// (las Notas Digitales tienen su propio armado y no están acá). Los usa tests/email-diseno.test.js.

// El primer aviso de los días para restituir de Julieta Ferreyra, la persona inventada de la maqueta (spec
// 2026-10-31-mi-espacio-dias-restituidos, 5 y 10), como lo arma avisosDeVencimiento (services/miEspacioReglas.js) el lunes
// 11/01/2027: sus párrafos por partes (un texto o { negrita }) y, en `texto`, los mismos en texto plano
export const AVISO_DE_RESTITUCION = Object.freeze({
  clave: 'restitucion-1-2024-0-1',
  texto: 'Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés 2 días restituidos '
    + 'de la licencia 2024. Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el viernes 30/04/2027, '
    + 'con la nota al Director General. Si no, se pierden. En Mi espacio podés cargarlos y bajar la nota en Word.',
  restitucion: Object.freeze({
    grupo: '1-2024-0',
    partes: [
      ['Los asuetos del 24 y el 31/12/2026 cayeron en tus vacaciones del 11/12/2026 al 08/01/2027: tenés ',
        { negrita: '2 días restituidos de la licencia 2024' }, '.'],
      ['Como esa licencia ya venció, tomalos todos juntos, empezando a más tardar el ', { negrita: 'viernes 30/04/2027' },
        ', con la nota al Director General. Si no, se pierden.'],
      ['En Mi espacio podés cargarlos y bajar la nota en Word.']
    ],
    primero: true
  })
});

// El modelo del mail del dato de la quincena (spec 2026-11-12-dato-quincena-correo, 10), con la forma que arma modeloDelMail
// (services/datoQuincenaCorreoReglas.js): una regular inventada de dos propuestas, la primera la principal y con notas para
// validar, y una agenda con un evento y una efeméride (el segundo renglón de su detalle es un salto de línea); ninguna propuesta
// repite otra edición (repeticion null, spec 2026-11-14-dato-quincena-v1-3). Ningún dato sale de una edición real. Cada llamada
// arma objetos nuevos: un test puede cambiarlos sin tocar el próximo
export const modeloDelDatoQuincena = () => ({
  asunto: 'Dato de la Quincena - 09/11/2026',
  primerNombre: 'Persona',
  titulo: 'Dato de la Quincena - 09/11/2026',
  numero: 'Edición N.º 1',
  bajada: '2 propuestas de comunicación que armó Datito. Son internas: todavía no están aprobadas ni publicadas.',
  agenda: [
    {
      fecha_texto: '12/11/2026', titulo: 'Jornada inventada', detalle: 'Un evento inventado para las pruebas.',
      url: 'https://datos.ejemplo.test/agenda/jornada', etiqueta: null
    },
    {
      fecha_texto: '20/11/2026', titulo: 'Efeméride inventada', detalle: 'Una fecha inventada.\nCon un segundo renglón.',
      url: 'https://datos.ejemplo.test/agenda/efemeride', etiqueta: 'Efeméride'
    }
  ],
  propuestas: [
    {
      franja: 'Propuesta 1 de 2',
      etiquetas: ['Principal', 'Validar'],
      principal: true,
      titulo: 'Un título inventado',
      cifra_clave: '1.234 casos · octubre de 2026',
      dataset: { nombre: 'Dataset de prueba A', id_enlace: 1, url: 'https://datos.ejemplo.test/dataset/a' },
      foto: [
        { rotulo: 'En el RPAD ese día:', valor: 'Actualizado' }, { rotulo: 'Datos al', valor: '31/10/2026' },
        { rotulo: 'Última actualización', valor: '05/11/2026' }, { rotulo: 'Próxima en', valor: '25 días' }
      ],
      repeticion: null,
      notas_validacion: ['Confirmar la cifra con el área.', 'Revisar la fuente.'],
      calculo: 'Un cálculo inventado.',
      contexto_historico: 'Un contexto inventado.',
      por_que_hoy: 'Una razón inventada.',
      angulo: 'Un ángulo inventado.',
      idea_placa: 'Una placa inventada.',
      texto_redes: 'Un texto para redes inventado.\nCon un segundo renglón.',
      puntos_centrales: ['Primer punto.', 'Segundo punto.', 'Tercer punto.'],
      borrador_nota: { titulo: 'Un borrador inventado', parrafos: ['Primer párrafo.', 'Segundo párrafo.'] },
      fuentes: ['https://datos.ejemplo.test/a.csv', 'https://datos.ejemplo.test/b.csv']
    },
    {
      franja: 'Propuesta 2 de 2',
      etiquetas: ['Agenda'],
      principal: false,
      titulo: 'Otro título inventado',
      cifra_clave: '56 casos · octubre de 2026',
      dataset: { nombre: 'Dataset de prueba B', id_enlace: null, url: 'https://datos.ejemplo.test/dataset/b' },
      foto: [
        { rotulo: 'En el RPAD ese día:', valor: 'Vencido' }, { rotulo: 'Datos al', valor: '—' },
        { rotulo: 'Última actualización', valor: '03/06/2026' }, { rotulo: 'Venció hace', valor: '4 días' }
      ],
      repeticion: null,
      notas_validacion: [],
      calculo: 'Otro cálculo inventado.',
      contexto_historico: 'Otro contexto inventado.',
      por_que_hoy: 'Otra razón inventada.',
      angulo: 'Otro ángulo inventado.',
      idea_placa: 'Otra placa inventada.',
      texto_redes: 'Otro texto para redes inventado.',
      puntos_centrales: ['Un punto.', 'Otro punto.', 'Un tercer punto.'],
      borrador_nota: { titulo: 'Otro borrador inventado', parrafos: ['Un párrafo.', 'Otro párrafo.', 'Un tercer párrafo.'] },
      fuentes: ['https://datos.ejemplo.test/c.csv']
    }
  ],
  url: 'https://rpad.test/dato-quincena.html?id=12',
  nombreDelBot: 'Datito'
});

// Cada caso: { nombre, email: { subject, html, text? }, boton }. boton: si el email tiene un botón
export const casosDeEmail = (t) => {
  const cambios = [
    { id: 1, tipo_cambio: 'editar', dataset_titulo: 'Padrón de comercios <b>2026</b>', usuario_nombre: 'Persona Editora', usuario_username: 'peditora', tiempo_pendiente: 'Hace 2 días' },
    { id: 2, tipo_cambio: 'crear', datos_nuevos: { titulo: 'Alta de prueba' }, usuario_nombre: 'Persona Admin', usuario_username: 'padmin', tiempo_pendiente: 'Hace 3 horas' },
    { id: 3, tipo_cambio: 'eliminar', dataset_titulo: 'Dataset viejo', usuario_nombre: null, usuario_username: 'pusuario', tiempo_pendiente: 'Hace 1 hora' }
  ];
  const sinAuditor = [
    { id: 4, tipo_cambio: 'editar', dataset_titulo: 'Arbolado urbano', fecha_propuesta: '2026-10-01' },
    { id: 5, tipo_cambio: 'crear', datos_nuevos: { titulo: 'Alta nueva' }, fecha_propuesta: '2026-10-02' }
  ];
  // Cada dataset del aviso trae su vencimiento ('AAAA-MM-DD') y su pedido ({ desde, hasta, texto } o null), como los arma
  // datasetsExternosPorArea. El B no tiene pedido (eventual): no lleva "Datos que se solicitarán", pero sí la fecha
  const area = {
    area_id: 1,
    area_nombre: 'Dirección de Prueba',
    datasets: [
      {
        id: 1, titulo: 'Dataset A', frecuencia_nombre: 'Anualmente', url_dataset: 'https://datos.rpad.test/dataset/a',
        vencimiento: '2026-12-31', pedido: { desde: '2026-01-01', hasta: '2026-11-30', texto: 'Del 01/01/2026 al 30/11/2026' }
      },
      { id: 2, titulo: 'Dataset B & C', frecuencia_nombre: null, url_dataset: null, vencimiento: '2027-01-31', pedido: null }
    ]
  };
  const contacto = {
    nombre: 'Persona Consultante', email: 'consulta@rpad.test', tipo: 'Consulta general',
    mensaje: 'Hola.\nQuería saber cuándo se actualiza el padrón.', fecha: 'viernes, 16 de octubre de 2026, 10:30', ip: '127.0.0.1'
  };
  const acceso = { nombre_completo: 'Persona Nueva', username: 'pnueva', rol: 'admin', link: 'https://rpad.test/establecer-contrasena.html#token=abc', vence: '19 de octubre de 2026 a las 10:30' };
  const fila = (cambio, hora) => ({
    created_at: `2026-11-10T${hora}:00Z`, actor_nombre: 'Persona Admin', actor_username: 'padmin',
    afectado_nombre: 'Persona Lectora', afectado_username: 'plectora', cambio
  });
  // Un evento de la agenda de Mi espacio, como lo leen la API y la corrida (el martes 27/10/2026); el cambio lo pasa al miércoles
  const evento = {
    titulo: 'Reunión de equipo', fecha: '2026-10-27', desde: '10:00', hasta: '11:00', detalle: 'Sala de reuniones del 2.º piso.'
  };

  return [
    { nombre: 'cambios pendientes', email: t.cambiosPendientesTemplate(cambios), boton: true },
    { nombre: 'cambios pendientes de respaldo', email: t.cambiosPendientesTemplate(cambios.slice(0, 1), { respaldo: true }), boton: true },
    {
      nombre: 'notas para firmar (una)',
      email: t.notasParaFirmarTemplate({ nombre: 'Julieta <b>Ferreyra</b>', notas: [{ numero: 12, anio: 2026, tipo: 'reiteracion', gestion: 'externa' }] }),
      boton: true
    },
    {
      nombre: 'notas para firmar (varias)',
      email: t.notasParaFirmarTemplate({ nombre: 'Julieta Ferreyra', notas: [
        { numero: 12, anio: 2026, tipo: 'reiteracion', gestion: 'externa' }, { numero: 1, anio: 2027, tipo: 'auditoria', gestion: null }
      ] }),
      boton: true
    },
    { nombre: 'sin auditor (uno)', email: t.sinAuditorTemplate(sinAuditor.slice(0, 1), { hasta: null }), boton: false },
    { nombre: 'sin auditor (varios)', email: t.sinAuditorTemplate(sinAuditor, { hasta: '2027-01-11' }), boton: false },
    { nombre: 'aviso a las áreas', email: t.areaAviso40dias(area), boton: false },
    { nombre: 'contacto', email: t.contactoTemplate(contacto), boton: true },
    { nombre: 'invitación', email: t.invitacionTemplate(acceso), boton: true },
    { nombre: 'recuperación', email: t.recuperacionTemplate(acceso), boton: true },
    {
      nombre: 'aviso al superadmin',
      email: t.avisoSuperadminTemplate({
        actor: { nombre_completo: 'Persona Admin', username: 'padmin' },
        afectado: { nombre_completo: 'Persona Lectora', username: 'plectora' },
        cambio: 'Lector → Administrador',
        fecha: new Date('2026-10-16T13:30:00Z')
      }),
      boton: true
    },
    { nombre: 'resumen de avisos retenidos', email: t.resumenAvisosRetenidosTemplate([fila('Desactivado', '13:00'), fila('Lector → Administrador', '15:30')]), boton: true },
    {
      nombre: 'vencimiento de Mi espacio',
      email: t.vencimientoMiEspacioTemplate({
        nombre_completo: 'Persona de Prueba',
        avisos: [
          { clave: 'franco-2026-10', texto: 'Tenés 1 franco compensatorio para usar en octubre: el último día hábil es el viernes 30/10.' },
          { clave: 'licencia-2024', texto: 'Tenés 3 días de la licencia 2024: vence el 31/12/2026.' }
        ]
      }),
      boton: true
    },
    // El email de la maqueta de los días restituidos: el primer aviso, solo
    {
      nombre: 'días para restituir',
      email: t.vencimientoMiEspacioTemplate({ nombre_completo: 'Julieta Ferreyra', avisos: [AVISO_DE_RESTITUCION] }),
      boton: true
    },
    // El aviso diario de la agenda (spec 2026-11-04-agenda-aviso-y-dependencia, 8), con lo propio y lo de su gente
    {
      nombre: 'aviso diario de la agenda',
      email: t.avisoDiarioTemplate({
        persona: { nombre_completo: 'Graciela Paz' }, hoy: '2026-11-06',
        mail: {
          dias: ['2026-11-07', '2026-11-08', '2026-11-09'], soloHoy: false, informa: [],
          propios: [{ fecha: '2026-11-09', desde: '11:00', titulo: 'Reunión de portal de datos', detalle: 'Revisar la lista.', marca: 'Laboral, de Federico' }],
          gente: [{ fecha: '2026-11-09', desde: '08:00', hasta: '10:00', texto: 'Micaela: Fuera de la oficina', nuevo: false }]
        }
      }),
      boton: true
    },
    { nombre: 'evento: invitación', email: t.eventoInvitacionTemplate({ creador: 'Persona de Prueba', evento }), boton: true },
    {
      nombre: 'evento: cambio',
      email: t.eventoCambioTemplate({ creador: 'Persona de Prueba', antes: evento, despues: { ...evento, fecha: '2026-10-28' } }),
      boton: true
    },
    { nombre: 'evento: cancelación', email: t.eventoCancelacionTemplate({ creador: 'Persona de Prueba', evento }), boton: true },
    { nombre: 'evento: recordatorio', email: t.eventoRecordatorioTemplate({ evento, hoy: '2026-10-27' }), boton: true },
    // El dato de la quincena (spec 2026-11-12-dato-quincena-correo, 10): el mail de la maqueta, con el SVG adjunto
    { nombre: 'dato de la quincena', email: t.datoQuincenaTemplate(modeloDelDatoQuincena(), { conSvg: true }), boton: true }
  ];
};

// Texto visible del cuerpo del email: sin etiquetas ni comentarios, con las entidades resueltas y los espacios normalizados.
// Las etiquetas de texto (strong, a, span...) se sacan sin dejar espacio; las demás separan con un espacio
export const textoVisible = (html) => (html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] ?? html)
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<\/?(strong|b|em|i|u|span|a)\b[^>]*>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();
