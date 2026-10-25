// Servidor de mentira de la maqueta: responde los fetch de /api con datos inventados (usuarios y licencias) y con las
// áreas de maqueta-areas-datos.js. Guarda los cambios en memoria: al recargar, vuelve todo como estaba.
(() => {
  const HOY = '2026-10-24';
  const parametros = new URLSearchParams(window.location.search);
  const ROL = ['superadmin', 'admin', 'editor'].includes(parametros.get('rol')) ? parametros.get('rol') : 'superadmin';

  const persona = (id, nombre_completo, username, rol, extra = {}) => ({
    id, username, nombre_completo, email: `${username.toLowerCase()}@ejemplo.gob.ar`, email_valido: true, rol,
    cargo: null, vinculo: null, estado: 'activo', ultimo_ingreso: '2026-10-23 09:12:00', invitacion_vence: null,
    cambios_pendientes_propuestos: 0, created_at: '2026-01-26 10:00:00', licencia: null, ...extra
  });
  const usuarios = [
    persona(1, 'Laura Méndez', 'LMENDEZ', 'superadmin', { cargo: 'Directora de Datos Públicos y Comunicación', vinculo: 'planta_politica' }),
    persona(2, 'Martín Quiroga', 'MQUIROGA', 'admin', { cargo: 'Jefe de Departamento de Datos', vinculo: 'planta_permanente' }),
    persona(3, 'Sofía Benítez', 'SBENITEZ', 'admin', { cargo: 'Analista de datos', vinculo: 'contrato',
      licencia: { desde: '2026-10-20', hasta: '2026-10-30', en_curso: true } }),
    persona(4, 'Diego Acosta', 'DACOSTA', 'editor', { cargo: 'Técnico en datos abiertos', cambios_pendientes_propuestos: 1 }),
    persona(5, 'Paula Ríos', 'PRIOS', 'editor', { ultimo_ingreso: '2026-10-21 15:40:00' }),
    persona(6, 'Carla Ferreyra', 'CFERREYRA', 'colaborador', { cargo: 'Directora General de Modernización e Investigación Territorial' }),
    persona(7, 'Jorge Ibáñez', 'JIBANEZ', 'lector', { cargo: 'Dirección Administrativa' }),
    persona(8, 'Valeria Sosa', 'VSOSA', 'lector', { ultimo_ingreso: null }),
    persona(9, 'Ramiro Paz', 'RPAZ', 'lector', { estado: 'invitacion_pendiente', ultimo_ingreso: null, invitacion_vence: '2026-10-31 10:00:00' }),
    persona(10, 'Ernesto Vidal', 'EVIDAL', 'lector', { estado: 'desactivado', ultimo_ingreso: '2026-05-02 11:00:00' })
  ];
  const yo = usuarios.find(u => u.rol === ROL);
  const licencias = [
    { id: 1, usuario_id: 3, desde: '2026-10-20', hasta: '2026-10-30', autorizado_id: null, autorizado_at: null, anulada: false, creado_por: 1,
      usuario_nombre: 'Sofía Benítez', usuario_username: 'SBENITEZ', usuario_rol: 'admin', autorizado_nombre: null,
      creado_por_nombre: 'Laura Méndez', estado: 'en_curso', vispera: null },
    { id: 2, usuario_id: 1, desde: '2026-12-28', hasta: '2027-01-15', autorizado_id: 2, autorizado_at: '2026-10-22 12:30', anulada: false, creado_por: 1,
      usuario_nombre: 'Laura Méndez', usuario_username: 'LMENDEZ', usuario_rol: 'superadmin', autorizado_nombre: 'Martín Quiroga',
      creado_por_nombre: 'Laura Méndez', estado: 'futura', vispera: '2026-12-24' }
  ];
  const pasadas = [
    { id: 3, usuario_id: 2, desde: '2026-07-13', hasta: '2026-07-24', autorizado_id: null, autorizado_at: null, anulada: false, creado_por: 1,
      usuario_nombre: 'Martín Quiroga', usuario_username: 'MQUIROGA', usuario_rol: 'admin', autorizado_nombre: null,
      creado_por_nombre: 'Laura Méndez', estado: 'pasada', vispera: null }
  ];
  const historial = [
    { accion: 'alta', detalle: { rol: 'lector' }, actor_id: 1, actor_nombre: 'Laura Méndez', actor_username: 'LMENDEZ', created_at: '2026-01-26 10:00:00' },
    { accion: 'invitacion_enviada', detalle: { email_enviado: true }, actor_id: 1, actor_nombre: 'Laura Méndez', actor_username: 'LMENDEZ', created_at: '2026-01-26 10:01:00' }
  ];
  const areas = AREAS_MAQUETA.map(a => ({ ...a }));

  // La sesión de la maqueta: un token con vencimiento lejano (auth.js solo lee "exp") y la persona del rol elegido
  localStorage.setItem('rpad_token', `maqueta.${btoa(JSON.stringify({ exp: 4102444800 }))}.maqueta`);
  localStorage.setItem('rpad_user', JSON.stringify({ id: yo.id, username: yo.username, nombre_completo: yo.nombre_completo, rol: yo.rol, cargo: yo.cargo }));

  const responder = (status, cuerpo) => new Promise(resolver => setTimeout(() => resolver(new Response(JSON.stringify(cuerpo), {
    status, headers: { 'Content-Type': 'application/json' }
  })), 180));
  const aprobadores = () => usuarios.filter(u => ['superadmin', 'admin'].includes(u.rol) && u.estado === 'activo').length;
  const sinBlancos = (v) => (typeof v === 'string' ? v.trim() : v);

  // Las reglas de la entrega nueva (spec, sección 6): nombre obligatorio, sin repetir; borrar solo un área sin ningún dataset
  const validarArea = (datos, id) => {
    const nombre = sinBlancos(datos.nombre ?? '');
    if (!nombre) return [400, 'Escribí el nombre del área.', 'nombre'];
    const repetida = areas.find(a => a.id !== id && a.nombre.toLowerCase() === nombre.toLowerCase());
    if (repetida) return [409, 'Ya hay un área con ese nombre.', 'nombre'];
    for (const campo of ['email_principal', 'email_secundario', 'email_contacto']) {
      const valor = sinBlancos(datos[campo] ?? '');
      if (valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return [400, 'Revisá el email: no parece una dirección válida.', campo];
    }
    return null;
  };

  window.fetch = async (url, opciones = {}) => {
    const ruta = String(url).replace(/^.*\/api/, '').split('?')[0];
    const consulta = new URLSearchParams(String(url).split('?')[1] || '');
    const metodo = (opciones.method || 'GET').toUpperCase();
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : {};
    let m;

    if (ruta === '/auth/verify') return responder(200, { success: true, data: { user: JSON.parse(localStorage.getItem('rpad_user')) } });
    if (ruta === '/cambios-pendientes/contador') return responder(200, { success: true, data: { cantidad: 1 }, cantidad: 1 });

    // Usuarios
    if (ruta === '/usuarios' && metodo === 'GET') {
      return responder(200, { success: true, data: { usuarios, resumen: { aprobadores_activos: aprobadores(), minimo: 2 } } });
    }
    if (ruta === '/usuarios/licencias' && metodo === 'GET') {
      const todas = consulta.get('incluir_pasadas') === '1';
      return responder(200, { success: true, data: {
        hoy: HOY, firmante_titular_id: 1, soy_titular: yo.id === 1,
        licencias: todas ? [...licencias, ...pasadas] : licencias,
        usuarios: usuarios.filter(u => ['superadmin', 'admin', 'editor'].includes(u.rol) && u.estado !== 'desactivado')
          .map(u => ({ id: u.id, nombre_completo: u.nombre_completo, rol: u.rol })),
        autorizables: yo.id === 1 ? [{ id: 2, nombre_completo: 'Martín Quiroga', licencias: [] }, { id: 4, nombre_completo: 'Diego Acosta', licencias: [] }] : []
      } });
    }
    if (ruta === '/usuarios/licencias/sin-auditor') return responder(200, { success: true, data: { periodos: [] } });
    if ((m = ruta.match(/^\/usuarios\/(\d+)$/)) && metodo === 'GET') {
      const u = usuarios.find(x => x.id === Number(m[1]));
      return responder(u ? 200 : 404, u ? { success: true, data: { ...u, historial } } : { success: false, error: 'Usuario no encontrado' });
    }
    if (ruta.startsWith('/usuarios')) return responder(200, { success: true, data: {}, message: 'En la maqueta no se guarda: es de muestra.' });

    // Áreas: la lista completa la ve solo administración (spec, sección 6)
    if (ruta === '/areas' && metodo === 'GET') return responder(200, { success: true, data: areas });
    if (ruta === '/areas' && metodo === 'POST') {
      const rechazo = validarArea(cuerpo, 0);
      if (rechazo) return responder(rechazo[0], { success: false, error: rechazo[1], campo: rechazo[2] });
      const nueva = { ...cuerpo, nombre: sinBlancos(cuerpo.nombre), id: Math.max(...areas.map(a => a.id)) + 1, cantidad_datasets: 0, datasets_dados_de_baja: 0, externos_con_nota: 0 };
      areas.push(nueva);
      return responder(201, { success: true, data: nueva, message: 'Área creada' });
    }
    if ((m = ruta.match(/^\/areas\/(\d+)$/))) {
      const area = areas.find(a => a.id === Number(m[1]));
      if (!area) return responder(404, { success: false, error: 'Área no encontrada' });
      if (metodo === 'PUT') {
        const rechazo = validarArea({ ...area, ...cuerpo }, area.id);
        if (rechazo) return responder(rechazo[0], { success: false, error: rechazo[1], campo: rechazo[2] });
        Object.assign(area, cuerpo, { nombre: sinBlancos(cuerpo.nombre ?? area.nombre) });
        return responder(200, { success: true, data: area, message: 'Área actualizada' });
      }
      if (metodo === 'DELETE') {
        const total = area.cantidad_datasets + area.datasets_dados_de_baja;
        if (total > 0) return responder(409, { success: false, error: `No se puede borrar: tiene ${total} datasets.` });
        areas.splice(areas.indexOf(area), 1);
        return responder(200, { success: true, message: 'Área borrada' });
      }
    }
    return responder(404, { success: false, error: 'Ruta no encontrada (maqueta)' });
  };
})();
