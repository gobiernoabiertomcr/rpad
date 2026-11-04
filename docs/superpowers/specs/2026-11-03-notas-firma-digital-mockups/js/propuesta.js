// MAQUETA de la firma digital (03/11/2026): lo nuevo de Correos, sobre la página real. Datos inventados.
(function () {
  const esc = (t) => Utils.escapeHtml(t);
  const fechaCorta = (texto) => { const [, m, d] = String(texto).slice(0, 10).split('-'); return `${d}/${m}`; };
  const TILDE = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  const TIPO = { aviso: 'Aviso', reiteracion: 'Reiteración', autorizacion: 'Autorización', auditoria: 'Auditoría' };
  const GESTION = { interna: 'gestión interna', externa: 'gestión externa' };
  const FIRMANTE = 'Julieta Ferreyra';

  // La fila del Libro: la real, con dos cambios: «Para firmar» y «Firmada digitalmente»
  const filaOriginal = window.filaDelLibro;
  window.filaDelLibro = function (n) {
    let html = filaOriginal(n);
    if (n.espera_firma) {
      html = html.replace(/<span class="co-pastilla pendiente"[^>]*>[^<]*<\/span>/, `<span class="co-pastilla para-firmar">${n.firmado_por ? 'Firmada, sin enviar' : 'Para firmar'}</span><small>hasta las 14:00</small>`);
      html = html.replace(/<button type="button" class="co-btn reintentar"[^>]*>Reintentar<\/button>/, '');
    } else if (n.firmado_por) {
      html = html.replace(/(<span class="co-estado">[\s\S]*?)(<\/span><\/td>)/, `$1<span class="co-firmada" title="Firmada el ${esc(fechaCorta(n.firmado_at))} a las ${esc(n.firmado_at.slice(11, 16))}">${TILDE} Firmada digitalmente por ${esc(n.firmado_por)}</span>$2`);
    }
    return html;
  };

  // Lo último que dijo cada nota al subir su PDF: { id: { bien, texto } }. Y lo que se envió
  const avisos = {};
  const enviadas = [];
  let eligiendo = null;
  const esperan = () => MQ.notas.filter((n) => n.espera_firma);
  const pintarParaFirmar = () => {
    const caja = document.getElementById('nd-para-firmar');
    const lista = esperan();
    if (!lista.length && !enviadas.length) { caja.hidden = true; return; }
    const firmadas = lista.filter((n) => n.firmado_por);
    caja.hidden = false;
    caja.innerHTML = `
      <div class="co-para-firmar-cabeza">
        <div>
          <h2>${lista.length ? 'Notas para firmar hoy' : 'No quedan notas para firmar'}</h2>
          <p class="co-ayuda">${lista.length ? 'Subí cada nota firmada en su fila, revisala y envialas. A las 14:00 sale lo que quede: firmada si la subiste; si no, con la imagen de la firma.' : 'Ya salieron todas las de hoy.'}</p>
        </div>
      </div>
      ${lista.length ? `<ul class="co-para-firmar-lista">${lista.map((n) => `<li>
        <span class="co-numero">${n.numero}/26</span>
        <span class="co-chip ${esc(n.tipo)}">${TIPO[n.tipo]}</span>
        <span>${n.gestion ? GESTION[n.gestion] : ''}</span>
        ${n.firmado_por
          ? `<span class="co-firmada">${TILDE} Firmada por ${esc(n.firmado_por)}</span>
             <span class="co-fila-botones"><button type="button" class="co-btn" data-ver="${n.id}">Ver</button><button type="button" class="co-btn" data-subir="${n.id}">Reemplazar</button></span>`
          : `<span class="co-para-firmar-quien">Falta firmar · la firma ${esc(FIRMANTE)}</span>
             <span class="co-fila-botones"><button type="button" class="co-btn" data-ver="${n.id}">Ver</button><button type="button" class="co-btn primario" data-subir="${n.id}">Subir firmada</button></span>`}
        ${avisos[n.id] ? `<p class="co-fila-aviso ${avisos[n.id].bien ? 'bien' : 'mal'}" role="status">${esc(avisos[n.id].texto)}</p>` : ''}
        ${eligiendo === n.id ? `<div class="mq-elegir">
          <p><b>Maqueta:</b> acá se abre el selector de archivos para la nota ${n.numero}/26. Probá qué pasa con cada caso:</p>
          <button type="button" class="co-btn" data-caso="bien" data-id="${n.id}">Su PDF firmado</button>
          <button type="button" class="co-btn" data-caso="otra" data-id="${n.id}">El PDF firmado de la otra nota</button>
          <button type="button" class="co-btn" data-caso="sin" data-id="${n.id}">Sin firmar</button>
          <button type="button" class="co-btn" data-caso="otro" data-id="${n.id}">Otro PDF</button>
        </div>` : ''}
      </li>`).join('')}</ul>` : ''}
      ${enviadas.length ? `<ul class="co-subidas" role="status">${enviadas.map((t) => `<li class="bien">${esc(t)}</li>`).join('')}</ul>` : ''}
      ${firmadas.length ? `<div class="co-enviar-firmadas"><button type="button" class="co-btn primario" id="btn-enviar-firmadas">${firmadas.length === 1 ? 'Enviar la firmada' : `Enviar las ${firmadas.length} firmadas`}</button><span class="co-para-firmar-quien">Si no las enviás, salen solas a las 14:00, firmadas.</span></div>` : ''}`;
  };

  const subir = (id, caso) => {
    const n = MQ.notas.find((x) => x.id === id);
    const otra = esperan().find((x) => x.id !== id) ?? MQ.notas.find((x) => x.id !== id);
    eligiendo = null;
    delete avisos[id];
    if (caso === 'bien') { pintarParaFirmar(); revisar(n); return; }
    if (caso === 'otra') avisos[id] = { bien: false, texto: `Ese PDF es la Nota Digital N° ${otra.numero}/26, no la ${n.numero}/26. No se guardó nada.` };
    if (caso === 'sin') avisos[id] = { bien: false, texto: 'Ese PDF es esta nota, pero no tiene firma digital. Firmala y volvé a subirla.' };
    if (caso === 'otro') avisos[id] = { bien: false, texto: 'Ese PDF no es esta nota. No se guardó nada.' };
    pintarParaFirmar(); cargarLibro(); cargarEstado();
  };
  // Al subir: se abre con el archivo, para leerlo y confirmar. Hasta «Confirmar» no se guarda nada
  let revisando = null;
  const revisar = (n) => {
    revisando = n;
    document.getElementById('mq-revisar-texto').textContent = `Es la Nota Digital N° ${n.numero}/26, firmada digitalmente por ${FIRMANTE} el 01/12 a las 09:12. La firma no se ve en la hoja. Sale como Nota-Digital-${n.numero}-26.pdf.`;
    document.getElementById('mq-revisar-marco').src = `nota-${n.numero}.pdf`;
    document.getElementById('mq-revisar').classList.add('active');
  };
  const confirmar = () => {
    Object.assign(revisando, { firmado_por: FIRMANTE, firmado_at: `${MQ.HOY} 09:12` });
    avisos[revisando.id] = { bien: true, texto: 'Guardada. Falta enviarla.' };
    revisando = null;
    document.getElementById('mq-revisar').classList.remove('active');
    pintarParaFirmar(); cargarLibro(); cargarEstado();
  };
  const enviar = () => {
    esperan().filter((n) => n.firmado_por).forEach((n) => {
      Object.assign(n, { espera_firma: false, estado: 'enviada', enviada_at: `${MQ.HOY} 09:15:40`, intentos: 1 });
      delete avisos[n.id];
      enviadas.push(`Nota Digital N° ${n.numero}/26: enviada, firmada digitalmente.`);
    });
    pintarParaFirmar(); cargarLibro(); cargarEstado();
  };
  const ver = (id) => {
    const n = MQ.notas.find((x) => x.id === Number(id));
    document.getElementById('mq-ver-titulo').textContent = `Nota Digital N° ${n.numero}/26`;
    document.getElementById('mq-ver-firma').textContent = n.firmado_por
      ? `Firmada digitalmente por ${n.firmado_por} el ${fechaCorta(n.firmado_at)} a las ${n.firmado_at.slice(11, 16)}. La firma no se ve en la hoja: la imagen es la de siempre. Sale como Nota-Digital-${n.numero}-26.pdf.`
      : `Todavía sin firmar. Es la misma nota que llegó adjunta al mail: bajala para firmarla.`;
    document.getElementById('mq-ver-bajar').hidden = Boolean(n.firmado_por);
    document.getElementById('mq-ver-marco').src = `nota-${n.numero}.pdf`;
    document.getElementById('mq-ver').classList.add('active');
  };

  document.addEventListener('DOMContentLoaded', () => {
    // La barra de la maqueta
    document.body.insertAdjacentHTML('afterbegin', `<div class="mq-barra">
      <b>Maqueta con datos inventados</b>
      <a href="mail-firmante.html" target="_blank" rel="noopener">1. El mail de las 8:05</a>
      <a href="#libro">2. Libro: subir, ver y enviar</a>
      <a href="#estado">3. Estado: el interruptor</a>
      <a href="mail-destinatarios.html" target="_blank" rel="noopener">4. El mail a los destinatarios</a>
      <button type="button" onclick="location.reload()">Volver a empezar</button>
    </div>`);

    // El visor de la nota firmada
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="mq-ver"><div class="modal mq-ver" role="dialog" aria-modal="true" aria-labelledby="mq-ver-titulo">
      <div class="modal-header"><h3 id="mq-ver-titulo"></h3><button type="button" class="modal-close" data-cerrar-ver aria-label="Cerrar">&times;</button></div>
      <div class="modal-body"><p id="mq-ver-firma" class="co-ayuda"></p><iframe id="mq-ver-marco" title="La nota firmada"></iframe></div>
      <div class="modal-footer"><button type="button" class="co-btn" data-cerrar-ver>Cerrar</button><button type="button" class="co-btn primario" id="mq-ver-bajar" onclick="alert('En la maqueta no se baja ningún archivo.')">Bajar PDF</button></div>
    </div></div>`);
    document.getElementById('mq-ver').addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar-ver]')) document.getElementById('mq-ver').classList.remove('active');
    });

    // Lo que se abre al subir
    document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="mq-revisar"><div class="modal mq-ver" role="dialog" aria-modal="true" aria-labelledby="mq-revisar-titulo">
      <div class="modal-header"><h3 id="mq-revisar-titulo">Revisá la nota firmada</h3><button type="button" class="modal-close" data-cancelar-revision aria-label="Cancelar">&times;</button></div>
      <div class="modal-body"><p id="mq-revisar-texto" class="co-ayuda"></p><iframe id="mq-revisar-marco" title="El archivo que elegiste"></iframe></div>
      <div class="modal-footer"><button type="button" class="co-btn" data-cancelar-revision>Cancelar</button><button type="button" class="co-btn primario" id="mq-revisar-confirmar">Confirmar</button></div>
    </div></div>`);
    document.getElementById('mq-revisar').addEventListener('click', (e) => {
      if (e.target.closest('#mq-revisar-confirmar')) confirmar();
      else if (e.target.closest('[data-cancelar-revision]')) { revisando = null; document.getElementById('mq-revisar').classList.remove('active'); }
    });

    // La tarjeta «Notas para firmar hoy», arriba del Libro
    document.getElementById('vista-libro').insertAdjacentHTML('afterbegin', '<div class="co-tarjeta co-para-firmar" id="nd-para-firmar" hidden></div>');
    pintarParaFirmar();
    document.getElementById('nd-para-firmar').addEventListener('click', (e) => {
      if (e.target.closest('#btn-enviar-firmadas')) { enviar(); return; }
      const v = e.target.closest('[data-ver]');
      if (v) { ver(v.dataset.ver); return; }
      const sub = e.target.closest('[data-subir]');
      if (sub) { const id = Number(sub.dataset.subir); eligiendo = eligiendo === id ? null : id; pintarParaFirmar(); return; }
      const caso = e.target.closest('[data-caso]');
      if (caso) subir(Number(caso.dataset.id), caso.dataset.caso);
    });

    // El interruptor, en la tarjeta del envío automático
    const envio = document.querySelector('#vista-estado .co-envio');
    envio.querySelector('.co-ayuda').textContent = 'Las notas salen solas a las 8:05 de cada día hábil.';
    envio.insertAdjacentHTML('afterend', `<div class="co-envio">
      <div>
        <h2>Firma digital de las notas</h2>
        <p class="co-ayuda">Cuando está activada, a las 8:05 las notas le llegan a quien firma y esperan hasta las 14:00. Las que no se suban firmadas salen con la imagen de la firma.</p>
      </div>
      <label class="co-switch" for="firma-activa">
        <input type="checkbox" id="firma-activa" role="switch" checked aria-label="Firma digital de las notas">
        <span id="firma-activa-texto" class="badge badge-success">Activada</span>
      </label>
    </div>`);
    document.getElementById('firma-activa').addEventListener('change', (e) => {
      const t = document.getElementById('firma-activa-texto');
      t.textContent = e.target.checked ? 'Activada' : 'Desactivada';
      t.className = `badge ${e.target.checked ? 'badge-success' : 'badge-secondary'}`;
    });
    setTimeout(() => { cargarLibro(); cargarEstado(); }, 0);
  });
})();
