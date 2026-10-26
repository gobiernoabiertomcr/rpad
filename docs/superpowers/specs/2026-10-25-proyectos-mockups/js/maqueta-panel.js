// El recuadro oscuro de abajo a la derecha: es de la maqueta, no de la página. Cambia la propuesta de la lista y del detalle,
// quién mira y el ícono de Proyectos en el menú.
(() => {
  const ICONOS = {
    carpeta: { texto: 'Carpeta con tablero (folder-kanban)', svg: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>' },
    maletin: { texto: 'Maletín (briefcase)', svg: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>' },
    hito: { texto: 'Hito (milestone)', svg: '<path d="M12 13v8"/><path d="M12 3v3"/><path d="M4 6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h13a2 2 0 0 0 1.152-.365l3.424-2.317a1 1 0 0 0 0-1.635l-3.424-2.318A2 2 0 0 0 17 6z"/>' },
    bandera: { texto: 'Bandera (flag)', svg: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>' },
    barras: { texto: 'Barras (el de hoy)', svg: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>' }
  };
  const parametros = new URLSearchParams(window.location.search);
  const valor = (clave, opciones, defecto) => (opciones.includes(parametros.get(clave)) ? parametros.get(clave) : defecto);
  const lista = valor('lista', ['tabla', 'tarjetas', 'carriles'], 'carriles');
  const detalle = valor('detalle', ['filas', 'cinta'], 'filas');
  const ventana = valor('ventana', ['5', '3'], '5');
  const rol = valor('rol', ['admin', 'lector', 'colaborador'], 'admin');
  const icono = valor('icono', Object.keys(ICONOS), 'carpeta');

  const conParametro = (clave, v) => {
    const p = new URLSearchParams(window.location.search);
    p.set(clave, v);
    return `?${p.toString()}${window.location.hash}`;
  };
  const opcion = (clave, v, texto, elegido) =>
    `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="mq-${clave}" value="${v}" ${v === elegido ? 'checked' : ''}> ${texto}</label>`;
  const ponerIcono = (clave) => document.querySelectorAll('.icono-proyectos').forEach((s) => { s.innerHTML = ICONOS[clave].svg; });

  document.addEventListener('DOMContentLoaded', () => {
    ponerIcono(icono);
    const caja = document.createElement('aside');
    caja.setAttribute('aria-label', 'Controles de la maqueta');
    caja.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:3000;width:290px;max-height:calc(100vh - 32px);overflow:auto;background:#142B4A;color:#fff;border-radius:14px;padding:14px 16px;font:13px/1.45 Figtree,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    caja.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <b style="font-size:14px">Maqueta</b>
        <button type="button" id="mq-plegar" style="background:none;border:1px solid #6B84A6;color:#fff;border-radius:999px;padding:1px 10px;cursor:pointer;font:inherit">Ocultar</button>
      </div>
      <div id="mq-cuerpo">
        <p style="margin:0 0 10px;color:#C9D6E8">Los 8 proyectos y 14 hitos son los reales; los nombres de las personas, inventados. También inventados: el hito previsto del Datathon y los dos logros. No se guarda nada.</p>
        <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:2px">Lista de proyectos</legend>
          ${opcion('lista', 'tabla', 'A. Tabla, como el Seguimiento', lista)}${opcion('lista', 'tarjetas', 'B. Tarjetas por estado', lista)}${opcion('lista', 'carriles', 'C. Carriles sobre los años', lista)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:2px">Años de los carriles (C)</legend>
          ${opcion('ventana', '5', '5 años con selector', ventana)}${opcion('ventana', '3', '3 años con flechas', ventana)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:2px">Detalle de un proyecto</legend>
          ${opcion('detalle', 'filas', '1. Ficha, hitos y documentos', detalle)}${opcion('detalle', 'cinta', '2. Ficha con la cinta del recorrido', detalle)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:2px">Quién mira</legend>
          ${opcion('rol', 'admin', 'Administración (carga y borra)', rol)}${opcion('rol', 'colaborador', 'Colaborador (solo mira)', rol)}${opcion('rol', 'lector', 'Lector (solo mira)', rol)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:2px">Ícono de Proyectos en el menú</legend>
          ${Object.entries(ICONOS).map(([clave, { texto }]) => opcion('icono', clave, texto, icono)).join('')}</fieldset>
      </div>`;
    document.body.appendChild(caja);
    // Para las capturas: ?mq=oculto no dibuja el recuadro
    if (parametros.get('mq') === 'oculto') caja.hidden = true;
    caja.addEventListener('change', (evento) => {
      const { name, value } = evento.target;
      if (name === 'mq-icono') {
        ponerIcono(value);
        history.replaceState(null, '', conParametro('icono', value));
        if (!document.getElementById('sidebar').classList.contains('open')) document.getElementById('sidebarToggle').click();
        return;
      }
      window.location.href = conParametro(name.slice(3), value);
    });
    document.getElementById('mq-plegar').addEventListener('click', (evento) => {
      const cuerpo = document.getElementById('mq-cuerpo');
      cuerpo.hidden = !cuerpo.hidden;
      evento.currentTarget.textContent = cuerpo.hidden ? 'Mostrar' : 'Ocultar';
    });
  });
})();
