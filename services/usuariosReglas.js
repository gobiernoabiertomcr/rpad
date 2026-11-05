// Reglas de usuarios y roles (spec 2026-10-15-usuarios-superadmin): funciones puras, sin base de datos

export const ROLES_ASIGNABLES = ['admin', 'editor', 'colaborador', 'lector'];
export const VINCULOS = ['planta_permanente', 'planta_politica', 'contrato'];
export const MINIMO_APROBADORES = 2;
export const TEXTO_ROL = {
  superadmin: 'Superadmin', admin: 'Administrador', editor: 'Editor', colaborador: 'Colaborador', lector: 'Lector'
};

export const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_USERNAME = /^[A-Z0-9._-]{3,50}$/;

// superadmin, admin y editor pasan todo lo de administración (spec 5.3; el editor, spec 2026-10-15, 8.1)
export const esAdmin = (rol) => rol === 'admin' || rol === 'superadmin' || rol === 'editor';

// Auditor: aprueba y rechaza cambios de otros y cuenta para el mínimo de aprobadores
// (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1). El editor no lo es: audita solo de respaldo.
export const esAuditor = (rol) => rol === 'admin' || rol === 'superadmin';

// Quién carga notas DGMIT: administración y el colaborador, que no es de administración ni audita
// (spec 2026-10-24-notas-dgmit, 1)
export const puedeCargarNotasDgmit = (rol) => esAdmin(rol) || rol === 'colaborador';

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

// De quién depende cada uno (spec 2026-11-04-agenda-aviso-y-dependencia, 3 y 5.1), sobre filas `{ id, activo, depende_de }`: nada más
// recorre la cadena, y por eso lo demás se arma con estas funciones. No se le puede cargar a alguien a sí mismo ni a quien ya depende de
// esa persona, pero los datos podrían venir mal: todas se cortan ante un ciclo
export const MENSAJES_DEPENDENCIA = Object.freeze({
  invalida: 'Elegí una persona de la lista.',
  ellaMisma: 'No puede depender de sí misma.',
  ciclo: 'Esa persona ya depende de quien estás editando.'
});
const estaActiva = (fila) => fila.activo === true || Number(fila.activo) === 1;
const porId = (usuarios) => new Map((Array.isArray(usuarios) ? usuarios : []).map((fila) => [Number(fila.id), fila]));
const idDelSuperior = (fila) => (fila.depende_de === null || fila.depende_de === undefined ? null : Number(fila.depende_de));

/**
 * Las personas activas de las que depende alguien, de la más cercana a la más lejana. Sube por `depende_de`, salta a las desactivadas
 * sin cortar la cadena (lo suyo sube a la siguiente) y nunca incluye a la persona, ni repite. Con un id que no está, [].
 */
export const superioresDe = (id, usuarios) => {
  const filas = porId(usuarios);
  const inicio = Number(id);
  const vistos = new Set([inicio]);
  const superiores = [];
  let actual = filas.get(inicio);
  while (actual) {
    const siguiente = idDelSuperior(actual);
    if (siguiente === null || vistos.has(siguiente)) break;
    vistos.add(siguiente);
    actual = filas.get(siguiente);
    if (actual && estaActiva(actual)) superiores.push(actual);
  }
  return superiores;
};

/** Todas las personas que dependen de alguien, directa o indirectamente, también las desactivadas, y sin la persona misma. */
export const quienesDependenDe = (id, usuarios) => {
  const filas = [...porId(usuarios).values()];
  const inicio = Number(id);
  const vistos = new Set([inicio]);
  const dependen = [];
  const pendientes = [inicio];
  while (pendientes.length > 0) {
    const actual = pendientes.pop();
    for (const fila of filas) {
      if (idDelSuperior(fila) === actual && !vistos.has(Number(fila.id))) {
        vistos.add(Number(fila.id));
        dependen.push(fila);
        pendientes.push(Number(fila.id));
      }
    }
  }
  return dependen;
};

/**
 * El mensaje de por qué alguien no puede depender de `dependeDe`, o null. `id`: quien se edita (null en un alta); `antes`: de quién
 * dependía. Se elige a una persona activa o se deja la que ya estaba, aunque se haya desactivado: guardar sin tocarla no da error.
 */
