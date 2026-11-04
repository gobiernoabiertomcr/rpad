// MAQUETA (04/11/2026), sin servidor. Las personas son inventadas y no se guarda nada en ningún lado: solo en esta pestaña.
const SVG_MQ = (cuerpo) => `<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
window.MAQUETA = {
  // Lucide: lock, eye y users, los mismos dibujos de la grilla de la agenda
  ICONOS: {
    privado: SVG_MQ('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
    publico: SVG_MQ('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
    laboral: SVG_MQ('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>')
  },
  PERSONAS: [
    { id: 1, username: 'frios', nombre_completo: 'Federico Ríos', corto: 'Federico', email: 'frios@ejemplo.test', rol: 'superadmin', cargo: 'Director de Datos', vinculo: 'planta_politica', depende: 3 },
    { id: 2, username: 'mojeda', nombre_completo: 'Micaela Ojeda', corto: 'Micaela', email: 'mojeda@ejemplo.test', rol: 'editor', cargo: 'Analista de datos', vinculo: 'contrato', depende: 1 },
    { id: 3, username: 'gpaz', nombre_completo: 'Graciela Paz', corto: 'Graciela', email: 'gpaz@ejemplo.test', rol: 'admin', cargo: 'Directora General', vinculo: 'planta_politica', depende: null },
    { id: 4, username: 'lortiz', nombre_completo: 'Lucía Ortiz', corto: 'Lucía', email: 'lortiz@ejemplo.test', rol: 'colaborador', cargo: 'Administrativa', vinculo: 'planta_permanente', depende: 3 },
    { id: 5, username: 'tvera', nombre_completo: 'Tomás Vera', corto: 'Tomás', email: 'tvera@ejemplo.test', rol: 'lector', cargo: 'Técnico', vinculo: 'contrato', depende: 3 },
    { id: 6, username: 'jferreyra', nombre_completo: 'Julieta Ferreyra', corto: 'Julieta', email: 'jferreyra@ejemplo.test', rol: 'lector', cargo: 'Administrativa', vinculo: 'planta_permanente', depende: 3 },
    { id: 7, username: 'nsoria', nombre_completo: 'Nadia Soria', corto: 'Nadia', email: 'nsoria@ejemplo.test', rol: 'lector', cargo: 'Técnica', vinculo: 'contrato', depende: 3 }
  ],
  MAIL: SVG_MQ('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  AGENDA: SVG_MQ('<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>'),
  chips: (personas) => personas.map(([ini, nombre]) => `<span class="mq-jefe"><span class="mq-iniciales" aria-hidden="true">${ini}</span>${nombre}</span>`).join(''),
  // Las cuatro formas de separar el mail de los jefes de lo que se ve en la agenda: lo de arriba, el rótulo y la ayuda de las personas, y el pie
  piezas(opcion, jefes) {
    const uno = jefes.length === 1;
    const chips = this.chips(jefes);
    const mail = `<span class="mq-ico-chico" aria-hidden="true">${this.MAIL}</span>`;
    const agenda = `<span class="mq-ico-chico" aria-hidden="true">${this.AGENDA}</span>`;
    const cuando = uno ? 'le llega un mail con el texto corto antes del evento, salvo que lo cargues para hoy.' : 'les llega un mail con el texto corto antes del evento, salvo que lo cargues para hoy.';
    const DEQUIEN = uno ? 'De quien dependés' : 'De quienes dependés';
    const sinMail = 'Lo ven en su agenda y en el Resumen, solo con el texto corto. No les llega ningún mail.';
    if (opcion === '2') {
      return { rotulo: 'Con quién', ayuda: '', pie: '', arriba: `<span class="mq-renglon">${mail}<span><b>Por mail</b><span class="mq-jefes">${chips}</span>${DEQUIEN}: ${cuando}</span></span>`
        + `<span class="mq-renglon mq-renglon-abajo">${agenda}<span><b>En la agenda</b><br>Las personas que elijas abajo, solo con el texto corto. No les llega ningún mail.</span></span>` };
    }
    if (opcion === '3') {
      return { rotulo: 'Con quién', ayuda: '', pie: '', arriba: `<span class="mq-dos"><span class="mq-mitad">${mail}<b>Les llega un mail</b><span class="mq-jefes">${chips}</span><small>${DEQUIEN}. Antes del evento, salvo que lo cargues para hoy.</small></span>`
        + `<span class="mq-mitad">${agenda}<b>Lo ven en la agenda</b><span class="mq-jefes mq-vivo"></span><small>Las que elijas abajo. No les llega ningún mail.</small></span></span>` };
    }
    if (opcion === '4') {
      return { rotulo: 'Quiénes lo ven en su agenda', ayuda: sinMail,
        arriba: 'Abajo elegís quién lo ve en su agenda. Antes de guardar vas a ver a quién le llega qué.',
        pie: `<span class="mq-pie-fila">${mail}<b>Por mail:</b><span class="mq-jefes">${chips}</span></span><span class="mq-pie-fila">${agenda}<b>En la agenda:</b><span class="mq-jefes mq-vivo"></span></span>` };
    }
    return { rotulo: 'Quiénes lo ven en su agenda', pie: '',
      ayuda: `<span class="mq-renglon">${agenda}<span>${sinMail}</span></span>`,
      arriba: `<span class="mq-renglon">${mail}<span><b>Aviso por mail</b><span class="mq-jefes">${chips}</span>${DEQUIEN}: ${cuando}</span></span>` };
  },
  // Lo que cambia con las personas elegidas: sus iniciales, o «Todavía nadie»
  pintarVivo(raiz, elegidas) {
    raiz.querySelectorAll('.mq-vivo').forEach((n) => {
      n.innerHTML = elegidas.length > 0 ? this.chips(elegidas) : '<span class="mq-nadie">Todavía nadie</span>';
    });
  },
  elegidasDe(caja) {
    return [...caja.querySelectorAll('[data-persona][aria-pressed="true"]')].map((b) => {
      const i = b.querySelector('i');
      const nombre = b.textContent.replace(i?.textContent ?? '', '').trim().split(' ')[0];
      return [b.dataset.persona === 'todos' ? '·' : i.textContent.trim(), nombre];
    });
  },
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
      ${enlace('opciones-formulario.html', 'Opciones del aviso', 'opciones')}
      ${enlace('mi-espacio.html#agenda', 'Agenda y formulario', 'agenda')}
      ${enlace('configuracion.html#usuarios', 'Usuarios: «Depende de»', 'usuarios')}
      ${enlace('mails.html', 'Los mails de la agenda', 'mails')}${extras}`;
    div.querySelector('.mq-plegar').addEventListener('click', () => div.classList.toggle('plegado'));
    document.body.appendChild(div);
    return div;
  }
};
