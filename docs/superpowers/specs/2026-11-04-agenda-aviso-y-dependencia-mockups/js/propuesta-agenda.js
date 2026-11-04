// MAQUETA: lo que el formulario suma sin tocar su lógica: el error si no se eligió, el rótulo de la variante, «Cambiar» en el aviso y el panel.
(function () {
  const M = window.MAQUETA;
  const variante = window.MQ.variante;
  const rol = M.leer('mq-rol', 'editor');
  const tipos = document.getElementById('ev-tipos');
  if (variante === 'B') document.getElementById('ev-tipo-rotulo').textContent = '¿Quién lo ve?';

  document.getElementById('ev-guardar').addEventListener('click', (e) => {
    const elegido = tipos.querySelector('[aria-pressed="true"]');
    if (elegido?.dataset.tipo === 'laboral') {
      const caja = document.getElementById('ev-personas');
      const conTodos = caja.querySelector('[data-persona="todos"][aria-pressed="true"]') !== null;
      const cuantas = conTodos ? M.PERSONAS.length - 1 : caja.querySelectorAll('[data-persona][aria-pressed="true"]').length;
      if (cuantas >= 5 && !confirm(`Les va a llegar un mail a ${cuantas} personas. ¿Guardar?`)) { e.stopImmediatePropagation(); e.preventDefault(); return; }
    }
    if (elegido) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    const error = document.getElementById('ev-tipo-error');
    error.textContent = variante === 'B' ? 'Elegí quién lo ve.' : 'Elegí el tipo de evento.';
    error.hidden = false;
    tipos.setAttribute('aria-invalid', 'true');
    document.getElementById('ev-grupo-tipo').scrollIntoView({ block: 'center' });
    tipos.querySelector('button')?.focus();
  }, true);
  tipos.addEventListener('click', () => {
    document.getElementById('ev-tipo-error').hidden = true;
    tipos.removeAttribute('aria-invalid');
  }, true);

  // «Cambiar» en el aviso de guardado: abre el evento recién guardado
  new MutationObserver(() => {
    const toast = document.querySelector('.toast');
    const id = window.MQ.ultimoGuardado;
    if (!toast || !id || toast.querySelector('.mq-cambiar')) return;
    const boton = document.createElement('button');
    boton.type = 'button'; boton.className = 'mq-cambiar'; boton.textContent = 'Cambiar';
    boton.addEventListener('click', () => {
      document.querySelector(`[data-evento="${id}"]`)?.click();
      toast.remove();
    });
    (toast.querySelector('span') ?? toast).appendChild(boton);
    window.MQ.ultimoGuardado = null;
  }).observe(document.body, { childList: true });

  document.getElementById('mq-agenda-mail')?.addEventListener('change', (e) => {
    showToast(e.target.checked ? 'Te va a llegar tu agenda por mail.' : 'Ya no te llega tu agenda por mail. Lo que dependa de vos te llega igual.', 'success');
  });

  const panel = M.panel('agenda', `
    <label>Hora en la maqueta (hoy es 04/11)
      <select id="mq-hora"><option value="10:30">10:30, antes de las 14:00</option><option value="15:00">15:00, después de las 14:00</option></select></label>
    <label>Quién carga
      <select id="mq-rol"><option value="editor">Editor (dos personas arriba)</option><option value="lector">Lector (una persona arriba)</option></select></label>
    <a href="#" id="mq-reiniciar">Volver a los eventos de ejemplo</a>`);
  const grupo = document.getElementById('ev-grupo-tipo');
  grupo.dataset.forma = '4';
  panel.querySelector('#mq-hora').value = M.leer('mq-hora', '10:30');
  panel.querySelector('#mq-rol').value = rol;
  const refrescar = () => {
    if (tipos.querySelector('[aria-pressed="true"]')?.dataset.tipo === 'publico') window.MQ.adornarFrase(document.getElementById('ev-tipo-ayuda'), 'publico');
  };
  panel.querySelector('#mq-hora').addEventListener('change', (e) => { M.guardar('mq-hora', e.target.value); refrescar(); });
  document.getElementById('ev-fecha').addEventListener('input', refrescar);
  panel.querySelector('#mq-rol').addEventListener('change', (e) => { M.guardar('mq-rol', e.target.value); location.reload(); });
  panel.querySelector('#mq-reiniciar').addEventListener('click', (e) => { e.preventDefault(); sessionStorage.removeItem('mq-eventos'); location.reload(); });
  if (!location.hash) location.hash = '#agenda';
})();
