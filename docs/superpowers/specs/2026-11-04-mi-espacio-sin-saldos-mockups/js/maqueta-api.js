// MAQUETA (04/11/2026), sin servidor: una sesión de prueba y las respuestas de la API de Mi espacio, guardadas en datos.js (armadas
// con las funciones reales, con personas inventadas). Solo «Guardar» en «Mis vacaciones y saldos» pasa al estado siguiente.
(function () {
  const parametros = new URLSearchParams(location.search);
  const persona = parametros.get('persona') === 'contrato' ? 'contrato' : 'planta';
  const D = window.MAQUETA_DATOS[persona];
  const MQ = window.MQ = { persona, estado: parametros.get('estado') === 'completo' ? 'completo' : 'vacio', datos: D };
  const usuario = D.usuario;
  const payload = btoa(JSON.stringify({ userId: usuario.id, rol: usuario.rol, exp: 4102444800 })).replace(/=+$/, '');
  localStorage.setItem('rpad_token', `maqueta.${payload}.firma`);
  localStorage.setItem('rpad_user', JSON.stringify(usuario));

  const espera = (ms) => new Promise((resolver) => { setTimeout(resolver, ms); });
  const respuesta = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const AVISO = { licencias: 'Para usar Licencias, primero tenés que cargar tus saldos.', horas: 'Para usar Horas extras, primero tenés que cargar tus saldos.' };
  // Lo nuevo de la spec, sobre lo que manda hoy el servidor
  const conLaPropuesta = (ruta, json) => {
    if (MQ.estado !== 'vacio') return json;
    const r = copia(json);
    if (ruta.startsWith('/mi-espacio/resumen')) {
      r.data.sin_saldos = {
        encabezado: persona === 'planta' ? 'Miércoles 4 de noviembre, planta permanente' : 'Miércoles 4 de noviembre, contrato',
        saludo: `Hola, ${usuario.nombre_completo.split(' ')[0]}`,
        texto: 'Para usar todas las funcionalidades de Mi espacio, primero tenés que cargar tus saldos. Mientras tanto, podés usar la Agenda.'
      };
    }
    if (ruta.startsWith('/mi-espacio/licencias')) r.data.sin_saldos = { texto: AVISO.licencias };
    if (ruta.startsWith('/mi-espacio/horas-extras')) r.data.sin_saldos = { texto: AVISO.horas };
    return r;
  };

  const original = window.fetch.bind(window);
  window.fetch = async (url, opciones = {}) => {
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return original(url, opciones);
    u.searchParams.delete('_t');
    const ruta = u.pathname.slice(4) + u.search;
    const metodo = (opciones.method || 'GET').toUpperCase();
    await espera(metodo === 'GET' ? 80 : 180);

    if (metodo === 'GET') {
      if (ruta === '/auth/verify') return respuesta(200, { success: true, data: { user: usuario } });
      if (ruta === '/cambios-pendientes/contador') return respuesta(200, { success: true, data: { total: 0, count: 0 } });
      const guardada = D[MQ.estado][`GET ${ruta}`];
      if (guardada) return respuesta(guardada.status, conLaPropuesta(ruta, guardada.json));
      if (ruta.startsWith('/mi-espacio/saldo-inicial')) return respuesta(200, D.saldo.json);
      if (ruta.startsWith('/mi-espacio/anio/')) return respuesta(200, D.anio.json);
      if (ruta.startsWith('/mi-espacio/firmante')) return respuesta(200, { success: true, data: { soy_titular: false, soy_autorizado: false } });
      if (ruta.startsWith('/mi-espacio/eventos')) {
        return respuesta(200, { success: true, data: { desde: '', hasta: '', hoy: '2026-11-04', puede_compartir: true, mi_nombre_corto: usuario.nombre_completo.split(' ')[0], eventos: [], licencias: [], feriados: [], ausentes: [], companeros_por_dia: [], frase_del_mes: null } });
      }
      if (ruta.startsWith('/mi-espacio/ausentes')) return respuesta(200, { success: true, data: { puede_ver: true, ausentes: [] } });
      if (ruta.startsWith('/mi-espacio/personas')) return respuesta(200, { success: true, data: [] });
      if (ruta.startsWith('/usuarios/licencias/sin-auditor')) return respuesta(200, { success: true, data: { periodos: [] } });
      console.warn('MAQUETA: sin respuesta guardada para', metodo, ruta);
      return respuesta(200, { success: true, data: null });
    }
    if (metodo === 'PUT' && ruta.startsWith('/mi-espacio/anio/')) return respuesta(200, { success: true, data: {}, message: 'Guardado.' });
    if (metodo === 'PUT' && ruta === '/mi-espacio/saldo-inicial') {
      MQ.estado = 'completo';
      window.MQ.alCambiar?.();
      return respuesta(200, { success: true, data: { arranque: '2026-11-04' }, message: 'Saldo inicial guardado.' });
    }
    return respuesta(400, { success: false, error: '(Maqueta) Esto no se guarda en la maqueta.' });
  };
})();
