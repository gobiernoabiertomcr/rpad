/* MAQUETA (27/10/2026): lo que hace andar la página de muestra. La carcasa (el menú lateral, las pestañas, la persona del
   encabezado), la barra de abajo (la opción y el estado, que viajan en la dirección: ?opcion=2&estado=contrato) y las ayudas que
   usan las cuatro opciones: escapar, contar un número hacia arriba y saber si la persona pidió menos movimiento. Cada opción se
   registra en Maqueta.opciones con { nombre, idea, dibujar(resumen) → HTML, animar(raiz, resumen) }. */
(() => {
    const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    // Menos movimiento: lo pide la persona (prefers-reduced-motion) o la dirección (?quieto=1, para ver cómo queda quieta)
    const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
        || new URLSearchParams(location.search).get('quieto') === '1';
    const iniciales = (nombre) => {
        const p = String(nombre).trim().split(/\s+/);
        return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    };
    // '1,5' → 1.5; lo que no es un número, null
    const numeroDe = (texto) => {
        const n = Number(String(texto).replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    };
    const conComa = (n, decimales) => (decimales ? n.toFixed(1).replace('.', ',').replace(/,0$/, '') : String(Math.round(n)));

    // Cuenta de 0 al número que ya tiene el elemento (que queda tal cual al final: el texto real nunca cambia de forma)
    const contar = (el, { ms = 900, demora = 0, desde = 0 } = {}) => {
        const final = el.dataset.final ?? el.textContent;
        el.dataset.final = final;
        const hasta = numeroDe(final);
        if (hasta === null || reducido()) { el.textContent = final; return; }
        const decimales = !Number.isInteger(hasta);
        const inicio = performance.now() + demora;
        el.textContent = conComa(desde, decimales);
        const paso = (t) => {
            const x = Math.min(1, Math.max(0, (t - inicio) / ms));
            const e = 1 - Math.pow(1 - x, 3);
            el.textContent = x >= 1 ? final : conComa(desde + (hasta - desde) * e, decimales && x > 0.6);
            if (x < 1) requestAnimationFrame(paso);
        };
        requestAnimationFrame(paso);
    };

    const aviso = (texto) => {
        const el = document.getElementById('mq-aviso');
        el.textContent = texto;
        el.classList.add('visible');
        clearTimeout(aviso.t);
        aviso.t = setTimeout(() => el.classList.remove('visible'), 2600);
    };

    const Maqueta = {
        opciones: {},
        esc, reducido, contar, iniciales, numeroDe, aviso,
        opcion: '2', estado: 'planta',

        // El contexto de arriba (la modalidad y el año), como en la página real
        contexto: (r) => `<p class="me-contexto"><span><b>${esc(r.modalidad.texto)}</b></span><span>Año ${esc(r.anio)}</span></p>`,
        faltantes: (r) => (r.faltantes.length ? `<p class="me-aviso me-aviso-ambar">${esc(r.faltantes[0])}</p>` : ''),

        dibujar() {
            const est = window.ESTADOS[this.estado];
            const op = this.opciones[this.opcion];
            const raiz = document.getElementById('vista-resumen');
            document.body.dataset.opcion = this.opcion;
            raiz.className = `o${this.opcion}`;
            raiz.innerHTML = op.dibujar(est.resumen);
            document.getElementById('me-marca').innerHTML = est.resumen.marca
                ? '<span class="me-marca" role="img" aria-label="Hay algo que vence pronto"></span>' : '';
            // La persona del encabezado y el menú lateral
            document.getElementById('header-nombre').textContent = est.persona.nombre;
            document.getElementById('header-rol').textContent = est.persona.rol;
            document.getElementById('header-iniciales').textContent = iniciales(est.persona.nombre);
            document.getElementById('header-campana').hidden = !est.persona.admin;
            document.getElementById('sidebarAdmin').hidden = !est.persona.admin;
            document.getElementById('sidebarNotas').hidden = !est.persona.admin;
            document.getElementById('mq-idea').innerHTML = `<b>${esc(op.nombre)}.</b> ${esc(op.idea)} <span class="mq-sep">Estado:</span> ${esc(est.idea)}`;
            document.title = `${op.nombre}: Mi espacio - RPAD (maqueta)`;
            if (typeof op.animar === 'function') requestAnimationFrame(() => op.animar(raiz, est.resumen));
        },

        barra() {
            const opciones = document.getElementById('mq-opciones');
            opciones.innerHTML = Object.entries(this.opciones).map(([clave, op]) =>
                `<button type="button" data-opcion="${clave}" aria-pressed="${clave === this.opcion}">${clave} · ${esc(op.nombre)}</button>`).join('');
            const estados = document.getElementById('mq-estados');
            estados.innerHTML = Object.entries(window.ESTADOS).map(([clave, est]) =>
                `<button type="button" data-estado="${clave}" aria-pressed="${clave === this.estado}">${esc(est.etiqueta)}</button>`).join('');
        },

        guardarEnLaDireccion() {
            const params = new URLSearchParams({ opcion: this.opcion, estado: this.estado });
            if (new URLSearchParams(location.search).get('quieto') === '1') params.set('quieto', '1');
            history.replaceState(null, '', `?${params}${location.hash}`);
        },

        pestana(nombre) {
            document.querySelectorAll('.me-pestana').forEach((tab) => {
                const si = tab.dataset.pestana === nombre;
                tab.setAttribute('aria-selected', String(si));
                tab.tabIndex = si ? 0 : -1;
                document.getElementById(tab.getAttribute('aria-controls')).hidden = !si;
            });
            history.replaceState(null, '', `${location.search}#${nombre}`);
            if (nombre === 'resumen') this.dibujar();
        },

        iniciar() {
            const params = new URLSearchParams(location.search);
            if (this.opciones[params.get('opcion')]) this.opcion = params.get('opcion');
            if (window.ESTADOS[params.get('estado')]) this.estado = params.get('estado');
            this.barra();
            this.dibujar();
            const hash = location.hash.slice(1);
            if (['licencias', 'horas', 'agenda'].includes(hash)) this.pestana(hash);

            document.getElementById('mq-opciones').addEventListener('click', (e) => {
                const b = e.target.closest('[data-opcion]');
                if (!b) return;
                this.opcion = b.dataset.opcion;
                this.barra(); this.guardarEnLaDireccion(); this.pestana('resumen');
                document.querySelector(`#mq-opciones [data-opcion="${this.opcion}"]`).focus();
            });
            document.getElementById('mq-estados').addEventListener('click', (e) => {
                const b = e.target.closest('[data-estado]');
                if (!b) return;
                this.estado = b.dataset.estado;
                this.barra(); this.guardarEnLaDireccion(); this.pestana('resumen');
                document.querySelector(`#mq-estados [data-estado="${this.estado}"]`).focus();
            });
            document.getElementById('mq-repetir').addEventListener('click', () => this.pestana('resumen'));

            // Las pestañas y los links a una pestaña (los tanques, las barras)
            document.addEventListener('click', (e) => {
                const destino = e.target.closest('[data-pestana]');
                if (destino) { e.preventDefault(); this.pestana(destino.dataset.pestana); document.getElementById(`tab-${destino.dataset.pestana}`).focus(); return; }
                const accion = e.target.closest('[data-maqueta-accion]');
                if (accion) aviso(`En la página real abre «${accion.dataset.maquetaAccion}». La maqueta no guarda nada.`);
            });

            // El menú lateral (el de main.js: el botón, el velo y Escape)
            const sidebar = document.getElementById('sidebar');
            const velo = document.getElementById('sidebarOverlay');
            const boton = document.getElementById('sidebarToggle');
            const abrir = (si) => {
                sidebar.classList.toggle('open', si);
                velo.classList.toggle('visible', si);
                boton.setAttribute('aria-expanded', String(si));
            };
            boton.addEventListener('click', () => abrir(!sidebar.classList.contains('open')));
            velo.addEventListener('click', () => abrir(false));
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') abrir(false); });
            requestAnimationFrame(() => [sidebar, velo, boton].forEach((el) => el.classList.add('menu-animable')));
        },
    };
    window.Maqueta = Maqueta;
})();
