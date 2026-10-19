// Encabezado, footer y utilidades comunes de los mockups (solo para ver el diseño)
const ICONO_INGRESAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>';
const OLA = '<svg class="ola" viewBox="0 0 1200 24" preserveAspectRatio="none" aria-hidden="true"><path d="M0 16 C 100 6, 200 6, 300 14 S 500 24, 600 14 S 800 4, 900 12 S 1100 22, 1200 12 V24 H0 Z" fill="currentColor"/></svg>';
function encabezado(activo) {
  const links = [['portada.html', 'Inicio'], ['datasets.html', 'Datasets'], ['calendario.html', 'Calendario'], ['#', 'Contacto']];
  return `<header class="encabezado"><div class="contenedor">
    <a class="marca" href="portada.html"><img src="../../../../public/img/logo.png" alt="Municipalidad de Comodoro Rivadavia"><span class="marca-sep" aria-hidden="true"></span><span class="marca-texto"><strong>RPAD</strong><span>Registro Permanente de Actualización de Datasets</span></span></a>
    <nav class="nav-principal" aria-label="Principal">${links.map(([h, t]) => `<a href="${h}"${t === activo ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
    <a class="btn btn-tinta btn-ingresar" href="#">${ICONO_INGRESAR}Ingresar</a>
    <button class="btn-menu" aria-label="Abrir el menú"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" x2="20" y1="7" y2="7"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="17" y2="17"/></svg></button>
  </div></header>`;
}
function footer() {
  return `<footer class="pie"><div class="contenedor pie-cuerpo">
    <div class="pie-marca"><img src="../../../../public/img/logo-2025-blanco.png" alt="Municipalidad de Comodoro Rivadavia"><strong>Dirección de Datos Públicos y Comunicación</strong><p>D. G. de Modernización e Investigación Territorial<br>Subsecretaría de Modernización y Transparencia</p></div>
    <div><h3>El registro</h3><ul><li><a href="portada.html">Inicio</a></li><li><a href="datasets.html">Datasets</a></li><li><a href="calendario.html">Calendario</a></li><li><a href="#">Contacto</a></li></ul></div>
    <div><h3>Datos abiertos</h3><ul><li><a href="#">datos.comodoro.gov.ar</a></li><li>Licencia CC BY-SA 4.0</li></ul></div>
    <div><h3>Marco legal</h3><ul><li>Ordenanza N° 17.662/23, artículo 8°</li></ul></div>
  </div><div class="pie-base"><div class="contenedor"><span>© 2026 Secretaría de Gobierno, Modernización y Transparencia. Municipalidad de Comodoro Rivadavia</span><span>RPAD v2.0.0</span></div></div></footer>`;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const HOY = '2026-10-18';
const ESTADO = {
  actualizado: ['Actualizado', 'badge-success'], proximo: ['Próximo', 'badge-warning'], atrasado: ['Atrasado', 'badge-danger'],
  'sin-respuesta': ['Sin respuesta', 'badge-sin-respuesta'], eventual: ['Eventual', 'badge-secondary'], 'sin-fecha': ['Sin fecha', 'badge-secondary'],
};
const mesCorto = v => { const t = String(v || '').slice(0, 10); if (!/^\d{4}-\d{2}/.test(t)) return null; return `${MESES[Number(t.slice(5, 7)) - 1].slice(0, 3)} ${t.slice(0, 4)}`; };
