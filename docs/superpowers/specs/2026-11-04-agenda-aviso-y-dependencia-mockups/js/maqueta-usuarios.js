// MAQUETA: la API de Usuarios y el campo «Depende de». El superadmin ficticio mira el panel.
(function () {
  const M = window.MAQUETA;
  const yo = M.PERSONAS[0];
  M.sesion({ id: yo.id, username: yo.username, nombre_completo: yo.nombre_completo, email: yo.email, rol: yo.rol, vinculo: yo.vinculo, cargo: yo.cargo });
  const leer = () => { try { return JSON.parse(M.leer('mq-usuarios', 'null')) ?? M.PERSONAS; } catch { return M.PERSONAS; } };
  const fila = (p) => ({ ...p, email_valido: true, estado: p.estado ?? 'activo', ultimo_ingreso: '2026-11-04T12:00:00Z', invitacion_vence: null, cambios_pendientes_propuestos: 0, created_at: '2026-01-05T12:00:00Z', licencia: null });
  const original = window.fetch.bind(window);
  window.fetch = async (url, opciones = {}) => {
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return original(url, opciones);
    const ruta = u.pathname.slice(4);
    const metodo = (opciones.method || 'GET').toUpperCase();
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    await M.espera(50);
    if (ruta === '/auth/verify') return M.respuesta(200, { success: true, data: { user: JSON.parse(localStorage.getItem('rpad_user')) } });
    if (ruta === '/cambios-pendientes/contador') return M.respuesta(200, { success: true, data: { cantidad: 0 } });
    if (ruta === '/usuarios' && metodo === 'GET') return M.respuesta(200, { success: true, data: { usuarios: leer().map(fila), resumen: { aprobadores_activos: 2, minimo: 2 } } });
    const m = ruta.match(/^\/usuarios\/(\d+)(\/[a-z-]+)?$/);
    if (m && metodo === 'GET' && !m[2]) return M.respuesta(200, { success: true, data: fila(leer().find((p) => p.id === Number(m[1]))) });
    if (m && metodo === 'GET') return M.respuesta(200, { success: true, data: [] });
    if (m && metodo === 'PUT' && !m[2]) {
      const lista = leer().map((p) => (p.id === Number(m[1]) ? { ...p, ...cuerpo, depende: window.MQU.elegido() } : p));
      M.guardar('mq-usuarios', JSON.stringify(lista));
      return M.respuesta(200, { success: true, message: 'Usuario actualizado.', data: fila(lista.find((p) => p.id === Number(m[1]))) });
    }
    if (m && m[2] === '/desactivar') {
      const lista = leer().map((p) => (p.id === Number(m[1]) ? { ...p, estado: 'desactivado' } : p));
      M.guardar('mq-usuarios', JSON.stringify(lista));
      return M.respuesta(200, { success: true, message: 'Usuario desactivado.' });
    }
    if (m && m[2] === '/reactivar') {
      const lista = leer().map((p) => (p.id === Number(m[1]) ? { ...p, estado: 'activo' } : p));
      M.guardar('mq-usuarios', JSON.stringify(lista));
      return M.respuesta(200, { success: true, message: 'Usuario reactivado.' });
    }
    if (metodo === 'GET') return M.respuesta(200, { success: true, data: ruta.includes('licencias') ? { licencias: [], usuarios: [], periodos: [] } : [] });
    return M.respuesta(400, { success: false, error: '(Maqueta) Esto no se guarda en la maqueta.' });
  };

  const AYUDA = 'A esta persona y a quien esté más arriba les llega por mail el texto corto de los eventos que quien depende de ellas deja a la vista de otros. No ven nada más de su Mi espacio.';
  // Alguien no puede depender de sí mismo ni de quien ya depende de él o ella (un ciclo): esas opciones no se ofrecen
  const debajoDe = (id, usuarios) => {
    const hijos = usuarios.filter((p) => p.depende === id).map((p) => p.id);
    return hijos.flatMap((h) => [h, ...debajoDe(h, usuarios)]);
  };
  window.MQU = {
    elegido: () => { const v = document.getElementById('u-depende').value; return v === '' ? null : Number(v); },
    pintarSelect(u, usuarios) {
      const fuera = new Set(u ? [u.id, ...debajoDe(u.id, usuarios)] : []);
      const opciones = usuarios.filter((p) => !fuera.has(p.id) && p.estado !== 'desactivado');
      const select = document.getElementById('u-depende');
      select.innerHTML = `<option value="">Nadie</option>${opciones.map((p) => `<option value="${p.id}">${Utils.escapeHtml(p.nombre_completo)}</option>`).join('')}`;
      select.value = u?.depende ? String(u.depende) : '';
      document.getElementById('u-depende-ayuda').textContent = AYUDA;
    },
    detalle(u, usuarios) {
      const jefe = usuarios.find((p) => p.id === u.depende);
      return jefe ? `<span class="mq-depende">Depende de ${Utils.escapeHtml(jefe.nombre_completo)}</span>` : '';
    },
    avisoAlDesactivar(u, usuarios) {
      const dependen = usuarios.filter((p) => p.depende === u.id && p.estado !== 'desactivado');
      if (dependen.length === 0) return [];
      const jefe = usuarios.find((p) => p.id === u.depende);
      const nombres = dependen.map((p) => p.nombre_completo).join(', ');
      return [`De esta persona depende: ${nombres}. ${jefe ? `Mientras esté desactivada, lo suyo le va a llegar a ${jefe.nombre_completo}.` : 'Lo suyo no le va a llegar a nadie hasta que le cargues de quién depende.'}`];
    }
  };
})();
