// Datos de ejemplo para las plantillas de services/emailTemplates.js: una entrada por email del sistema
// (las Notas Digitales tienen su propio armado y no están acá). Los usa tests/email-diseno.test.js.

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
  const area = {
    area_id: 1,
    area_nombre: 'Dirección de Prueba',
    datasets: [
      { id: 1, titulo: 'Dataset A', frecuencia_nombre: 'Anualmente', url_dataset: 'https://datos.rpad.test/dataset/a' },
      { id: 2, titulo: 'Dataset B & C', frecuencia_nombre: null, url_dataset: null }
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

  return [
    { nombre: 'cambios pendientes', email: t.cambiosPendientesTemplate(cambios), boton: true },
    { nombre: 'cambios pendientes de respaldo', email: t.cambiosPendientesTemplate(cambios.slice(0, 1), { respaldo: true }), boton: true },
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
    { nombre: 'resumen de avisos retenidos', email: t.resumenAvisosRetenidosTemplate([fila('Desactivado', '13:00'), fila('Lector → Administrador', '15:30')]), boton: true }
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
