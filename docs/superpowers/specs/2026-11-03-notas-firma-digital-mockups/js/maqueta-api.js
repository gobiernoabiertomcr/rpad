// MAQUETA (03/11/2026), sin servidor: una sesión de prueba y las respuestas de la API, con datos inventados. Va antes que
// config.js. No guarda nada: recargar la página vuelve al principio. Las notas, las personas y los emails no existen.
(function () {
  const usuario = { id: 1, username: 'jferreyra', nombre_completo: 'Julieta Ferreyra', rol: 'admin', email: 'jferreyra@ejemplo.gob.ar' };
  const payload = btoa(JSON.stringify({ userId: 1, rol: 'admin', exp: 4102444800 })).replace(/=+$/, '');
  localStorage.setItem('rpad_token', `maqueta.${payload}.firma`);
  localStorage.setItem('rpad_user', JSON.stringify(usuario));

  const nota = (id, numero, fecha, tipo, gestion, cantidad, extra = {}) => ({
    id, numero, anio: 2026, fecha, tipo, gestion, cantidad_datasets: cantidad, cantidad_cambios: cantidad, es_prueba: 0,
    para: gestion === 'interna' ? 'dgmit@ejemplo.gob.ar, investigacion@ejemplo.gob.ar' : 'dgmit@ejemplo.gob.ar, administrativa@ejemplo.gob.ar',
    cc: 'datospublicos@ejemplo.gob.ar', estado: 'enviada', enviada_at: `${fecha} 08:05:09`, tiene_anexo: tipo === 'aviso' || tipo === 'reiteracion',
    ultimo_error: null, respuesta_smtp: '250 OK', intentos: 1, asunto: `Nota Digital N° ${numero}/26`, ...extra
  });
  const HOY = '2026-12-01';
  // El estado de la maqueta: propuesta.js lo cambia al «subir»
  window.MQ = {
    HOY,
    notas: [
      nota(13, 13, HOY, 'reiteracion', 'interna', 3, { estado: 'pendiente', enviada_at: null, espera_firma: true, intentos: 0, respuesta_smtp: null }),
      nota(12, 12, HOY, 'reiteracion', 'externa', 9, { estado: 'pendiente', enviada_at: null, espera_firma: true, intentos: 0, respuesta_smtp: null }),
      nota(11, 11, '2026-11-25', 'auditoria', null, 2, { firmado_por: 'Julieta Ferreyra', firmado_at: '2026-11-25 09:12', tiene_anexo: false, enviada_at: '2026-11-25 09:14:31' }),
      nota(10, 10, '2026-11-24', 'aviso', 'externa', 6, { firmado_por: 'Julieta Ferreyra', firmado_at: '2026-11-24 10:40', enviada_at: '2026-11-24 10:42:02' }),
      nota(9, 9, '2026-11-03', 'aviso', 'interna', 4, { enviada_at: '2026-11-03 14:00:07' }),
      nota(8, 8, '2026-11-03', 'reiteracion', 'externa', 7)
    ]
  };
  const estado = () => {
    const esperan = window.MQ.notas.filter((n) => n.espera_firma).length;
    return {
      envio_activo: true, firma_digital_activa: window.MQ.firmaActiva !== false, configuracion_faltante: [], fallidas: 0,
      alertas: esperan ? [{ tipo: 'para-firmar', nivel: 'advertencia', mensaje: window.MQ.notas.filter((n) => n.espera_firma && !n.firmado_por).length ? `Hay ${esperan === 1 ? '1 nota' : `${esperan} notas`} para firmar. Las que no se suban antes de las 14:00 salen con la imagen de la firma.` : `Hay ${esperan === 1 ? '1 nota firmada' : `${esperan} notas firmadas`} sin enviar. Salen solas a las 14:00.` }] : [],
      ultima_corrida: { inicio: `${HOY} 08:05:02`, fin: `${HOY} 08:05:11`, resultado: 'Notas generadas: 2. Para firmar: 2.', con_errores: false },
      eventos: { texto: 'Recordatorios de la agenda: última corrida hoy a las 08:30. Recordatorios enviados: 0.' },
      licencia_firmante: null, auditoria: { canal_nota: 0, sin_quien_audite: 0, periodos_sin_auditor: [] },
      proximas: { interna: { aviso: { fecha: '2026-12-02', cantidad: 2 }, reiteracion: { cantidad: 0, fecha: '2027-01-04' } }, externa: { aviso: { fecha: '2026-12-22', cantidad: 5 }, reiteracion: { cantidad: 4, fecha: '2027-01-04' } } }
    };
  };
  const respuesta = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  const original = window.fetch.bind(window);
  window.fetch = async (url, opciones = {}) => {
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return original(url, opciones);
    const ruta = u.pathname.slice(4);
    if (ruta === '/auth/verify') return respuesta(200, { success: true, data: { user: usuario } });
    if (ruta === '/notificaciones/notas-digitales/estado') return respuesta(200, { success: true, data: estado() });
    if (ruta === '/notificaciones/notas-digitales') return respuesta(200, { success: true, data: window.MQ.notas });
    if (ruta === '/notificaciones/notas-digitales/config/firmantes') return respuesta(200, { success: true, data: [{ id: 1, nombre_completo: 'Julieta Ferreyra', tiene_firma: true }] });
    if (ruta === '/notificaciones/notas-digitales/config') return respuesta(200, { success: true, data: { envio_activo: true, firmante_usuario_id: 1, para_interna: 'dgmit@ejemplo.gob.ar', para_externa: 'dgmit@ejemplo.gob.ar', cc_interna: '', cc_externa: '', cco: '', para_auditoria: 'auditoria@ejemplo.gob.ar', cc_auditoria: '', firmante_nombre: 'Julieta Ferreyra', firmante_cargo: 'Directora', membrete_pie: '', tiene_firma: true, tiene_membrete: false } });
    if (ruta === '/datasets') return respuesta(200, { success: true, data: [] });
    if (ruta.endsWith('/pdf') || ruta.endsWith('/anexo') || ruta.endsWith('/word')) { alert('En la maqueta no se baja ningún archivo.'); return respuesta(404, { success: false, error: '(Maqueta) No se baja nada.' }); }
    return respuesta(200, { success: true, data: { cantidad: 0 } });
  };
})();
