// MAQUETA: la pestaña Feriados de Configuración el 22/12/2026, con el modal del asueto del 24/12 abierto (window.MQF)
(() => {
  const F = window.MQF;
  const $ = (id) => document.getElementById(id);
  $('feriados-anio').innerHTML = F.anios;
  $('feriados-filtros').innerHTML = F.filtros;
  $('feriados-lista').innerHTML = F.tabla;
  $('fe-tipo-opciones').innerHTML = F.tipos;
  $('fe-fecha-dia').textContent = F.dia;
  const afectadas = (n) => {
    $('fe-fecha-afectadas').textContent = n === 3 ? F.T.feriado3 : F.T.feriado1;
    document.querySelectorAll('[data-mq-afectadas]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.mqAfectadas) === n)));
  };
  afectadas(1);
  document.addEventListener('click', (evento) => {
    const el = evento.target.closest('button');
    if (!el) return;
    if (el.dataset.mqAfectadas) afectadas(Number(el.dataset.mqAfectadas));
    if (el.id === 'mq-marcas') {
      const sin = document.body.classList.toggle('mq-sin-marcas');
      el.setAttribute('aria-pressed', String(!sin));
      el.textContent = sin ? 'Marcas: no' : 'Marcas: sí';
    }
  });
})();
