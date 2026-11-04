// MAQUETA (04/11/2026), sin servidor. Las personas son inventadas y no se guarda nada en ningún lado: solo en esta pestaña.
window.MAQUETA = {
  PERSONAS: [
    { id: 1, username: 'frios', nombre_completo: 'Federico Ríos', corto: 'Federico', email: 'frios@ejemplo.test', rol: 'superadmin', cargo: 'Director de Datos', vinculo: 'planta_politica', depende: 3 },
    { id: 2, username: 'mojeda', nombre_completo: 'Micaela Ojeda', corto: 'Micaela', email: 'mojeda@ejemplo.test', rol: 'editor', cargo: 'Analista de datos', vinculo: 'contrato', depende: 1 },
    { id: 3, username: 'gpaz', nombre_completo: 'Graciela Paz', corto: 'Graciela', email: 'gpaz@ejemplo.test', rol: 'admin', cargo: 'Directora General', vinculo: 'planta_politica', depende: null },
    { id: 4, username: 'lortiz', nombre_completo: 'Lucía Ortiz', corto: 'Lucía', email: 'lortiz@ejemplo.test', rol: 'colaborador', cargo: 'Administrativa', vinculo: 'planta_permanente', depende: 3 },
    { id: 5, username: 'tvera', nombre_completo: 'Tomás Vera', corto: 'Tomás', email: 'tvera@ejemplo.test', rol: 'lector', cargo: 'Técnico', vinculo: 'contrato', depende: 3 },
    { id: 6, username: 'jferreyra', nombre_completo: 'Julieta Ferreyra', corto: 'Julieta', email: 'jferreyra@ejemplo.test', rol: 'lector', cargo: 'Administrativa', vinculo: 'planta_permanente', depende: 3 },
    { id: 7, username: 'nsoria', nombre_completo: 'Nadia Soria', corto: 'Nadia', email: 'nsoria@ejemplo.test', rol: 'lector', cargo: 'Técnica', vinculo: 'contrato', depende: 3 }
  ],
  leer(clave, porDefecto) { try { return sessionStorage.getItem(clave) ?? porDefecto; } catch { return porDefecto; } },
  guardar(clave, valor) { try { sessionStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ } },
  sesion(usuario) {
    const payload = btoa(JSON.stringify({ userId: usuario.id, rol: usuario.rol, exp: 4102444800 })).replace(/=+$/, '');
    localStorage.setItem('rpad_token', `maqueta.${payload}.firma`);
    localStorage.setItem('rpad_user', JSON.stringify(usuario));
  },
  respuesta: (status, json) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } }),
  espera: (ms) => new Promise((r) => { setTimeout(r, ms); }),
  // El panel amarillo para recorrer la maqueta
  panel(pagina, extras = '') {
    const div = document.createElement('div');
    div.className = 'mq-panel';
    const enlace = (href, texto, id) => `<a href="${href}"${id === pagina ? ' aria-current="page"' : ''}>${texto}</a>`;
    div.innerHTML = `<b>MAQUETA · datos inventados</b><button type="button" class="mq-plegar" aria-label="Plegar o desplegar">–</button>
      ${enlace('mi-espacio.html#agenda', 'Agenda y formulario', 'agenda')}
      ${enlace('configuracion.html#usuarios', 'Usuarios: «Depende de»', 'usuarios')}
      ${enlace('mails.html', 'Los mails de la agenda', 'mails')}${extras}`;
    div.querySelector('.mq-plegar').addEventListener('click', () => div.classList.toggle('plegado'));
    document.body.appendChild(div);
    return div;
  }
};
