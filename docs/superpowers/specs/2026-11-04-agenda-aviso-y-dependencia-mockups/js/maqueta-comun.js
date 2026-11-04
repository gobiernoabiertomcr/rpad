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
  // El cuándo del aviso, como lo calcularía el servidor con la fecha elegida, hoy y la hora (feriados inventados: solo el 23/11)
  cuandoDelAviso(fecha, hoy, hora) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha ?? '')) return { texto: 'el día hábil anterior a las 14:00', llega: true };
    const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const fechaDe = (x) => new Date(`${x}T12:00:00Z`);
    const sumar = (x, n) => { const f = fechaDe(x); f.setUTCDate(f.getUTCDate() + n); return f.toISOString().slice(0, 10); };
    const habil = (x) => ![0, 6].includes(fechaDe(x).getUTCDay()) && x !== '2026-11-23';
    const nombre = (x) => `${DIAS[fechaDe(x).getUTCDay()]} ${x.slice(8, 10)}/${x.slice(5, 7)}`;
    if (fecha <= hoy) return { texto: fecha === hoy ? 'como es para hoy, no les llega ningún mail' : 'como ya pasó, no les llega ningún mail', llega: false };
    let anterior = sumar(fecha, -1);
    while (!habil(anterior)) anterior = sumar(anterior, -1);
    if (anterior > hoy) return { texto: `el ${nombre(anterior)} a las 14:00`, llega: true };
    if (anterior === hoy && hora < '14:00') return { texto: 'hoy a las 14:00', llega: true };
    if (habil(fecha)) return { texto: `el ${nombre(fecha)} a las 8:05`, llega: true };
    return { texto: 'como ya salió el aviso de ese día, no les llega ningún mail', llega: false };
  },
  // Arriba, solo el aviso por mail; junto a las personas, que lo ven en la agenda sin recibir mail y por qué ya están marcados los jefes
  piezas(jefes, cuando) {
    const uno = jefes.length === 1;
    const mail = `<span class="mq-ico-chico" aria-hidden="true">${this.MAIL}</span>`;
    const agenda = `<span class="mq-ico-chico" aria-hidden="true">${this.AGENDA}</span>`;
    const dequien = uno ? 'De quien dependés' : 'De quienes dependés';
    const frase = cuando.llega ? `${uno ? 'le llega' : 'les llega'} la notificación por mail ${cuando.texto}.` : `${uno ? cuando.texto.replace('les llega', 'le llega') : cuando.texto}.`;
    const nombres = jefes.map(([, n]) => n);
    const lista = nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
    const marcados = uno ? `${lista} ya está en la lista, porque dependés de esa persona. Si le sacás la marca, no lo ve en su agenda, pero igual le llega el mail.`
      : `${lista} ya están en la lista, porque dependés de esas personas. Si les sacás la marca, no lo ven en su agenda, pero igual les llega el mail.`;
    return { rotulo: 'Quiénes lo ven en su agenda',
      arriba: `<span class="mq-renglon">${mail}<span><b>Aviso por mail</b><span class="mq-jefes">${this.chips(jefes)}</span>${dequien}: ${frase}</span></span>`,
      ayuda: `<span class="mq-renglon">${agenda}<span>Lo ven en su agenda y en el Resumen, solo con el texto corto. Por marcarlas acá, no les llega ningún mail.<br>${marcados}</span></span>` };
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
      ${enlace('mi-espacio.html#agenda', 'Agenda y formulario', 'agenda')}
      ${enlace('configuracion.html#usuarios', 'Usuarios: «Depende de»', 'usuarios')}
      ${enlace('mails.html', 'Los mails de la agenda', 'mails')}${extras}`;
    div.querySelector('.mq-plegar').addEventListener('click', () => div.classList.toggle('plegado'));
    document.body.appendChild(div);
    return div;
  }
};
