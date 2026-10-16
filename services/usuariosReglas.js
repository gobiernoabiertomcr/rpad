// Reglas de usuarios y roles (spec 2026-10-15-usuarios-superadmin): funciones puras, sin base de datos

export const ROLES_ASIGNABLES = ['admin', 'editor', 'lector'];
export const VINCULOS = ['planta_permanente', 'planta_politica', 'contrato'];
export const MINIMO_APROBADORES = 2;
export const TEXTO_ROL = { superadmin: 'Superadmin', admin: 'Administrador', editor: 'Editor', lector: 'Lector' };

const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_USERNAME = /^[A-Z0-9._-]{3,50}$/;

// superadmin, admin y editor pasan todo lo de administración (spec 5.3; el editor, spec 2026-10-15, 8.1)
export const esAdmin = (rol) => rol === 'admin' || rol === 'superadmin' || rol === 'editor';

// Auditor: aprueba y rechaza cambios de otros y cuenta para el mínimo de aprobadores
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1). El editor no lo es: audita solo de respaldo.
export const esAuditor = (rol) => rol === 'admin' || rol === 'superadmin';

// Estado derivado (spec 3): no se guarda, sale de activo y de si tiene contraseña
export const estadoDeUsuario = ({ activo, tiene_contrasena }) => {
  if (!activo) return 'desactivado';
  return tiene_contrasena ? 'activo' : 'invitacion_pendiente';
};

// Cuenta para el mínimo de aprobadores: auditor (superadmin o admin), activo y con contraseña definida (spec 3; el editor
// no cuenta, spec 2026-10-15, 8.3)
export const esAprobadorActivo = (usuario) =>
  esAuditor(usuario.rol) && Boolean(usuario.activo) && Boolean(usuario.tiene_contrasena);

/**
 * ¿La operación deja menos de MINIMO_APROBADORES? (spec 8.1). Solo bloquea si la operación saca a un
 * aprobador: con un único admin se pueden seguir desactivando lectores.
 * usuarios: [{ id, rol, activo, tiene_contrasena }]; cambio: lo que se aplica al usuario id ({ activo: 0 } o { rol: 'lector' })
 */
export const violaMinimoAprobadores = (usuarios, id, cambio) => {
  const antes = usuarios.filter(esAprobadorActivo).length;
  const despues = usuarios.map(u => (u.id === id ? { ...u, ...cambio } : u)).filter(esAprobadorActivo).length;
  return despues < antes && despues < MINIMO_APROBADORES;
};

export const emailValido = (email) => typeof email === 'string' && email.length <= 100 && PATRON_EMAIL.test(email);

// null si la contraseña sirve; si no, el motivo (spec 7.4: mínimo 8 caracteres, máximo 72 bytes por bcrypt)
export const validarContrasena = (password) => {
  if (typeof password !== 'string' || password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return 'La contraseña es demasiado larga: admite hasta 72 bytes (unos 72 caracteres sin tildes)';
  }
  return null;
};

/**
 * Normaliza y valida los datos del formulario del panel (spec 8.3).
 * parcial: en la edición, los campos que no vienen no se validan ni se tocan.
 * Devuelve { errores: [{ campo, error }], datos } con los valores ya normalizados.
 */
export const validarDatosUsuario = (entrada, { parcial = false } = {}) => {
  const errores = [];
  const datos = {};
  const viene = (campo) => entrada[campo] !== undefined;
  const error = (campo, mensaje) => errores.push({ campo, error: mensaje });

  if (!parcial || viene('nombre_completo')) {
    const nombre = String(entrada.nombre_completo ?? '').trim();
    if (!nombre) error('nombre_completo', 'El nombre completo es obligatorio');
    else if (nombre.length > 100) error('nombre_completo', 'El nombre completo admite hasta 100 caracteres');
    else datos.nombre_completo = nombre;
  }
  if (!parcial || viene('username')) {
    const username = String(entrada.username ?? '').trim().toUpperCase();
    if (!PATRON_USERNAME.test(username)) {
      error('username', 'El usuario debe tener de 3 a 50 caracteres: letras sin tildes ni ñ, números, punto, guion o guion bajo');
    } else datos.username = username;
  }
  if (!parcial || viene('email')) {
    const email = String(entrada.email ?? '').trim().toLowerCase();
    if (!emailValido(email)) error('email', 'Ingresá un email válido');
    else datos.email = email;
  }
  if (viene('cargo')) {
    const cargo = String(entrada.cargo ?? '').trim();
    if (cargo.length > 200) error('cargo', 'El cargo admite hasta 200 caracteres');
    else datos.cargo = cargo || null;
  }
  if (viene('vinculo')) {
    const vinculo = entrada.vinculo === '' || entrada.vinculo === null ? null : entrada.vinculo;
    if (vinculo !== null && !VINCULOS.includes(vinculo)) error('vinculo', 'El vínculo no es válido');
    else datos.vinculo = vinculo;
  }
  if (!parcial || viene('rol')) {
    if (!ROLES_ASIGNABLES.includes(entrada.rol)) error('rol', 'El rol debe ser admin, editor o lector');
    else datos.rol = entrada.rol;
  }
  return { errores, datos };
};

// Campos que vienen y cambian, con el valor anterior y el nuevo (para el historial, spec 9)
export const camposCambiados = (antes, nuevos, campos) => Object.fromEntries(campos
  .filter(campo => nuevos[campo] !== undefined && (antes[campo] ?? null) !== (nuevos[campo] ?? null))
  .map(campo => [campo, { antes: antes[campo] ?? null, despues: nuevos[campo] ?? null }]));

// Lo que el editor no puede hacer en el panel (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1)
export const MENSAJE_EDITOR_SOLO_LECTORES = 'Un editor solo puede crear y modificar usuarios lectores.';
export const MENSAJE_EDITOR_SIN_ROLES = 'Un editor no puede cambiar roles.';

/**
 * Motivo del 403 si un editor no puede hacer la operación, o null. objetivo: el rol del usuario afectado (en el alta, el
 * rol pedido); cambiaRol: si el pedido le cambia el rol. El editor solo crea, edita, activa, desactiva y envía links a
 * lectores, y no cambia roles (tampoco el suyo): cambiándole el email y enviándole un link a otro editor podría quedarse
 * con su cuenta.
 */
export const rechazoParaEditor = ({ objetivo, cambiaRol = false }) => {
  if (objetivo !== 'lector') return MENSAJE_EDITOR_SOLO_LECTORES;
  if (cambiaRol) return MENSAJE_EDITOR_SIN_ROLES;
  return null;
};