export const rechazoDeDependencia = ({ id = null, dependeDe, antes = null, usuarios }) => {
  if (dependeDe === null || dependeDe === undefined) return null;
  if (id !== null && dependeDe === id) return MENSAJES_DEPENDENCIA.ellaMisma;
  const fila = porId(usuarios).get(dependeDe);
  if (!fila) return MENSAJES_DEPENDENCIA.invalida;
  if (!estaActiva(fila) && dependeDe !== antes) return MENSAJES_DEPENDENCIA.invalida;
  if (id !== null && quienesDependenDe(id, usuarios).some((persona) => Number(persona.id) === dependeDe)) return MENSAJES_DEPENDENCIA.ciclo;
  return null;
};

/**
 * Lo que el panel muestra de la cadena de alguien (spec, sección 3: el navegador no la recorre). `usuarios` también trae `nombre_completo`:
 * el nombre de quien depende; los ids que no se le pueden ofrecer (la persona y quienes dependen de ella); y, para confirmar al
 * desactivarla, quiénes dependen directamente de ella y están activos, y a quién le va a llegar lo de ellos.
 */
export const dependenciaDe = (id, usuarios) => {
  const filas = porId(usuarios);
  const fila = filas.get(Number(id));
  const superior = fila && idDelSuperior(fila) !== null ? filas.get(idDelSuperior(fila)) : undefined;
  const directas = [...filas.values()].filter((otra) => idDelSuperior(otra) === Number(id) && Number(otra.id) !== Number(id) && estaActiva(otra));
  return {
    depende_de_nombre: superior?.nombre_completo ?? null,
    no_elegibles: [Number(id), ...quienesDependenDe(id, usuarios).map((persona) => Number(persona.id))],
    al_desactivar: {
      dependen: directas.map((persona) => persona.nombre_completo),
      suben_a: superioresDe(id, usuarios)[0]?.nombre_completo ?? null
    }
  };
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
    if (!ROLES_ASIGNABLES.includes(entrada.rol)) error('rol', 'El rol debe ser admin, editor, colaborador o lector');
    else datos.rol = entrada.rol;
  }
  if (viene('depende_de')) {
    const dependeDe = entrada.depende_de === '' ? null : entrada.depende_de;
    if (dependeDe !== null && !(Number.isInteger(dependeDe) && dependeDe > 0)) error('depende_de', MENSAJES_DEPENDENCIA.invalida);
    else datos.depende_de = dependeDe;
  }
  return { errores, datos };
};

// Campos que vienen y cambian, con el valor anterior y el nuevo (para el historial, spec 9)
export const camposCambiados = (antes, nuevos, campos) => Object.fromEntries(campos
  .filter(campo => nuevos[campo] !== undefined && (antes[campo] ?? null) !== (nuevos[campo] ?? null))
  .map(campo => [campo, { antes: antes[campo] ?? null, despues: nuevos[campo] ?? null }]));

// Lo que el editor no puede hacer en el panel (spec 2026-10-15-dias-habiles-licencias-auditoria, 8.1; el colaborador,
// spec 2026-10-24-notas-dgmit, 1)
export const ROLES_DEL_EDITOR = ['lector', 'colaborador'];
export const MENSAJE_EDITOR_SOLO_LECTORES = 'Un editor solo puede crear y modificar usuarios lectores y colaboradores.';
export const MENSAJE_EDITOR_SIN_ROLES = 'Un editor no puede cambiar roles.';

/**
 * Motivo del 403 si un editor no puede hacer la operación, o null. objetivo: el rol del usuario afectado (en el alta, el
 * rol pedido); rolNuevo: el rol al que lo pasa el pedido, o null si no se lo cambia. El editor solo crea, edita, activa,
 * desactiva y envía links a lectores y colaboradores, y solo pasa a alguien de lector a colaborador o al revés (nunca
 * cambia el suyo): cambiándole el email y enviándole un link a otro editor podría quedarse con su cuenta.
 */
export const rechazoParaEditor = ({ objetivo, rolNuevo = null }) => {
  if (!ROLES_DEL_EDITOR.includes(objetivo)) return MENSAJE_EDITOR_SOLO_LECTORES;
  if (rolNuevo !== null && !ROLES_DEL_EDITOR.includes(rolNuevo)) return MENSAJE_EDITOR_SIN_ROLES;
  return null;
};
