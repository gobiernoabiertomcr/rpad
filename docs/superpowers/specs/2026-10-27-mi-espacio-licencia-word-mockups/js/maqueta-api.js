// MAQUETA (27/10/2026), sin servidor: una sesión de prueba y las respuestas de la API real de la rama, guardadas en datos.js
// (copia de la base con datos inventados). Va antes que config.js.
(function () {
  const D = window.MAQUETA_DATOS;
  const usuario = D.fijos['GET /auth/verify'].json.data.user;
  const payload = btoa(JSON.stringify({ userId: usuario.id, rol: usuario.rol, exp: 4102444800 })).replace(/=+$/, '');
  localStorage.setItem('rpad_token', `maqueta.${payload}.firma`);
  localStorage.setItem('rpad_user', JSON.stringify(usuario));

  const estado = { escenario: null };
  window.MAQUETA_ESTADO = estado;
  const espera = (ms) => new Promise((resolver) => { setTimeout(resolver, ms); });
  const respuesta = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });
  const claveDe = (c) => [c.tipo, c.desde, c.hasta, c.horas ?? '', c.id ?? ''].join('|');

  // Los escenarios de «Cargar licencia»: al elegir un tipo en un alta, la maqueta pone las fechas del ejemplo guardado
  window.MAQUETA_ESCENARIOS = Object.fromEntries(Object.entries(D.escenarios).map(([tipo, e]) => [tipo, e.cuerpo]));

  const original = window.fetch.bind(window);
  window.fetch = async (url, opciones = {}) => {
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return original(url, opciones);
    u.searchParams.delete('_t');
    const ruta = u.pathname.slice(4) + u.search;
    const metodo = (opciones.method || 'GET').toUpperCase();
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    await espera(metodo === 'GET' ? 120 : 260);

    if (metodo === 'GET') {
      const despues = estado.escenario && D.escenarios[estado.escenario]?.despues[`GET ${ruta}`];
      const guardada = despues || D.fijos[`GET ${ruta}`];
      if (guardada) return respuesta(guardada.status, guardada.json);
      if (ruta.startsWith('/mi-espacio/eventos')) return respuesta(200, { success: true, data: { eventos: [], feriados: [] } });
      console.warn('MAQUETA: sin respuesta guardada para', metodo, ruta);
      return respuesta(200, { success: true, data: null });
    }
    if (ruta === '/mi-espacio/licencias/calculo') {
      const exacto = D.calculos[claveDe(cuerpo)];
      const delTipo = Object.entries(D.calculos).find(([clave]) => clave.startsWith(`${cuerpo.tipo}|`))?.[1];
      return respuesta(200, exacto ?? delTipo ?? { success: true, data: { error: null, vista: null, paso: null } });
    }
    if (metodo === 'POST' && ruta === '/mi-espacio/licencias') {
      const e = D.escenarios[cuerpo.tipo];
      if (!e) return respuesta(400, { success: false, error: '(maqueta) Este tipo no tiene ejemplo guardado.' });
      estado.escenario = cuerpo.tipo;
      return respuesta(201, e.alta.json);
    }
    if (metodo === 'PUT' && ruta.startsWith('/mi-espacio/licencias/')) {
      return respuesta(200, { success: true, data: { id: Number(ruta.split('/').pop()) }, message: 'Licencia corregida.', avisos: [] });
    }
    if (metodo === 'DELETE' && ruta.startsWith('/mi-espacio/licencias/')) {
      return respuesta(200, { success: true, message: '(maqueta) No se borra nada.' });
    }
    console.warn('MAQUETA: sin respuesta para', metodo, ruta);
    return respuesta(400, { success: false, error: '(maqueta) Esto no se guarda en la maqueta.' });
  };
})();
