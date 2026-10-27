/* Opción 3 · Horizonte (opcion-3.css). Necesita del servidor, además de lo de hoy, la fecha hasta la que vale cada cosa (`hasta`
   de cada capa y de cada tope, el mes de uso de cada franco) y la del feriado: datos.js los trae marcados como nuevos. Al abrir,
   la línea de hoy baja y cada barra crece desde hoy hasta su fecha, carril por carril. */
(() => {
    const { esc } = Maqueta;
    const INICIO = '2026-10-01';
    const FIN = '2028-01-01'; // exclusivo: el eje termina el 31/12/2027
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const dias = (a, b) => {
        const [y1, m1, d1] = a.split('-').map(Number);
        const [y2, m2, d2] = b.split('-').map(Number);
        return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
    };
    // El eje se acerca a lo próximo: octubre a diciembre de 2026 ocupan el 45 % del ancho y 2027 el resto (lo que vence pronto
    // necesita lugar; lo de 2027 se lee igual)
    const CORTE = '2027-01-01';
    const PARTE = 45;
    const pct = (fecha) => {
        const v = fecha < CORTE
            ? (dias(INICIO, fecha) / dias(INICIO, CORTE)) * PARTE
            : PARTE + (dias(CORTE, fecha) / dias(CORTE, FIN)) * (100 - PARTE);
        return Math.max(0, Math.min(100, v));
    };
    const masUno = (fecha) => { const [y, m, d] = fecha.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + 1)); return t.toISOString().slice(0, 10); };
    const finDeMes = (mes) => { const [y, m] = mes.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); };
    const corta = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

    // Una barra de `desde` a `hasta` (inclusive), con su texto adentro o, si no entra, al lado
    const barra = (clase, desde, hasta, texto, { afuera = '' } = {}) => {
        const izq = pct(desde);
        const der = pct(masUno(hasta));
        const sigue = hasta >= FIN ? ' sigue' : '';
        return `<span class="o3-barra ${clase}${sigue}" style="left:${izq}%;width:${Math.max(0.6, der - izq)}%">${esc(texto)}${afuera ? `<span class="afuera">${esc(afuera)}</span>` : ''}</span>`;
    };
    const carril = ({ nombre, sub, barras, aria, pestana = 'licencias', vence = false }) =>
        `<a class="o3-carril${vence ? ' vence' : ''}" href="#${pestana}" data-pestana="${pestana}" aria-label="${esc(aria)}">`
        + `<span class="o3-nombre"><b>${esc(nombre)}</b><small>${esc(sub)}</small></span><span class="o3-pista" aria-hidden="true">${barras}</span></a>`;
    const grupo = (texto) => `<div class="o3-grupo" aria-hidden="true"><span>${esc(texto)}</span><span></span></div>`;

    function eje(r) {
        const meses = [];
        for (let i = 0; i < 15; i++) {
            const y = 2026 + Math.floor((9 + i) / 12);
            const m = (9 + i) % 12;
            const fecha = `${y}-${String(m + 1).padStart(2, '0')}-01`;
            meses.push({ fecha, texto: m === 0 ? String(y) : MESES[m], anio: m === 0 });
        }
        const etiquetas = meses.map((m) => `<span class="o3-mes${m.anio ? ' anio' : ''}" style="left:${pct(m.fecha)}%">${m.texto}</span>`).join('');
        const lineas = meses.map((m) => `<span class="o3-linea-mes${m.anio ? ' anio' : ''}" style="left:${pct(m.fecha)}%"></span>`).join('');
        const f = r.hoy_y_manana.proximo_feriado;
        return {
            eje: `<div class="o3-eje" aria-hidden="true"><span></span><span class="o3-eje-pista">${etiquetas}`
                + `<span class="o3-marca-hoy" style="left:${pct(r.hoy)}%">Hoy</span>`
                + `<span class="o3-pin" style="left:${pct(f.fecha)}%" title="${esc(f.cuando)}: ${esc(f.nombre)}"></span></span></div>`,
            fondo: `<div class="o3-fondo" aria-hidden="true">${lineas}<span class="o3-pared" style="left:${pct('2027-01-01')}%"></span>`
                + `<span class="o3-linea-hoy" style="left:${pct(r.hoy)}%"></span></div>`,
        };
    }

    function carriles(r) {
        const hoyMas = r.hoy;
        const filas = [grupo('Vacaciones')];
        for (const c of r.tanques.vacaciones.capas) {
            if (c.clase === 'por_habilitar') {
                filas.push(carril({ nombre: 'Todavía no', sub: `${c.de}: se habilitan el 1/1/2027`, aria: `Todavía no: ${c.n} días de la ${c.de}, que se habilitan el 1/1/2027. Ver tus licencias`, barras: barra('por_habilitar', c.desde, c.hasta, `${c.n} días`) }));
            } else if (c.clase === 'cargadas') {
                filas.push(carril({ nombre: 'Ya cargados', sub: `Del ${corta(c.desde)} al ${corta(c.hasta)}`, aria: `${c.n} días de vacaciones cargados del ${corta(c.desde)} al ${corta(c.hasta)}. Ver tus licencias`, barras: barra('cargadas', c.desde, c.hasta, '', { afuera: `${c.n} días` }) }));
            } else {
                const vence = c.clase === 'vence';
                filas.push(carril({
                    nombre: c.nombre, sub: c.nota, vence,
                    aria: `${c.nombre}: ${c.n} días. ${c.nota}. Ver tus licencias`,
                    barras: barra(c.clase, hoyMas, c.hasta, `${c.n} días`, { afuera: vence ? `vencen el ${corta(c.hasta)}` : '' }),
                }));
            }
        }
        const otros = r.tanques.otros.filter((t) => t.clave !== 'horas_a_favor');
        if (otros.length) filas.push(grupo(`De ${r.anio}: vuelven a cero el 1/1`));
        for (const t of otros) {
            filas.push(carril({ nombre: t.nombre, sub: t.de, aria: t.aria, barras: barra('tope', hoyMas, t.hasta, `${t.numero} ${t.unidad}`) }));
        }
        const p = r.pastillas;
        if (p.meses.length || p.previo) {
            filas.push(grupo(p.titulo));
            const barras = p.meses.map((m) => barra(m.estado === 'vence' ? 'vence' : m.estado, m.mes_de_uso + '-01' < r.hoy ? r.hoy : m.mes_de_uso + '-01', finDeMes(m.mes_de_uso), m.numero)).join('');
            const sub = p.previo ? `Y ${p.previo.numero} de ${p.previo.titulo.toLowerCase()}, no ${r.modalidad.clave === 'planta' ? 'utilizado' : 'utilizadas'} previamente` : 'Cada uno, en su mes';
            const aria = `${p.titulo}: ${p.meses.map((m) => `${m.numero} en ${m.mes.toLowerCase()} (${m.nota})`).join(', ')}. Ver tus horas extras`;
            filas.push(carril({ nombre: 'Para usar en su mes', sub, aria, pestana: 'horas', vence: p.meses.some((m) => m.estado === 'vence'), barras }));
        }
        return filas.join('');
    }

    function ahora(r) {
        const lista = r.vence_pronto;
        const vence = lista.length ? `<section class="o3-tarjeta" aria-labelledby="o3-vence-titulo"><h2 id="o3-vence-titulo">Vence pronto</h2><ol class="o3-vence">${lista.map((c, i) =>
            `<li><span class="o3-chip" aria-hidden="true"><b>${esc(c.dia)}</b>${esc(c.mes)}</span><span class="o3-vence-texto"><b id="o3-v-${i}">${esc(c.titulo)}</b><span>${esc(c.cuando)}, faltan ${esc(c.faltan)} días. ${esc(c.detalle)}</span></span>`
            + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-maqueta-accion="Cargar licencia" aria-describedby="o3-v-${i}">${esc(c.accion.texto)}</button></li>`).join('')}</ol></section>` : '';
        const h = r.hoy_y_manana;
        const dia = (titulo, clave, ausentes) => {
            const filas = h.eventos.filter((e) => e.dia === clave).map((e) => `<li><time>${esc(e.hora)}</time><span>${esc(e.titulo)}<small>${esc(e.detalle.split(' · ')[1])}</small></span></li>`);
            if (r.persona.ve_companeros) ausentes.forEach((a) => filas.push(`<li><span class="o3-fuera" aria-hidden="true">${esc(Maqueta.iniciales(a.nombre))}</span><span>${esc(a.texto)}<small>${esc(a.vuelve_texto)}</small></span></li>`));
            return `<div class="o3-dia"><h3>${titulo}</h3>${filas.length ? `<ul>${filas.join('')}</ul>` : '<p class="nada">Nada en tu agenda.</p>'}</div>`;
        };
        const f = h.proximo_feriado;
        const hoyYManana = `<section class="o3-tarjeta" aria-labelledby="o3-hoy-titulo"><h2 id="o3-hoy-titulo">Hoy y mañana</h2>`
            + (h.eventos.length || (r.persona.ve_companeros && (h.ausentes_hoy.length || h.ausentes_manana.length))
                ? `<div class="o3-dias">${dia('Hoy, martes 27/10', 'hoy', h.ausentes_hoy)}${dia('Mañana, miércoles 28/10', 'manana', h.ausentes_manana)}</div>` : '')
            + `<p class="o3-feriado">Próximo feriado: <b>${esc(f.cuando)}</b>, ${esc(f.nombre)}.</p>`
            + '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a></section>';
        return `<div class="o3-ahora${vence ? '' : ' solo'}">${vence}${hoyYManana}</div>`;
    }

    function animar(raiz) {
        if (Maqueta.reducido()) return;
        const linea = raiz.querySelector('.o3-linea-hoy');
        linea.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 500, delay: 150, easing: 'ease-out', fill: 'backwards' });
        raiz.querySelectorAll('.o3-carril').forEach((c, i) => {
            c.querySelectorAll('.o3-barra').forEach((b, j) => {
                b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 900, delay: 450 + i * 70 + j * 120, easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)', fill: 'backwards' });
            });
        });
        raiz.querySelector('.o3-pared').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 1300, fill: 'backwards' });
    }

    Maqueta.opciones['3'] = {
        nombre: 'Horizonte',
        idea: 'Arriba, lo de ahora. Abajo, todo lo que tenés dibujado hasta la fecha en que vence: hoy marcado y la pared del 31/12, cuando vence la licencia 2024 y los topes vuelven a cero.',
        dibujar: (r) => {
            const { eje: e, fondo } = eje(r);
            return Maqueta.contexto(r) + ahora(r) + Maqueta.faltantes(r)
                + `<section class="o3-horizonte" aria-labelledby="o3-h-titulo"><div class="o3-cabeza"><h2 id="o3-h-titulo">Lo que te queda, y hasta cuándo</h2><span>${esc(r.al_texto)}</span>`
                + '<button type="button" class="sg-link" data-maqueta-accion="Mis vacaciones y saldos">Mis vacaciones y saldos</button></div>'
                + `<p class="o3-bajada">Cada barra empieza hoy y termina el día en que vence. Te quedan ${esc(r.tanques.vacaciones.numero)} días de vacaciones. Los meses que vienen se ven más anchos que los de 2027.</p>`
                + `<div class="o3-marco"><div class="o3-grafico">${e}${fondo}${carriles(r)}`
                + '</div></div>'
                + `<p class="o3-extra"><span class="o3-muestra-pared" aria-hidden="true"></span>${r.tanques.vacaciones.capas.some((c) => c.clase === 'vence') ? 'El 31/12 vence la licencia 2024 y los topes vuelven a cero.' : 'El 31/12 los topes vuelven a cero.'} ${esc(r.extraordinaria)}</p></section>`;
        },
        animar,
    };
})();
