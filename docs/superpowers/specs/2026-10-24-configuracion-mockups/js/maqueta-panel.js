// El recuadro oscuro de abajo a la derecha: es de la maqueta, no de la página. Cambia el rol de quien mira, la variante
// de la lista de Áreas y el ícono de Gestión de Datasets.
(() => {
  const ICONOS = {
    hoy: { texto: 'Ruedita (hoy)', svg: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
    tabla: { texto: 'Tabla (table-2)', svg: '<path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>' },
    tildes: { texto: 'Lista con tildes (list-checks)', svg: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>' },
    capas: { texto: 'Capas (layers, elegido)', svg: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>' },
    fichas: { texto: 'Lista de fichas (layout-list)', svg: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 4h7"/><path d="M14 9h7"/><path d="M14 15h7"/><path d="M14 20h7"/>' }
  };
  const parametros = new URLSearchParams(window.location.search);
  const rol = parametros.get('rol') || 'superadmin';
  const lista = parametros.get('lista') === 'filas' ? 'filas' : 'tabla';
  const icono = ICONOS[parametros.get('icono')] ? parametros.get('icono') : 'capas';

  const conParametro = (clave, valor) => {
    const p = new URLSearchParams(window.location.search);
    p.set(clave, valor);
    return `?${p.toString()}${window.location.hash}`;
  };
  const opcion = (clave, valor, texto, elegido) =>
    `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="radio" name="mq-${clave}" value="${valor}" ${valor === elegido ? 'checked' : ''}> ${texto}</label>`;

  const ponerIcono = (clave) => { document.getElementById('icono-gestion').innerHTML = ICONOS[clave].svg; };

  document.addEventListener('DOMContentLoaded', () => {
    ponerIcono(icono);
    const caja = document.createElement('aside');
    caja.setAttribute('aria-label', 'Controles de la maqueta');
    caja.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:3000;width:280px;background:#142B4A;color:#fff;border-radius:14px;padding:14px 16px;font:13px/1.45 Figtree,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25)';
    caja.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px">
        <b style="font-size:14px">Maqueta</b>
        <button type="button" id="mq-plegar" style="background:none;border:1px solid #6B84A6;color:#fff;border-radius:999px;padding:1px 10px;cursor:pointer;font:inherit">Ocultar</button>
      </div>
      <div id="mq-cuerpo">
        <p style="margin:0 0 10px;color:#C9D6E8">Usuarios y licencias, inventados. Las áreas son las reales de la base; sus emails, teléfonos y personas de contacto, inventados. Lo que guardás se pierde al recargar.</p>
        <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:2px">Quién mira</legend>
          ${opcion('rol', 'superadmin', 'Superadmin', rol)}${opcion('rol', 'admin', 'Admin', rol)}${opcion('rol', 'editor', 'Editor', rol)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0 0 10px"><legend style="font-weight:700;margin-bottom:2px">Lista de Áreas</legend>
          ${opcion('lista', 'tabla', 'A. Tabla (elegida)', lista)}${opcion('lista', 'filas', 'B. Filas que se despliegan', lista)}</fieldset>
        <fieldset style="border:0;padding:0;margin:0"><legend style="font-weight:700;margin-bottom:2px">Ícono de Gestión de Datasets</legend>
          ${Object.entries(ICONOS).map(([clave, { texto }]) => opcion('icono', clave, texto, icono)).join('')}</fieldset>
      </div>`;
    document.body.appendChild(caja);
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
