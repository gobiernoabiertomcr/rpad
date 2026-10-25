// Servidor de mentira de la maqueta: deja una sesión inventada con el rol de ?rol= y responde los fetch de /api que hace la
// carcasa (verificar la sesión, el contador de la campana). No guarda nada.
(() => {
  const ROLES = { admin: 'Laura Méndez', lector: 'Jorge Ibáñez', colaborador: 'Carla Ferreyra' };
  const parametros = new URLSearchParams(window.location.search);
  const rol = ROLES[parametros.get('rol')] ? parametros.get('rol') : 'admin';
  const usuario = { id: 1, username: 'MAQUETA', nombre_completo: ROLES[rol], email: 'maqueta@ejemplo.gob.ar', rol, cargo: null, vinculo: null };
  // Un token con vencimiento en 2100: auth.js solo mira el exp
  const token = `e30.${btoa(JSON.stringify({ exp: 4102444800 }))}.maqueta`;
  localStorage.setItem('rpad_token', token);
  localStorage.setItem('rpad_user', JSON.stringify(usuario));
  const respuesta = (data) => Promise.resolve(new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (url, opciones) => {
    const texto = String(url);
    if (texto.includes('/auth/verify')) return respuesta({ user: usuario });
    if (texto.includes('/cambios-pendientes/contador')) return respuesta({ cantidad: 0 });
    if (texto.includes('/api/')) return respuesta(null);
    return fetchOriginal(url, opciones);
  };
})();
