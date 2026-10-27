/* Opción 1 · Niveles vivos. Lo mismo que la página real (opcion-1.css), con tres cambios:
   - «Vence pronto»: cada cosa en su tarjeta, con una hoja de calendario y cuánto falta («Faltan 3 días»: nuevo dato);
   - los tanques son de vidrio y se llenan con una ola, con los números subiendo con ellos (el único movimiento de la página,
     junto con las hojas que caen; quietos con prefers-reduced-motion);
   - «Hoy y mañana» pasa a ser la columna del día, en tinta: quién no está, tu agenda (entrega 3) y el próximo feriado. */
(() => {
    const { esc } = Maqueta;
    const GRANDE = { ancho: 100, alto: 196, radio: 24 };
    const CHICO = { ancho: 60, alto: 124, radio: 18 };
    const CLASE = { vence: 'c-vence', tinta: 'c-tinta', medio: 'c-medio', cargadas: 'c-cargadas', por_habilitar: 'c-por-habilitar' };

    // La ola: una banda con crestas cada L, más ancha que el tanque (de -L a ancho + 2L) para correrla una longitud sin cortes
    const ola = (ancho, y, amp, L) => {
        let d = `M${-L} ${y}`;
        for (let x = -L; x < ancho + 2 * L; x += L) d += ` q${L / 4} ${-amp} ${L / 2} 0 t${L / 2} 0`;
        return `${d} V${y + amp + 6} H${-L} Z`;
    };

    function tanque({ capas, capacidad, ancho, alto, radio, id }) {
        const tope = capacidad > 0 ? capacidad : 1;
        const y = (acum) => Math.round((alto - (Math.min(acum, tope) / tope) * alto) * 10) / 10;
        let acum = 0;
        let arriba = alto;
        let claseDeArriba = null;
        const rects = capas.map((capa, i) => {
            const abajo = y(acum);
            acum += capa.n;
            const sube = y(acum);
            const clase = CLASE[capa.clase] || 'c-tinta';
            const relleno = clase === 'c-cargadas' ? ` fill="url(#${id}-rayas)"` : '';
            if (capa.clase !== 'por_habilitar') { arriba = sube; claseDeArriba = { clase, relleno }; }
            return `<rect data-capa="${i}" class="${clase}"${relleno} x="0" y="${sube}" width="${ancho}" height="${(abajo - sube).toFixed(1)}"/>`;
        });
        const L = Math.round(ancho * 0.8);
        const cresta = claseDeArriba && arriba > 4
            ? `<g class="o1-ola-y" style="transform-origin: 50% ${arriba + 4}px"><path class="o1-ola ${claseDeArriba.clase}"${claseDeArriba.relleno} d="${ola(ancho, arriba, 4, L)}" style="--l:${-L}px"/></g>`
            : '';
        return `<svg class="o1-tanque" viewBox="0 0 ${ancho} ${alto + 10}" width="${ancho}" height="${alto + 10}" aria-hidden="true" focusable="false">`
            + `<defs><clipPath id="${id}"><rect width="${ancho}" height="${alto}" rx="${radio}"/></clipPath>`
            + `<pattern id="${id}-rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><rect width="3" height="6" fill="#1A365D"/></pattern></defs>`
            + `<ellipse class="o1-sombra" cx="${ancho / 2}" cy="${alto + 4}" rx="${ancho / 2 - 4}" ry="4"/>`
            + `<rect class="t-fondo" width="${ancho}" height="${alto}" rx="${radio}"/>`
            + `<g clip-path="url(#${id})"><g class="o1-liquido" style="--alto:${alto}px">${rects.join('')}${cresta}</g>`
            + `<rect class="t-brillo" x="${Math.round(ancho * 0.12)}" y="8" width="${Math.max(5, Math.round(ancho * 0.09))}" height="${alto - 16}" rx="4"/></g>`
            + `<rect class="t-borde" x="1" y="1" width="${ancho - 2}" height="${alto - 2}" rx="${radio - 1}"/></svg>`;
    }

    const nivel = (t, { nombre, pie, svg, vence, chico }) => {
        const pestana = t.pestana === 'horas' ? 'horas' : 'licencias';
        return `<a class="o1-nivel${vence ? ' vence' : ''}" href="#${pestana}" data-pestana="${pestana}" aria-label="${esc(t.aria)}">`
            + `<span class="o1-num${chico ? ' chico' : ''}"><b data-contar>${esc(t.numero)}</b><span>${esc(t.unidad)}</span></span>${svg}`
            + `<span class="o1-pie"><b>${esc(nombre)}</b><span>${esc(pie)}</span></span></a>`;
    };

    function venceProto(lista) {
        if (!lista.length) return '';
        const cosas = lista.map((c, i) => {
            const urgente = c.faltan <= 7;
            return `<li class="o1-cosa${urgente ? ' urgente' : ''}">`
                + `<span class="o1-hoja" aria-hidden="true"><span class="o1-hoja-mes">${esc(c.mes)}</span><b>${esc(c.dia)}</b></span>`
                + `<span class="o1-cosa-texto"><span class="o1-cuando">${esc(c.cuando)}<span class="o1-faltan">Faltan ${esc(c.faltan)} días</span></span>`
                + `<b id="o1-vence-${i}">${esc(c.titulo)}</b><span>${esc(c.detalle)}</span></span>`
                + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-maqueta-accion="Cargar licencia" aria-describedby="o1-vence-${i}">${esc(c.accion.texto)}</button></li>`;
        });
        return `<section class="o1-vence" aria-labelledby="o1-vence-titulo"><div class="o1-vence-cabeza"><h2 class="o1-titulo" id="o1-vence-titulo">Vence pronto</h2></div>`
            + `<ol class="o1-vence-lista">${cosas.join('')}</ol></section>`;
    }

    function loQueTeQueda(r) {
        const { vacaciones, otros } = r.tanques;
        const capas = vacaciones.capas.map((capa, i) => {
            const extra = capa.clase === 'vence' ? ' vence' : (['cargadas', 'por_habilitar'].includes(capa.clase) ? ' tenue' : '');
            return `<li class="${extra.trim()}" data-capa-lista="${i}"><i class="o1-muestra ${CLASE[capa.clase]}" aria-hidden="true"></i>`
                + `<span><b>${esc(capa.nombre)}</b>${esc(capa.nota)}</span><b class="o1-n" data-contar>${esc(capa.n)}</b></li>`;
        }).join('');
        const grande = tanque({ capas: vacaciones.capas, capacidad: vacaciones.capacidad, ...GRANDE, id: 'o1-t0' });
        const resto = otros.map((t, i) => nivel(t, {
            nombre: t.nombre, pie: t.de, vence: t.vence, chico: true,
            svg: tanque({ capas: [{ clase: t.vence ? 'vence' : 'tinta', n: t.valor }], capacidad: t.total, ...CHICO, id: `o1-t${i + 1}` }),
        })).join('');
        const p = r.pastillas;
        const pastilla = (clase, numero, titulo, nota) => `<li class="o1-pastilla ${clase}"><b>${esc(numero)}</b><span><b>${esc(titulo)}</b>${esc(nota)}</span></li>`;
        const filas = p.meses.map((m) => pastilla(m.estado, m.numero, m.mes, m.nota));
        if (p.previo) filas.push(pastilla('previo', p.previo.numero, p.previo.titulo, p.previo.nota));
        return `<section class="o1-panel" aria-labelledby="o1-queda-titulo"><div class="o1-panel-cabeza">`
            + `<h2 class="o1-titulo" id="o1-queda-titulo">Lo que te queda</h2><span class="o1-al">${esc(r.al_texto)}</span>`
            + `<button type="button" class="sg-link" data-maqueta-accion="Mis vacaciones y saldos">Mis vacaciones y saldos</button></div>`
            + `<div class="o1-tanques"><div class="o1-vac">${nivel(vacaciones, { nombre: 'Vacaciones', pie: vacaciones.pie, svg: grande })}<ul class="o1-capas">${capas}</ul></div>`
            + `<div class="o1-resto${otros.length === 3 ? ' tres' : ''}">${resto}</div></div>`
            + `<div class="o1-pie-panel">${filas.length ? `<h3 class="o1-subtitulo">${esc(p.titulo)}</h3><ol class="o1-pastillas">${filas.join('')}</ol>` : ''}`
            + `<p class="o1-extra">${esc(r.extraordinaria)}</p></div></section>`;
    }

    function hoy(r) {
        const h = r.hoy_y_manana;
        const gente = (titulo, lista) => (r.persona.ve_companeros && lista.length
            ? `<h3>${titulo}</h3><ul class="o1-gente">${lista.map((a) => `<li><span class="o1-inicial" aria-hidden="true">${esc(Maqueta.iniciales(a.nombre))}</span><span><b>${esc(a.texto)}</b><small>${esc(a.vuelve_texto)}</small></span></li>`).join('')}</ul>` : '');
        const eventos = (titulo, dia) => {
            const lista = h.eventos.filter((e) => e.dia === dia);
            return lista.length ? `<h3>${titulo}</h3><ul class="o1-eventos">${lista.map((e) => `<li><time>${esc(e.hora)}</time><span>${esc(e.titulo)}<small>${esc(e.detalle.split(' · ')[1])}</small></span></li>`).join('')}</ul>` : '';
        };
        const f = h.proximo_feriado;
        const [d, m] = f.fecha.slice(5).split('-').reverse();
        const feriado = `<h3>Próximo feriado</h3><p class="o1-feriado"><span class="o1-mini" aria-hidden="true"><b>${Number(d)}</b>${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1]}</span><span><strong>${esc(f.cuando)}</strong>${esc(f.nombre)}</span></p>`;
        return `<section class="o1-hoy" aria-labelledby="o1-hoy-titulo"><h2 class="o1-titulo" id="o1-hoy-titulo">Hoy y mañana</h2><p class="o1-hoy-dia">${esc(r.hoy_texto)}</p>`
            + eventos('En tu agenda hoy', 'hoy') + gente('Hoy no están', h.ausentes_hoy) + eventos('Mañana', 'manana') + gente('Mañana no están', h.ausentes_manana) + feriado
            + (h.eventos.length ? '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a>' : '') + '</section>';
    }

    // Al abrir: las hojas caen una detrás de otra, los tanques se llenan con la ola y los números suben con ellos
    function animar(raiz) {
        if (Maqueta.reducido()) return;
        raiz.querySelectorAll('.o1-hoja').forEach((hoja, i) => hoja.animate(
            [{ transform: 'perspective(320px) rotateX(-95deg)', opacity: 0 }, { transform: 'perspective(320px) rotateX(12deg)', opacity: 1, offset: 0.7 }, { transform: 'perspective(320px) rotateX(0)' }],
            { duration: 700, delay: 120 + i * 140, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)', fill: 'backwards' }));
        raiz.querySelectorAll('.o1-tanque').forEach((svg, i) => {
            const demora = 200 + i * 110;
            const liquido = svg.querySelector('.o1-liquido');
            const alto = liquido.style.getPropertyValue('--alto');
            liquido.animate([{ transform: `translateY(${alto})` }, { transform: 'translateY(0)' }], { duration: 1200, delay: demora, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)', fill: 'backwards' });
            const cresta = svg.querySelector('.o1-ola');
            if (cresta) {
                cresta.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${cresta.style.getPropertyValue('--l')})` }], { duration: 700, delay: demora, iterations: 4, easing: 'linear' });
                svg.querySelector('.o1-ola-y').animate([{ transform: 'scaleY(1.6)' }, { transform: 'scaleY(1)', offset: 0.5 }, { transform: 'scaleY(0.55)' }], { duration: 2800, delay: demora, easing: 'ease-out', fill: 'forwards' });
            }
            svg.closest('.o1-nivel').querySelectorAll('[data-contar]').forEach((n) => Maqueta.contar(n, { ms: 1100, demora }));
        });
        raiz.querySelectorAll('.o1-capas [data-contar]').forEach((n, i) => Maqueta.contar(n, { ms: 900, demora: 300 + i * 120 }));
    }

    Maqueta.opciones['1'] = {
        nombre: 'Niveles vivos',
        idea: 'La de hoy, con más vida: hojas de calendario que caen, cuánto falta, tanques de vidrio que se llenan con una ola y el día de hoy en una columna propia.',
        dibujar: (r) => Maqueta.contexto(r) + venceProto(r.vence_pronto) + Maqueta.faltantes(r)
            + `<div class="o1-grilla">${loQueTeQueda(r)}${hoy(r)}</div>`,
        animar(raiz) {
            animar(raiz);
            // Al pasar por una capa de la lista, se marca la suya en el tanque
            const svg = raiz.querySelector('.o1-vac .o1-tanque');
            raiz.querySelectorAll('[data-capa-lista]').forEach((li) => {
                li.addEventListener('mouseenter', () => svg.querySelectorAll('[data-capa]').forEach((c) => c.classList.toggle('resalta', c.dataset.capa !== li.dataset.capaLista)));
                li.addEventListener('mouseleave', () => svg.querySelectorAll('[data-capa]').forEach((c) => c.classList.remove('resalta')));
            });
        },
    };
})();
