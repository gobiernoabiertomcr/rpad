// MAQUETA (03/11/2026): lo nuevo de la propuesta, sobre la página real (mi-espacio.js sin cambios). En «Cargar licencia» →
// «Horas a favor», las horas acumuladas se suman a las del mes. Dos opciones (?opcion=a o b):
// A. Un total y una tilde: «Completar con mis horas acumuladas»; Mi espacio usa primero las del mes (vencen) y completa.
// B. Dos números: cuántas del mes y cuántas acumuladas.
// Lo nuevo lleva la clase mq-nuevo (con «Marcas: sí», un borde punteado). No guarda nada.
(() => {
  const opcion = new URLSearchParams(location.search).get('opcion') === 'b' ? 'b' : 'a';
  const MES = 6.5;
  const ACUMULADAS = 1.5;
  const coma = (n) => String(n).replace('.', ',');
  const $ = (id) => document.getElementById(id);

  const AYUDA_DE_LA_AUTORIZACION = 'Las horas acumuladas se usan con la autorización del Director General.';

  const avisar = (texto) => {
    const aviso = $('mq-aviso');
    aviso.textContent = texto;
    aviso.classList.add('visible');
    clearTimeout(avisar.t);
    avisar.t = setTimeout(() => aviso.classList.remove('visible'), 2600);
  };

  // ---- A: un total y una tilde ----
  const tildeA = () => $('mq-completar');
  const repartoA = (total) => {
    if (tildeA()?.checked !== true) return { mes: total, acumuladas: 0 };
    const mes = Math.min(total, MES);
    return { mes, acumuladas: Math.round((total - mes) * 2) / 2 };
  };
  const htmlA = () => `
    <div class="mq-nuevo mq-acumuladas" id="mq-acumuladas">
      <label class="me-check"><input type="checkbox" id="mq-completar" aria-describedby="mq-completar-ayuda">
        <span>Completar con mis horas acumuladas
          <small id="mq-completar-ayuda">Tenés ${coma(ACUMULADAS)} h acumuladas de meses anteriores. Se usan primero las ${coma(MES)} de noviembre, que vencen el 30/11. ${AYUDA_DE_LA_AUTORIZACION}</small>
        </span>
      </label>
    </div>`;

  // ---- B: dos números ----
  const opcionesHasta = (maximo) => {
    const lista = ['<option value="0">0</option>'];
    for (let h = 0.5; h <= maximo; h += 0.5) lista.push(`<option value="${h}">${coma(h)}</option>`);
    return lista.join('');
  };
  const repartoB = () => ({ mes: Number($('mq-del-mes')?.value || 0), acumuladas: Number($('mq-de-las-acumuladas')?.value || 0) });
  const htmlB = () => `
    <div class="mq-nuevo mq-dos" id="mq-dos">
      <div class="form-group">
        <label class="form-label" for="mq-del-mes">De noviembre <span class="me-opcional">(quedan ${coma(MES)})</span></label>
        <select class="form-select" id="mq-del-mes">${opcionesHasta(MES)}</select>
      </div>
      <div class="form-group">
        <label class="form-label" for="mq-de-las-acumuladas">Acumuladas <span class="me-opcional">(tenés ${coma(ACUMULADAS)})</span></label>
        <select class="form-select" id="mq-de-las-acumuladas" aria-describedby="mq-dos-ayuda">${opcionesHasta(ACUMULADAS)}</select>
      </div>
      <p class="mq-total" id="mq-total" aria-live="off"></p>
      <p class="form-hint" id="mq-dos-ayuda">${AYUDA_DE_LA_AUTORIZACION}</p>
    </div>`;
  const pintarTotalB = () => {
    const { mes, acumuladas } = repartoB();
    const total = mes + acumuladas;
    const texto = total === 0 ? 'Elegí cuántas horas tomás.'
      : `Total: ${coma(total)} ${total === 1 ? 'hora' : 'horas'}${total === 7 ? ', el día entero' : ''}.`;
    $('mq-total').textContent = total > 7 ? 'El día tiene 7 horas como mucho: bajá alguna de las dos.' : texto;
    $('mq-total').classList.toggle('mq-total-error', total > 7);
    const horas = $('ml-horas');
    horas.value = total > 0 && total <= 7 ? String(total) : '';
    horas.dispatchEvent(new Event('change', { bubbles: true }));
  };

  window.MQ = {
    reparto: (total) => (opcion === 'a' ? repartoA(total) : repartoB()),
    avisar
  };

  // Lo de «Horas a favor»: va dentro del grupo de las horas (#ml-grupo-horas), que pinta mi-espacio.js
  const ponerLoNuevo = () => {
    const grupo = $('ml-grupo-horas');
    const elegido = document.querySelector('#ml-tipos input[name="ml-tipo"]:checked')?.value;
    const esHorasAFavor = elegido === 'horas_a_favor' && !grupo.hidden;
    const hay = $('mq-acumuladas') || $('mq-dos');
    if (!esHorasAFavor) {
      hay?.remove();
      grupo.querySelector('label[for="ml-horas"]').hidden = false;
      $('ml-horas').hidden = false;
      return;
    }
    if (hay) return;
    if (opcion === 'a') {
      grupo.closest('.me-fila-campos').insertAdjacentHTML('afterend', htmlA());
      $('mq-completar').addEventListener('change', () => $('ml-horas').dispatchEvent(new Event('change', { bubbles: true })));
    } else {
      grupo.querySelector('label[for="ml-horas"]').hidden = true;
      $('ml-horas').hidden = true;
      grupo.insertAdjacentHTML('beforeend', htmlB());
      for (const id of ['mq-del-mes', 'mq-de-las-acumuladas']) $(id).addEventListener('change', pintarTotalB);
      pintarTotalB();
    }
  };
  new MutationObserver(ponerLoNuevo).observe($('ml-grupo-horas'), { attributes: true, attributeFilter: ['hidden'] });
  $('ml-tipos').addEventListener('change', () => setTimeout(ponerLoNuevo, 0));

  // A: si se pasa de las del mes sin la tilde, una pista debajo del error
  new MutationObserver(() => {
    const error = $('ml-horas-error');
    const pista = $('mq-pista');
    const hacePista = opcion === 'a' && !error.hidden && /te quedan 6,5 horas a favor/.test(error.textContent) && tildeA()?.checked !== true;
    if (hacePista && !pista) error.insertAdjacentHTML('afterend', `<p class="form-hint mq-nuevo" id="mq-pista">Tenés ${coma(ACUMULADAS)} h acumuladas: tildá «Completar con mis horas acumuladas» para llegar.</p>`);
    if (!hacePista) pista?.remove();
  }).observe($('ml-horas-error'), { attributes: true, childList: true, characterData: true, subtree: true });

  // La pestaña Horas extras: la tarjeta de las acumuladas, con su nombre nuevo, sin «Vuelven a cero el 1/1», y su botón abre
  // «Cargar licencia» con «Horas a favor»
  const ajustarHorasExtras = () => {
    const vista = $('vista-horas');
    for (const h3 of vista.querySelectorAll('.me-tarjeta h3')) {
      if (h3.textContent === 'Horas no utilizadas previamente') {
        h3.textContent = 'Horas acumuladas';
        h3.closest('.me-tarjeta').classList.add('mq-nuevo');
      }
    }
    for (const nota of vista.querySelectorAll('.me-nota')) {
      if (/Vuelven a cero el 1\/1\./.test(nota.textContent)) nota.textContent = 'No vencen: quedan hasta que las uses.';
    }
    for (const boton of vista.querySelectorAll('[data-abrir="uso"]')) {
      if (boton.textContent !== 'Usar horas acumuladas') boton.textContent = 'Usar horas acumuladas';
    }
  };
  new MutationObserver(ajustarHorasExtras).observe($('vista-horas'), { childList: true, subtree: true });
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest?.('[data-abrir="uso"]');
    if (!boton) return;
    evento.stopPropagation();
    evento.preventDefault();
    abrirLicencia({ tipo: 'horas_a_favor', volverA: boton }).then(() => {
      setTimeout(() => {
        if (opcion === 'a' && tildeA()) { tildeA().checked = true; $('ml-horas').dispatchEvent(new Event('change', { bubbles: true })); }
      }, 50);
    });
  }, true);

  // La barra de la maqueta
  document.querySelectorAll('[data-mq-opcion]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mqOpcion === opcion)));
  document.addEventListener('click', (evento) => {
    const el = evento.target.closest?.('button');
    if (!el) return;
    if (el.dataset.mqOpcion) location.href = `?opcion=${el.dataset.mqOpcion}${location.hash}`;
    if (el.id === 'mq-marcas') {
      const sin = document.body.classList.toggle('mq-sin-marcas');
      el.setAttribute('aria-pressed', String(!sin));
      el.textContent = sin ? 'Marcas: no' : 'Marcas: sí';
    }
    if (el.id === 'mq-abrir') abrirLicencia({ tipo: 'horas_a_favor', volverA: el });
  });
})();
