// MAQUETA (04/11/2026): lo nuevo de la spec, sobre la página real (mi-espacio.js sin cambios). Sin saldos: el saludo en el Resumen,
// el aviso en Licencias y en Horas extras, sin «Cargar licencia» ni «Cargar horas extras» y sin abrir el formulario solo. Lo nuevo
// lleva la clase mq-nuevo (con «Marcas: sí», un borde punteado).
(() => {
  const { MQ } = window;
  const $ = (id) => document.getElementById(id);
  const BOTON = '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-abrir="saldos">Mis vacaciones y saldos</button>';
  const aviso = (texto) => `<div class="me-aviso me-aviso-azul mq-nuevo"><p>${esc(texto)}</p>${BOTON}</div>`;
  const sinSaldos = () => esObjeto(pagina.resumen?.sin_saldos);

  MQ.alCambiar = () => pintarLaBarra();

  const resumenReal = htmlDelResumen;
  htmlDelResumen = (resumen) => {
    if (!esObjeto(resumen?.sin_saldos)) return resumenReal(resumen);
    const { encabezado, saludo, texto } = resumen.sin_saldos;
    return '<section class="me-banda me-banda-bienvenida mq-nuevo" aria-labelledby="me-frase"><div class="me-banda-cuerpo sin-vence"><div class="me-titular">'
      + `<p class="me-banda-dia">${esc(encabezado)}</p><h2 class="me-frase" id="me-frase">${esc(saludo)}</h2>`
      + `<p class="me-frase-bajada">${esc(texto)}</p>${BOTON}</div></div>${OLA_DE_LA_BANDA}</section>`
      + htmlDeHoyYManana(resumen.hoy_y_manana, resumen.persona?.ve_companeros);
  };

  const licenciasReal = htmlDeListaDeLicencias;
  htmlDeListaDeLicencias = (datos, ...resto) => (esObjeto(datos?.sin_saldos) ? aviso(datos.sin_saldos.texto) : licenciasReal(datos, ...resto));
  const horasReal = htmlDeHorasExtras;
  htmlDeHorasExtras = (tabla, ...resto) => (esObjeto(tabla?.sin_saldos) ? aviso(tabla.sin_saldos.texto) : horasReal(tabla, ...resto));
  // alTocarHoras no atiende data-abrir="saldos": la spec se lo suma
  document.getElementById('vista-horas')?.addEventListener('click', (evento) => {
    const saldos = evento.target?.closest?.('[data-abrir="saldos"]');
    if (saldos) abrirSaldos(saldos);
  });

  // Sin abrirse solo: abrir_saldos sigue llegando (los frenos quedan), pero el formulario se abre a pedido
  const pintarResumenReal = pintarResumen;
  pintarResumen = () => {
    pagina.saldosAbiertosSolos = true;
    pintarResumenReal();
    $('btn-cargar-horas').hidden = $('btn-cargar-horas').hidden || sinSaldos();
    $('btn-cargar-licencia').hidden = $('btn-cargar-licencia').hidden || sinSaldos();
  };

  const abrirSaldosReal = abrirSaldos;
  abrirSaldos = async (...args) => {
    const cancelar = [...document.querySelectorAll('#modal-saldos .modal-footer button')].find((b) => /Cancelar|Lo completo/.test(b.textContent));
    if (cancelar) cancelar.textContent = sinSaldos() ? 'Lo completo después' : 'Cancelar';
    return abrirSaldosReal(...args);
  };

  // ---- La barra de la maqueta ----
  const url = (cambios) => `${location.pathname}?${new URLSearchParams({ persona: MQ.persona, estado: MQ.estado, ...cambios })}${location.hash}`;
  const pintarLaBarra = () => {
    const boton = (nombre, valor, activo, texto) => `<button type="button" data-mq="${nombre}" data-valor="${valor}" aria-pressed="${activo}">${texto}</button>`;
    const marcas = !document.body.classList.contains('mq-sin-marcas');
    $('mq-controles').innerHTML = `<span class="mq-grupo"><b>Quién</b>${boton('persona', 'planta', MQ.persona === 'planta', 'Planta')}${boton('persona', 'contrato', MQ.persona === 'contrato', 'Contrato')}</span>`
      + `<span class="mq-grupo"><b>Situación</b>${boton('estado', 'vacio', MQ.estado === 'vacio', 'Sin saldos')}${boton('estado', 'completo', MQ.estado === 'completo', 'Ya completó')}</span>`
      + `<span class="mq-grupo"><button type="button" id="mq-marcas" aria-pressed="${marcas}">Marcas: ${marcas ? 'sí' : 'no'}</button></span>`;
  };
  document.addEventListener('click', (evento) => {
    if (evento.target.closest?.('#mq-marcas')) { document.body.classList.toggle('mq-sin-marcas'); pintarLaBarra(); return; }
    const boton = evento.target.closest?.('[data-mq]');
    if (boton) location.href = url({ [boton.dataset.mq]: boton.dataset.valor });
  });
  pintarLaBarra();
})();
