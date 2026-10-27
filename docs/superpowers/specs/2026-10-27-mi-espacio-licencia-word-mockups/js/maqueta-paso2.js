// MAQUETA (27/10/2026): el segundo paso de «Cargar licencia» en tres versiones (A, B y C, en la barra de abajo), «Word» en la
// lista y las fechas de ejemplo al elegir un tipo. Los Word que baja son los de word/, armados con los textos aprobados.
(function () {
  const D = window.MAQUETA_DATOS;
  const W = window.MAQUETA_WORDS;
  const OPCIONES = {
    a: 'A. Resumen y la nota en chico',
    b: 'B. Compacta',
    c: 'C. La nota a la vista'
  };
  const parametros = new URLSearchParams(location.search);
  let opcion = OPCIONES[parametros.get('opcion')] ? parametros.get('opcion') : 'a';
  let actual = null; // { fila, word, corregida }

  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const porId = (id) => document.getElementById(id);
  const TILDE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const DOC = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>';
  const CLASE_DEL_TIPO = {
    vacaciones: 'azul', franquicia: 'violeta', estudios: 'ambar', medica: 'rojo', medica_extraordinaria: 'rojo', familiar: 'verde',
    franco: 'verde', horas_a_favor: 'violeta'
  };

  // La hoja de la nota (A4, Arial 11, 1,15), a escala del ancho que tenga
  function htmlDeHoja(nota, clase) {
    const p = (texto, extra = '') => `<p class="${extra}">${esc(texto)}</p>`;
    const vacio = '<p class="vacio"></p>';
    return `<div class="p2-hoja ${clase}"><div class="p2-hoja-texto">`
      + p(nota.fecha, 'derecha') + vacio + vacio
      + nota.destinatario.map((linea) => p(linea)).join('') + p(nota.sd, 'sd') + vacio
      + p(nota.saludo) + vacio
      + p(nota.cuerpo, 'sangria justificado') + vacio
      + p(nota.cierre, 'sangria') + vacio + vacio + vacio + vacio
      + '<div class="firma"><p>______________________________</p>'
      + nota.firma.map((linea, i) => p(linea, i > 0 && linea.startsWith('Personal') ? 'chico' : '')).join('') + '</div>'
      + '</div></div>';
  }

  function datosDeLaFila(fila) {
    const detalles = [fila.de_licencias_texto, fila.configuracion?.texto, fila.mostrar_texto].filter((t) => t && String(t).trim());
    return { detalles };
  }

  function htmlDelPaso(paso) {
    const { fila, word, corregida } = paso;
    const { detalles } = datosDeLaFila(fila);
    const insignia = `<span class="me-insignia ${CLASE_DEL_TIPO[fila.tipo] ?? 'gris'}">${esc(fila.tipo_nombre)}</span>`;
    const linea = `${insignia}<b class="p2-fechas">${esc(fila.fechas_texto)}</b><span class="p2-suave">${esc(fila.cantidad_texto)}</span>`;
    const detalle = detalles.length ? `<p class="p2-detalle">${detalles.map(esc).join(' ')}</p>` : '';
    const fechaDeLaNota = corregida ? 'Lleva la fecha de hoy, 27/10/2026: el día en que la corregiste.' : 'Lleva la fecha de hoy, 27/10/2026: el día en que la cargaste.';
    const boton = (clase) => `<button type="button" class="sg-btn ${clase}" data-p2-word>Descargar Word</button>`;
    if (opcion === 'a') {
      return '<div class="p2 p2-a">'
        + `<div class="p2-hecho"><span class="p2-tilde">${TILDE}</span><div class="p2-hecho-texto">`
        + `<p class="p2-linea">${linea}</p>${detalle}</div></div>`
        + '<section class="p2-nota" aria-labelledby="p2-nota-titulo">'
        + htmlDeHoja(word.nota, 'mini')
        + '<div class="p2-nota-texto"><h3 id="p2-nota-titulo">La nota para el Director General</h3>'
        + `<p class="p2-archivo">${esc(word.nombre)}</p><p class="p2-suave">Hoja A4. ${fechaDeLaNota}</p>`
        + `<p class="p2-error" data-p2-error hidden></p>${boton('sg-btn-tinta')}</div></section></div>`;
    }
    if (opcion === 'b') {
      return '<div class="p2 p2-b">'
        + `<div class="p2-recuadro-verde"><span class="p2-tilde chica">${TILDE}</span><div>`
        + `<p class="p2-linea">${linea}</p>${detalle}</div></div>`
        + `<div class="p2-archivo-fila"><span class="p2-icono">${DOC}</span><span class="p2-archivo-textos">`
        + '<b>La nota para el Director General</b>'
        + `<small>${esc(word.nombre)}</small></span>${boton('sg-btn-borde')}</div>`
        + `<p class="p2-suave p2-b-ayuda">${fechaDeLaNota}</p><p class="p2-error" data-p2-error hidden></p></div>`;
    }
    return '<div class="p2 p2-c">'
      + `<div class="p2-hecho chico"><span class="p2-tilde chica">${TILDE}</span><div class="p2-hecho-texto">`
      + `<p class="p2-linea">${linea}</p>${detalle}</div></div>`
      + `<h3 class="p2-c-titulo">Así sale la nota</h3><p class="p2-suave p2-c-ayuda">${fechaDeLaNota} Se baja en Word, para imprimir y firmar.</p>`
      + `<div class="p2-mesa">${htmlDeHoja(word.nota, 'grande')}</div>`
      + '<p class="p2-error" data-p2-error hidden></p></div>';
  }

  function htmlDelPie() {
    if (opcion === 'c') {
      return '<div class="botones"><button type="button" class="sg-btn sg-btn-borde" data-cerrar>Listo</button>'
        + '<button type="button" class="sg-btn sg-btn-tinta" data-p2-word>Descargar Word</button></div>';
    }
    return `<div class="botones"><button type="button" class="sg-btn ${opcion === 'b' ? 'sg-btn-tinta' : 'sg-btn-borde'}" data-cerrar>Listo</button></div>`;
  }

  function dibujar(enfocar) {
    const modal = porId('modal-licencia').querySelector('.modal');
    modal.classList.add('p2-activo');
    porId('modal-licencia-titulo').textContent = actual.corregida ? 'Licencia corregida' : 'Licencia cargada';
    let cuerpo = modal.querySelector('.p2-cuerpo');
    if (!cuerpo) {
      cuerpo = document.createElement('div');
      cuerpo.className = 'modal-body p2-cuerpo';
      modal.querySelector('.modal-footer').before(cuerpo);
      const pie = document.createElement('div');
      pie.className = 'modal-footer p2-pie';
      modal.append(pie);
    }
    cuerpo.innerHTML = htmlDelPaso(actual);
    modal.querySelector('.p2-pie').innerHTML = htmlDelPie();
    if (enfocar) {
      const primero = modal.querySelector('[data-p2-word]');
      setTimeout(() => primero?.focus(), 60);
    }
    const anuncio = porId('me-anuncio');
    if (anuncio) anuncio.textContent = `${actual.corregida ? 'Licencia corregida' : 'Licencia cargada'}. Podés descargar la nota en Word.`;
  }

  function quitar() {
    const modal = porId('modal-licencia')?.querySelector('.modal');
    if (!modal) return;
    modal.classList.remove('p2-activo');
    modal.querySelector('.p2-cuerpo')?.remove();
    modal.querySelector('.p2-pie')?.remove();
    actual = null;
  }

  function bajar(word) {
    const a = document.createElement('a');
    a.href = word.archivo;
    a.download = word.nombre;
    document.body.append(a);
    a.click();
    a.remove();
  }

  window.MAQUETA_PASO2 = {
    mostrar({ respuesta, fila, cuerpo }) {
      if (fila) {
        actual = { fila, word: W[`lista-${fila.id}`] ?? W[`nueva-${fila.tipo}`], corregida: true };
      } else {
        const e = D.escenarios[cuerpo.tipo];
        const nueva = e.despues['GET /mi-espacio/licencias'].json.data.licencias.find((x) => x.id === e.id);
        actual = { fila: nueva, word: W[`nueva-${cuerpo.tipo}`], corregida: false };
      }
      dibujar(true);
    }
  };

  // Al cerrar el modal, vuelve a ser el formulario
  new MutationObserver(() => {
    if (!porId('modal-licencia').classList.contains('active')) quitar();
  }).observe(document.getElementById('modal-licencia') ?? document.body, { attributes: true, attributeFilter: ['class'] });

  document.addEventListener('click', (evento) => {
    const enElPaso = evento.target.closest?.('[data-p2-word]');
    if (enElPaso && actual) bajar(actual.word);
    const enLaFila = evento.target.closest?.('[data-word-licencia]');
    if (enLaFila) {
      const id = Number(enLaFila.dataset.wordLicencia);
      const tipo = window.MAQUETA_ESTADO.escenario;
      const nueva = tipo && D.escenarios[tipo].id === id ? W[`nueva-${tipo}`] : null;
      bajar(nueva ?? W[`lista-${id}`]);
    }
    const eleccion = evento.target.closest?.('[data-opcion]');
    if (eleccion) {
      opcion = eleccion.dataset.opcion;
      const url = new URL(location.href);
      url.searchParams.set('opcion', opcion);
      history.replaceState(null, '', url);
      pintarBarra();
      if (actual) dibujar(false);
    }
  });

  // En un alta, al elegir el tipo, las fechas del ejemplo guardado (sus cálculos son los de la API real)
  document.addEventListener('change', (evento) => {
    if (evento.target?.name !== 'ml-tipo') return;
    if (porId('modal-licencia-titulo').textContent !== 'Cargar licencia') return;
    const e = window.MAQUETA_ESCENARIOS[evento.target.value];
    if (!e) return;
    setTimeout(() => {
      const poner = (id, valor) => {
        const campo = porId(id);
        if (!campo || valor === undefined || valor === null) return;
        campo.value = String(valor);
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        campo.dispatchEvent(new Event('change', { bubbles: true }));
      };
      poner('ml-desde', e.desde);
      poner('ml-hasta', e.hasta);
      if (e.horas) poner('ml-horas', e.horas);
    }, 30);
  });

  function pintarBarra() {
    let barra = porId('maqueta-barra');
    if (!barra) {
      barra = document.createElement('div');
      barra.id = 'maqueta-barra';
      barra.setAttribute('role', 'group');
      barra.setAttribute('aria-label', 'Maqueta: versión del segundo paso');
      document.body.append(barra);
    }
    barra.innerHTML = '<span>Maqueta, segundo paso:</span>'
      + Object.entries(OPCIONES).map(([clave, nombre]) => `<button type="button" class="sg-chip" data-opcion="${clave}" title="${esc(nombre)}" aria-pressed="${String(clave === opcion)}"><span class="visually-hidden">Versión </span>${clave.toUpperCase()}</button>`).join('')
      + '<a href="index.html">Ver todo</a>';
  }
  document.addEventListener('DOMContentLoaded', pintarBarra);
})();
