/* MAQUETA de Mi espacio (26/10/2026). Arma la carcasa del RPAD (encabezado con sesión, menú lateral y footer) para no copiarla en
   cada hoja, la barra de la maqueta («Ver como») y engancha el menú, las pestañas, los segmentos y la grilla del mes.
   Datos inventados: ninguna persona ni fecha es real. Hoy es el lunes 26/10/2026. */
(() => {
    const svg = (cuerpo, tam = 20) => `<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
    const ICONOS = {
        menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
        inicio: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
        datasets: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
        calendario: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
        correo: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
        capas: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
        rueda: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        reportes: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
        notas: '<path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"/><path d="M15 3v4a2 2 0 0 0 2 2h4"/>',
        proyectos: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><path d="M8 10v4"/><path d="M12 10v2"/><path d="M16 10v6"/>',
        seguimiento: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
        perfil: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        miEspacio: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/>',
        campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
        salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    };
    window.MAQUETA_ICONOS = ICONOS;
    window.maquetaSvg = svg;

    const PERSONAS = {
        permanente: { nombre: 'Laura Gómez', rol: 'Administrador', iniciales: 'LG' },
        contrato: { nombre: 'Sofía Paz', rol: 'Lector', iniciales: 'SP' },
    };
    const leerPersona = () => { try { return localStorage.getItem('maqueta-mi-espacio-persona') || 'permanente'; } catch { return 'permanente'; } };
    const guardarPersona = (p) => { try { localStorage.setItem('maqueta-mi-espacio-persona', p); } catch { /* sin almacenamiento: no pasa nada */ } };

    const link = (href, icono, texto, activo) => `<a href="${href}" class="sidebar-link${activo ? ' active' : ''}"${activo ? ' aria-current="page"' : ''}>${svg(ICONOS[icono])}<span>${texto}</span></a>`;

    function carcasa() {
        const pagina = document.body.dataset.pagina;
        const header = document.getElementById('m-header');
        if (header) {
            header.className = 'header header--con-sesion';
            header.innerHTML = `
                <div class="header-left">
                    <button class="sidebar-toggle" id="sidebarToggle" type="button" aria-label="Abrir el menú" aria-controls="sidebar" aria-expanded="false">${svg(ICONOS.menu, 24)}</button>
                    <a href="index.html" class="header-marca">
                        <img src="img/logo.png" alt="Municipalidad de Comodoro Rivadavia" class="header-logo">
                        <span class="header-marca-texto"><span class="header-title">RPAD</span><span class="header-subtitle">Registro Permanente de Actualización de Datasets</span></span>
                    </a>
                </div>
                <nav class="header-nav" aria-label="Principal"><a href="#">Inicio</a><a href="#">Datasets</a><a href="#">Calendario</a><a href="#">Contacto</a></nav>
                <div class="header-right" id="header-actions">
                    <a href="#" class="header-notification solo-permanente" title="Cambios pendientes">${svg(ICONOS.campana)}</a>
                    <a href="#" class="header-user" title="Mi Perfil">
                        <div class="header-user-info"><div class="header-user-name" id="m-nombre"></div><div class="header-user-role" id="m-rol"></div></div>
                        <div class="header-user-avatar" id="m-iniciales"></div>
                    </a>
                    <button class="btn btn-secondary btn-sm" type="button">${svg(ICONOS.salir, 18)} Salir</button>
                </div>`;
        }
        const aside = document.getElementById('sidebar');
        if (aside) {
            aside.innerHTML = `
                <div class="sidebar-header"><img src="img/logo-2025-blanco.png" alt="Municipalidad de Comodoro Rivadavia" class="sidebar-logo"></div>
                <nav class="sidebar-nav">
                    <div class="sidebar-section">
                        <div class="sidebar-section-title">Administración</div>
                        ${link('#', 'capas', 'Gestión de Datasets')}${link('#', 'correo', 'Correos')}${link('3-feriados.html', 'rueda', 'Configuración', pagina === 'feriados')}
                    </div>
                    <div class="sidebar-section">
                        <div class="sidebar-section-title">Herramientas</div>
                        ${link('#', 'reportes', 'Métricas y Reportes')}${link('#', 'notas', 'Notas')}${link('#', 'proyectos', 'Proyectos')}${link('#', 'seguimiento', 'Seguimiento')}
                    </div>
                    <div class="sidebar-section">
                        <div class="sidebar-section-title">Mi cuenta</div>
                        ${link('#', 'perfil', 'Mi Perfil')}${link('1-mi-espacio.html', 'miEspacio', 'Mi espacio', pagina === 'mi-espacio')}
                    </div>
                </nav>`;
        }
        const footer = document.getElementById('m-footer');
        if (footer) {
            footer.className = 'footer';
            footer.innerHTML = `
                <div class="footer-cuerpo">
                    <div class="footer-marca">
                        <img src="img/logo-2025-blanco.png" alt="Municipalidad de Comodoro Rivadavia" class="footer-logo">
                        <p class="footer-direccion">Dirección de Datos Públicos y Comunicación</p>
                        <p>D. G. de Modernización e Investigación Territorial<br>Subsecretaría de Modernización y Transparencia</p>
                    </div>
                    <div class="footer-columna"><h2 class="footer-titulo">El registro</h2><ul><li><a href="#">Inicio</a></li><li><a href="#">Datasets</a></li><li><a href="#">Calendario</a></li><li><a href="#">Contacto</a></li></ul></div>
                    <div class="footer-columna"><h2 class="footer-titulo">Datos abiertos</h2><ul><li><a href="#">datos.comodoro.gov.ar</a></li><li>Licencia CC BY-SA 4.0</li></ul></div>
                    <div class="footer-columna"><h2 class="footer-titulo">Marco legal</h2><ul><li>Ordenanza N° 17.662/23, artículo 8°</li></ul></div>
                </div>
                <div class="footer-bottom"><span>© 2026 Secretaría de Gobierno, Modernización y Transparencia. Municipalidad de Comodoro Rivadavia</span><span>RPAD v2.0.0</span></div>`;
        }

        // El menú lateral se abre con el botón y se cierra con el velo, como en el RPAD
        const boton = document.getElementById('sidebarToggle');
        const velo = document.getElementById('sidebarOverlay');
        const alternar = (abrir) => {
            aside?.classList.toggle('open', abrir);
            velo?.classList.toggle('visible', abrir);
            boton?.setAttribute('aria-expanded', String(abrir));
        };
        boton?.addEventListener('click', () => alternar(!aside.classList.contains('open')));
        velo?.addEventListener('click', () => alternar(false));
    }

    function barra() {
        const pagina = document.body.dataset.pagina;
        const div = document.createElement('div');
        div.className = 'maqueta-barra';
        const a = (href, clave, texto) => `<a href="${href}"${pagina === clave ? ' aria-current="page"' : ''}>${texto}</a>`;
        div.innerHTML = `<b>MAQUETA</b>${a('index.html', 'indice', 'Índice')}${a('1-mi-espacio.html', 'mi-espacio', '1 · Mi espacio')}${a('2-formularios.html', 'formularios', '2 · Formularios')}${a('3-feriados.html', 'feriados', '3 · Feriados')}${a('4-resumen-opciones.html', 'opciones', '4 · Resumen: opciones')}
            <span>Ver como</span>
            <span class="me-segmento" role="group" aria-label="Ver como">
                <button type="button" data-persona="permanente">Planta permanente</button>
                <button type="button" data-persona="contrato">Contrato</button>
            </span>`;
        document.body.appendChild(div);
        div.querySelectorAll('[data-persona]').forEach((b) => b.addEventListener('click', () => ponerPersona(b.dataset.persona)));
    }

    function ponerPersona(p) {
        const persona = PERSONAS[p] ? p : 'permanente';
        document.body.dataset.persona = persona;
        guardarPersona(persona);
        document.querySelectorAll('.maqueta-barra [data-persona]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.persona === persona)));
        const datos = PERSONAS[persona];
        const poner = (id, texto) => { const el = document.getElementById(id); if (el) el.textContent = texto; };
        poner('m-nombre', datos.nombre); poner('m-rol', datos.rol); poner('m-iniciales', datos.iniciales);
    }

    // Pestañas: [data-pestanas] con botones role=tab y aria-controls; la pestaña viaja en el fragmento
    function pestanas() {
        document.querySelectorAll('[data-pestanas]').forEach((lista) => {
            const tabs = [...lista.querySelectorAll('[role="tab"]')];
            const mostrar = (tab, escribir) => {
                tabs.forEach((t) => {
                    const activa = t === tab;
                    t.setAttribute('aria-selected', String(activa));
                    t.tabIndex = activa ? 0 : -1;
                    const panel = document.getElementById(t.getAttribute('aria-controls'));
                    if (panel) panel.hidden = !activa;
                });
                if (escribir && tab.dataset.hash) history.replaceState(null, '', `#${tab.dataset.hash}`);
            };
            tabs.forEach((t) => t.addEventListener('click', () => mostrar(t, true)));
            const inicial = tabs.find((t) => t.dataset.hash && `#${t.dataset.hash}` === location.hash) || tabs[0];
            if (inicial) mostrar(inicial, false);
        });
    }

    // Segmentos y opciones: [data-segmento="grupo"] con botones data-valor; muestra [data-panel="grupo:valor"]
    // (un panel puede servir a varios valores: data-panel="tipo:a tipo:b")
    function segmentos() {
        document.querySelectorAll('[data-segmento]').forEach((grupo) => {
            const nombre = grupo.dataset.segmento;
            const botones = [...grupo.querySelectorAll('[data-valor]')];
            const elegir = (valor) => {
                botones.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === valor)));
                document.querySelectorAll('[data-panel]').forEach((p) => {
                    const claves = p.dataset.panel.split(' ');
                    if (claves.some((c) => c.startsWith(`${nombre}:`))) p.hidden = !claves.includes(`${nombre}:${valor}`);
                });
            };
            botones.forEach((b) => b.addEventListener('click', () => elegir(b.dataset.valor)));
            const inicial = botones.find((b) => b.getAttribute('aria-pressed') === 'true') || botones[0];
            if (inicial) elegir(inicial.dataset.valor);
        });
        // Elegir varios (personas, filtros): solo cambia la marca
        document.querySelectorAll('[data-varios] [aria-pressed]').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
    }

    /* La grilla del mes. Cuenta los días con Date.UTC sobre las partes de la fecha, como proyectos.js */
    const HOY = '2026-10-26';
    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const texto = (d) => d.toISOString().slice(0, 10);

    // Los eventos de ejemplo. clase: propio, compartido, licencia (lo mío: licencias y francos), feriado, ausente (compañeros)
    const EVENTOS = [
        { fecha: '2026-10-01', clase: 'licencia', texto: 'Licencia: estudios' },
        { fecha: '2026-10-02', clase: 'licencia', texto: 'Licencia: estudios' },
        { fecha: '2026-10-05', clase: 'compartido', texto: '10:00 Reunión de equipo' },
        { fecha: '2026-10-08', clase: 'compartido', texto: '09:30 Mesa con Catastro' },
        { fecha: '2026-10-09', clase: 'ausente', texto: 'Martín R. no está' },
        { fecha: '2026-10-12', clase: 'feriado', texto: 'Feriado: Diversidad Cultural' },
        { fecha: '2026-10-15', clase: 'licencia', texto: 'Franquicia 10 a 12' },
        { fecha: '2026-10-16', clase: 'propio', texto: '11:00 Turno dentista' },
        { fecha: '2026-10-19', clase: 'compartido', texto: '10:00 Reunión de equipo' },
        { fecha: '2026-10-20', clase: 'compartido', texto: '15:00 Capacitación datos abiertos' },
        { fecha: '2026-10-23', clase: 'licencia', texto: 'Franco compensatorio' },
        { fecha: '2026-10-26', clase: 'propio', texto: '12:00 Llamar a Vialidad' },
        { fecha: '2026-10-27', clase: 'compartido', texto: '10:00 Reunión de equipo' },
        { fecha: '2026-10-28', clase: 'propio', texto: '15:30 Turno médico' },
        { fecha: '2026-10-29', clase: 'compartido', texto: '09:00 Entrega del informe trimestral' },
        { fecha: '2026-10-30', clase: 'ausente', texto: 'Sofía P. no está' },
        { fecha: '2026-11-02', clase: 'compartido', texto: '10:00 Reunión de equipo' },
    ];
    // Ausencias de varios días: un renglón por día hábil
    for (const dia of ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']) EVENTOS.push({ fecha: dia, clase: 'ausente', texto: 'Martín R. no está' });
    const FERIADOS = new Set(['2026-10-12']);

    function mes(contenedor) {
        const [anio, numMes] = contenedor.dataset.mes.split('-').map(Number);
        const primero = new Date(Date.UTC(anio, numMes - 1, 1));
        const desplazamiento = (primero.getUTCDay() + 6) % 7; // lunes primero
        const inicio = new Date(Date.UTC(anio, numMes - 1, 1 - desplazamiento));
        const ultimo = new Date(Date.UTC(anio, numMes, 0));
        const finDesplazamiento = 6 - ((ultimo.getUTCDay() + 6) % 7);
        const fin = new Date(Date.UTC(anio, numMes, finDesplazamiento));
        const celdas = DIAS.map((d) => `<div class="me-mes-dia">${d}</div>`);
        for (let d = inicio; d <= fin; d = new Date(d.getTime() + 86400000)) {
            const f = texto(d);
            const otro = d.getUTCMonth() !== numMes - 1;
            const finde = d.getUTCDay() === 0 || d.getUTCDay() === 6;
            const clases = ['me-celda', otro && 'otro-mes', finde && 'finde', FERIADOS.has(f) && 'feriado', f === HOY && 'hoy'].filter(Boolean).join(' ');
            const evs = EVENTOS.filter((e) => e.fecha === f);
            const visibles = evs.slice(0, 3).map((e) => `<span class="me-ev ${e.clase}" title="${e.texto}">${e.texto}</span>`).join('');
            const mas = evs.length > 3 ? `<span class="me-mas">y ${evs.length - 3} más</span>` : '';
            celdas.push(`<div class="${clases}"><span class="me-num">${d.getUTCDate()}</span>${visibles}${mas}</div>`);
        }
        contenedor.innerHTML = celdas.join('');
        const titulo = contenedor.closest('[data-agenda]')?.querySelector('[data-titulo-mes]');
        if (titulo) titulo.textContent = `${MESES[numMes - 1]} ${anio}`;
    }

    document.addEventListener('DOMContentLoaded', () => {
        carcasa();
        barra();
        ponerPersona(leerPersona());
        pestanas();
        segmentos();
        document.querySelectorAll('[data-mes]').forEach(mes);
    });
})();
