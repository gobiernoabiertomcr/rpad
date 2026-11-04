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

  const resultados = [];
  const esperan = () => MQ.notas.filter((n) => n.espera_firma);
  const pintarParaFirmar = () => {
    const caja = document.getElementById('nd-para-firmar');
    const lista = esperan();
    if (!lista.length && !resultados.length) { caja.hidden = true; return; }
    const firmadas = lista.filter((n) => n.firmado_por);
    caja.hidden = false;
    caja.innerHTML = `
      <div class="co-para-firmar-cabeza">
        <div>
          <h2>${lista.length ? 'Notas para firmar hoy' : 'No quedan notas para firmar'}</h2>
          <p class="co-ayuda">${lista.length ? 'Subilas firmadas, revisalas y envialas. A las 14:00 sale lo que quede: firmada si la subiste; si no, con la imagen de la firma.' : 'Ya salieron todas las de hoy.'}</p>
        </div>
        ${lista.length ? '<button type="button" class="co-btn" id="btn-subir-firmadas">Subir firmadas</button>' : ''}
      </div>
      ${lista.length ? `<ul class="co-para-firmar-lista">${lista.map((n) => `<li>
        <span class="co-numero">${n.numero}/26</span>
        <span class="co-chip ${esc(n.tipo)}">${TIPO[n.tipo]}</span>
        <span>${n.gestion ? GESTION[n.gestion] : ''}</span>
        ${n.firmado_por
          ? `<span class="co-firmada">${TILDE} Firmada por ${esc(n.firmado_por)}</span><button type="button" class="co-btn" data-ver="${n.id}">Ver</button>`
          : `<span class="co-para-firmar-quien">Falta firmar · la firma ${esc(FIRMANTE)}</span><button type="button" class="co-btn" data-bajar="${n.id}">Bajar PDF</button>`}
      </li>`).join('')}</ul>` : ''}
      <div id="mq-elegir" class="mq-elegir" hidden>
        <p><b>Maqueta:</b> acá se abre el selector de archivos, donde elegís uno o varios PDF. Probá qué pasa con cada caso:</p>
        <button type="button" class="co-btn" data-caso="bien">La 12/26 firmada (<code>document.pdf</code>)</button>
        <button type="button" class="co-btn" data-caso="dos">Las dos, firmadas</button>
        <button type="button" class="co-btn" data-caso="sin">Una sin firmar</button>
        <button type="button" class="co-btn" data-caso="otro">Otro PDF</button>
      </div>
      ${resultados.length ? `<ul class="co-subidas" role="status">${resultados.map((r) => `<li class="${r.bien ? 'bien' : 'mal'}"><code>${esc(r.archivo)}</code>${esc(r.texto)}</li>`).join('')}</ul>` : ''}
      ${firmadas.length ? `<div class="co-enviar-firmadas"><button type="button" class="co-btn primario" id="btn-enviar-firmadas">${firmadas.length === 1 ? 'Enviar la firmada' : `Enviar las ${firmadas.length} firmadas`}</button><span class="co-para-firmar-quien">Si no las enviás, salen solas a las 14:00, firmadas.</span></div>` : ''}`;
  };

  const guardar = (id, archivo) => {
    const n = MQ.notas.find((x) => x.id === id);
    if (!n || !n.espera_firma) return;
    Object.assign(n, { firmado_por: FIRMANTE, firmado_at: `${MQ.HOY} 09:12` });
    resultados.push({ bien: true, archivo, texto: `: es la Nota Digital N° ${n.numero}/26, firmada digitalmente por ${FIRMANTE}. Revisala y enviala.` });
  };
  const subir = (caso) => {
    resultados.length = 0;
    if (caso === 'bien') guardar(12, 'document.pdf');
    if (caso === 'dos') esperan().forEach((n, i) => guardar(n.id, i ? `document (${i}).pdf` : 'document.pdf'));
    if (caso === 'sin') resultados.push({ bien: false, archivo: 'Nota-Digital-13-26.pdf', texto: ': es la Nota Digital N° 13/26, pero no tiene firma digital. Firmala y volvé a subirla.' });
    if (caso === 'otro') resultados.push({ bien: false, archivo: 'document.pdf', texto: ': no es ninguna de las notas para firmar hoy.' });
    pintarParaFirmar(); cargarLibro(); cargarEstado();
  };
  const enviar = () => {
    resultados.length = 0;
    esperan().filter((n) => n.firmado_por).forEach((n) => {
      Object.assign(n, { espera_firma: false, estado: 'enviada', enviada_at: `${MQ.HOY} 09:15:40`, intentos: 1 });
      resultados.push({ bien: true, archivo: `Nota Digital N° ${n.numero}/26`, texto: ': enviada, firmada digitalmente.' });
    });
    pintarParaFirmar(); cargarLibro(); cargarEstado();
  };
  const ver = (id) => {
    const n = MQ.notas.find((x) => x.id === Number(id));
    document.getElementById('mq-ver-titulo').textContent = `Nota Digital N° ${n.numero}/26`;
    document.getElementById('mq-ver-firma').textContent = `Firmada digitalmente por ${n.firmado_por} el ${fechaCorta(n.firmado_at)} a las ${n.firmado_at.slice(11, 16)}. La firma no se ve en la hoja: la imagen es la de siempre.`;
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
      <div class="modal-footer"><button type="button" class="co-btn" data-cerrar-ver>Cerrar</button></div>
    </div></div>`);
    document.getElementById('mq-ver').addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar-ver]')) document.getElementById('mq-ver').classList.remove('active');
    });

    // La tarjeta «Notas para firmar hoy», arriba del Libro
    document.getElementById('vista-libro').insertAdjacentHTML('afterbegin', '<div class="co-tarjeta co-para-firmar" id="nd-para-firmar" hidden></div>');
    pintarParaFirmar();
    document.getElementById('nd-para-firmar').addEventListener('click', (e) => {
      if (e.target.closest('#btn-subir-firmadas')) { const c = document.getElementById('mq-elegir'); c.hidden = !c.hidden; return; }
      if (e.target.closest('#btn-enviar-firmadas')) { enviar(); return; }
      const v = e.target.closest('[data-ver]');
      if (v) { ver(v.dataset.ver); return; }
      const bajar = e.target.closest('[data-bajar]');
      if (bajar) { alert('Baja la misma nota que llegó adjunta al mail.'); return; }
      const caso = e.target.closest('[data-caso]');
      if (caso) subir(caso.dataset.caso);
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
