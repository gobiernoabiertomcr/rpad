// MAQUETA: navega entre los momentos con lo que trae datos.js (window.MQ). No guarda nada.
(() => {
  const { MOMENTOS, MODAL_A, MODAL_B, WORD, EMAIL } = window.MQ;
  const $ = (id) => document.getElementById(id);
  const estado = { momento: 'abril', pestana: 'resumen', anio: 2027 };

  const avisar = (texto) => {
    const aviso = $('mq-aviso');
    aviso.textContent = texto;
    aviso.classList.add('visible');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => aviso.classList.remove('visible'), 2600);
  };

  const mostrarPestana = (pestana) => {
    estado.pestana = pestana;
    for (const nombre of ['resumen', 'licencias', 'horas', 'agenda']) {
      $(`tab-${nombre}`).setAttribute('aria-selected', String(nombre === pestana));
      $(`tab-${nombre}`).tabIndex = nombre === pestana ? 0 : -1;
      $(`vista-${nombre}`).hidden = nombre !== pestana;
    }
  };

  const pintarLicencias = () => {
    const datos = MOMENTOS[estado.momento];
    if (datos) $('vista-licencias').innerHTML = datos.listas[estado.anio] ?? datos.listas[2027];
  };

  const cerrarModales = () => { document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active')); document.body.classList.remove('mq-con-modal'); };

  const abrirCarga = () => {
    if (!['al-volver', 'abril'].includes(estado.momento)) irA('abril', { sinHash: true });
    $('ml-tipos-opciones').innerHTML = MODAL_A.tipos;
    $('ml-fechas-ayuda').textContent = MODAL_A.ayuda;
    $('ml-calculo').innerHTML = MODAL_A.calculo;
    $('ml-mostrar-ayuda').textContent = MODAL_A.mostrar;
    $('ml-paso').innerHTML = MODAL_A.paso;
    $('ml-paso-dos').innerHTML = MODAL_A.segundo;
    $('modal-licencia-titulo').textContent = 'Cargar licencia';
    for (const id of ['ml-cuerpo', 'ml-pie-del-formulario']) $(id).hidden = false;
    for (const id of ['ml-paso-dos', 'ml-paso-dos-pie']) $(id).hidden = true;
    $('modal-licencia').classList.add('active');
    document.body.classList.add('mq-con-modal');
    $('ml-desde').focus();
  };

  const abrirRestitucion = () => {
    if (estado.momento !== 'variante-b') irA('variante-b', { sinHash: true });
    $('mr-cuerpo').innerHTML = MODAL_B.cuerpo;
    $('mr-paso-dos').innerHTML = MODAL_B.segundo;
    $('modal-restituir-titulo').textContent = 'Pedir la restitución';
    for (const id of ['mr-cuerpo', 'mr-pie']) $(id).hidden = false;
    for (const id of ['mr-paso-dos', 'mr-paso-dos-pie']) $(id).hidden = true;
    $('modal-restituir').classList.add('active');
    document.body.classList.add('mq-con-modal');
    $('mr-pedir').focus();
  };

  function irA(momento, { sinHash = false } = {}) {
    cerrarModales();
    document.querySelectorAll('[data-mq-momento]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mqMomento === momento)));
    if (!sinHash) history.replaceState(null, '', `#${momento}`);
    if (momento === 'email') {
      estado.momento = 'email';
      $('mq-mi-espacio').hidden = true;
      $('mq-correo').hidden = false;
      $('mq-correo-de').textContent = EMAIL.de;
      $('mq-correo-asunto').textContent = EMAIL.asunto;
      $('mq-correo-cuando').textContent = EMAIL.cuando;
      $('mq-idea').textContent = 'El email que llega el lunes 11/01/2027 a las 8:15, el primer día después de las vacaciones (mientras está de licencia no se manda). Hay otro 5 días hábiles antes del plazo, el viernes 23/04/2027.';
      return;
    }
    if (momento === 'cargar') { irA('abril', { sinHash: true }); history.replaceState(null, '', '#cargar'); abrirCarga(); marcar('cargar'); return; }
    $('mq-mi-espacio').hidden = false;
    $('mq-correo').hidden = true;
    const datos = MOMENTOS[momento] ?? MOMENTOS.abril;
    estado.momento = MOMENTOS[momento] ? momento : 'abril';
    estado.anio = Number(datos.hoy.slice(0, 4));
    $('vista-resumen').innerHTML = datos.resumen.html;
    $('me-marca').innerHTML = datos.resumen.marca ? '<span class="me-marca" role="img" aria-label="Hay algo que vence pronto"></span>' : '';
    pintarLicencias();
    $('mq-idea').textContent = datos.idea;
    mostrarPestana(estado.pestana);
  }
  const marcar = (momento) => document.querySelectorAll('[data-mq-momento]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mqMomento === momento)));

  const bajar = (clave) => {
    const word = WORD[clave];
    const a = document.createElement('a');
    a.href = word.archivo;
    a.download = word.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    avisar(`Bajando «${word.nombre}»`);
  };

  document.addEventListener('click', (evento) => {
    const el = evento.target.closest('button, a');
    if (!el) return;
    const d = el.dataset;
    if (d.mqMomento) { irA(d.mqMomento); return; }
    if (el.id === 'mq-marcas') {
      const sin = document.body.classList.toggle('mq-sin-marcas');
      el.setAttribute('aria-pressed', String(!sin));
      el.textContent = sin ? 'Marcas: no' : 'Marcas: sí';
      return;
    }
    if (d.mqWord) { evento.preventDefault(); bajar(d.mqWord); return; }
    if (d.mqIr === 'cargar' || (d.accion === 'cargar-licencia' && d.tipo === 'restituidos')) { abrirCarga(); return; }
    if (d.mqIr === 'pedir' || (d.accion === 'cargar-licencia' && d.tipo === 'restitucion')) { abrirRestitucion(); return; }
    if (d.mqIr) { irA(d.mqIr); return; }
    if (d.mqCerrar !== undefined) { cerrarModales(); return; }
    if (d.mqListo) { irA(d.mqListo); return; }
    if (el.id === 'ml-guardar') {
      $('modal-licencia-titulo').textContent = 'Licencia cargada';
      for (const id of ['ml-cuerpo', 'ml-pie-del-formulario']) $(id).hidden = true;
      for (const id of ['ml-paso-dos', 'ml-paso-dos-pie']) $(id).hidden = false;
      document.querySelector('#ml-paso-dos-pie [data-mq-word]').focus();
      return;
    }
    if (el.id === 'mr-pedir') {
      $('modal-restituir-titulo').textContent = 'Restitución pedida';
      for (const id of ['mr-cuerpo', 'mr-pie']) $(id).hidden = true;
      for (const id of ['mr-paso-dos', 'mr-paso-dos-pie']) $(id).hidden = false;
      document.querySelector('#mr-paso-dos-pie [data-mq-word]').focus();
      return;
    }
    if (d.pestana) { evento.preventDefault(); mostrarPestana(d.pestana); if (d.anioLicencias) { estado.anio = Number(d.anioLicencias); pintarLicencias(); } return; }
    if (d.anio) { estado.anio = Number(d.anio); pintarLicencias(); return; }
    if (d.wordLicencia) { avisar('En la maqueta, esa nota no se baja.'); return; }
    if (d.mqToast || d.accion || d.abrir || d.cargar || d.editarLicencia || d.filtroLicencia || el.getAttribute('href') === '#') {
      evento.preventDefault();
      avisar('Eso no cambia: no es parte de esta maqueta.');
    }
  });
  document.addEventListener('keydown', (evento) => { if (evento.key === 'Escape') cerrarModales(); });

  const desdeLaDireccion = () => {
    const inicial = location.hash.slice(1);
    irA(['email', 'cargar', ...Object.keys(MOMENTOS)].includes(inicial) ? inicial : 'abril', { sinHash: true });
    marcar(['email', 'cargar', ...Object.keys(MOMENTOS)].includes(inicial) ? inicial : 'abril');
  };
  window.addEventListener('hashchange', desdeLaDireccion);
  desdeLaDireccion();
})();
