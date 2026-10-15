// Elegir contraseña con un link de acceso, o pedir uno nuevo (spec 12.3).
// El token llega en el fragmento (#token=…), que no se envía al servidor, y se manda en el body de un POST.
const MENSAJE_MOTIVO = {
  vencido: 'El link venció. Pedí uno nuevo con tu usuario o tu email.',
  usado: 'Este link ya se usó. Si necesitás otro, pedilo con tu usuario o tu email.',
  invalido: 'El link no es válido. Pedí uno nuevo con tu usuario o tu email.'
};
const SECCIONES = ['seccion-cargando', 'seccion-elegir', 'seccion-pedir', 'seccion-enviado'];
let token = null;

const mostrar = (id) => SECCIONES.forEach(seccion => { document.getElementById(seccion).hidden = seccion !== id; });

const alerta = (id, texto) => {
  const caja = document.getElementById(id);
  caja.textContent = texto || '';
  caja.hidden = !texto;
};

const postJson = async (ruta, body) => {
  const response = await fetch(`${CONFIG.API_URL}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
};

const mostrarPedir = (motivo) => {
  alerta('alerta-pedir', motivo);
  mostrar('seccion-pedir');
  document.getElementById('identificador').focus();
};

document.addEventListener('DOMContentLoaded', async () => {
  token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  // El token no queda en la barra de direcciones ni en el historial del navegador
  if (window.location.hash) history.replaceState(null, '', window.location.pathname);

  document.getElementById('form-elegir').addEventListener('submit', guardarContrasena);
  document.getElementById('form-pedir').addEventListener('submit', pedirLink);

  if (!token) {
    mostrarPedir('');
    return;
  }
  try {
    const { ok, status, data } = await postJson('/auth/link/validar', { token });
    if (!ok) {
      mostrarPedir(status === 429 ? data.error : 'No pudimos verificar el link. Probá de nuevo en unos minutos.');
      return;
    }
    if (!data.data.valido) {
      mostrarPedir(MENSAJE_MOTIVO[data.data.motivo] || MENSAJE_MOTIVO.invalido);
      return;
    }
    document.getElementById('saludo').textContent = `Hola, ${data.data.nombre_completo}.`;
    document.getElementById('subtitulo-elegir').textContent = `Elegí tu contraseña para el usuario ${data.data.username}.`;
    mostrar('seccion-elegir');
    document.getElementById('password').focus();
  } catch {
    mostrarPedir('No hay conexión con el servidor. Probá de nuevo en unos minutos.');
  }
});

async function guardarContrasena(evento) {
  evento.preventDefault();
  const password = document.getElementById('password').value;
  const repetir = document.getElementById('password-repetir').value;
  alerta('alerta-elegir', '');
  if (password.length < 8) return alerta('alerta-elegir', 'La contraseña debe tener al menos 8 caracteres.');
  if (password !== repetir) return alerta('alerta-elegir', 'Las contraseñas no coinciden.');

  const boton = document.getElementById('btn-guardar');
  boton.disabled = true;
  try {
    const { ok, data } = await postJson('/auth/establecer-contrasena', { token, password });
    if (ok) {
      window.location.href = 'login.html?contrasena=ok';
      return;
    }
    if (data.motivo) {
      mostrarPedir(MENSAJE_MOTIVO[data.motivo]);
      return;
    }
    alerta('alerta-elegir', data.error || 'No se pudo guardar la contraseña.');
  } catch {
    alerta('alerta-elegir', 'No hay conexión con el servidor. Probá de nuevo.');
  } finally {
    boton.disabled = false;
  }
}

async function pedirLink(evento) {
  evento.preventDefault();
  const identificador = document.getElementById('identificador').value.trim();
  if (!identificador) return alerta('alerta-pedir', 'Escribí tu usuario o tu email.');

  const boton = document.getElementById('btn-pedir');
  boton.disabled = true;
  try {
    const { ok, data } = await postJson('/auth/recuperar', { identificador });
    if (!ok) return alerta('alerta-pedir', data.error || 'No se pudo enviar el pedido.');
    document.getElementById('texto-enviado').textContent = data.message;
    mostrar('seccion-enviado');
  } catch {
    alerta('alerta-pedir', 'No hay conexión con el servidor. Probá de nuevo.');
  } finally {
    boton.disabled = false;
  }
}
