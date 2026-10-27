/* Opción 4 · Tablero (opcion-4.css). Las paletas son decorativas (aria-hidden): al lado va el mismo valor en texto, oculto a la
   vista, para quien usa un lector de pantalla. «Lo que te queda» es una tabla de verdad, con sus encabezados. Al abrir, cada
   paleta gira por algunos números antes de quedar en el suyo; quietas con prefers-reduced-motion. */
(() => {
    const { esc } = Maqueta;
    const RELOJ = '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';

    // Un texto corto en paletas: los números y las letras en casilleros, «/» y «:» sueltos, la coma angosta
    const paletas = (texto, tam = 'medio', leido = texto) => {
        const casilleros = [...String(texto)].map((c) => {
            if (c === '/' || c === ':') return `<span class="o4-paleta signo">${esc(c)}</span>`;
            if (c === ',') return `<span class="o4-paleta coma">${esc(c)}</span>`;
            return `<span class="o4-paleta">${esc(c)}</span>`;
        }).join('');
        return `<span class="o4-paletas o4-${tam}" aria-hidden="true">${casilleros}</span><span class="visualmente-oculto">${esc(leido)}</span>`;
    };
    const luces = (valor, total, vence) => {
        const on = Math.round((valor / total) * 10);
        return `<span class="o4-luces${vence ? ' vence' : ''}" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
    };
    const corta = (texto) => (String(texto).match(/\d\d\/\d\d/) || [''])[0];

    function salidas(lista) {
        if (!lista.length) return '';
        const filas = lista.map((c, i) => {
            const fecha = c.fecha.slice(8, 10) + '/' + c.fecha.slice(5, 7);
            return `<li class="o4-salida o4-vence"><span><span class="o4-rotulo-col">${esc(c.cuando.split(' ')[0])}</span>${paletas(fecha, 'grande', c.cuando)}</span>`
                + `<span class="o4-salida-que"><b id="o4-v-${i}">${esc(c.titulo)}</b><span>${esc(c.detalle)}</span></span>`
                + `<span class="o4-faltan"><span>Faltan</span><span>${paletas(String(c.faltan), 'medio', `Faltan ${c.faltan} días`)} <span aria-hidden="true">días</span></span></span>`
                + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-maqueta-accion="Cargar licencia" aria-describedby="o4-v-${i}">${esc(c.accion.texto)}</button></li>`;
        }).join('');
        return `<section class="o4-tablero" aria-labelledby="o4-vence-titulo"><div class="o4-cabeza"><h2 id="o4-vence-titulo">${RELOJ}Vence pronto</h2></div><ol class="o4-salidas">${filas}</ol></section>`;
    }

    function queda(r) {
        const v = r.tanques.vacaciones;
        const fila = ({ clase = '', que, num, unidad = '', de = '', hasta = '', luz = '' }) =>
            `<tr class="${clase}"><td class="que">${que}</td><td class="num">${num}${unidad ? `<span class="unidad" aria-hidden="true">${esc(unidad)}</span>` : ''}</td><td>${esc(de)}</td><td class="hasta">${esc(hasta)}</td><td class="luces">${luz}</td></tr>`;
        const filas = [fila({
            clase: 'grupo', que: `<a href="#licencias" data-pestana="licencias" aria-label="${esc(v.aria)}">Vacaciones</a><small>${esc(v.pie)}</small>`,
            num: paletas(String(v.numero), 'grande', `${v.numero} días`), unidad: v.unidad,
        })];
        v.capas.forEach((c) => {
            const clase = `sub${c.clase === 'vence' ? ' vence' : ''}${['cargadas', 'por_habilitar'].includes(c.clase) ? ' tenue' : ''}`;
            filas.push(fila({ clase, que: `<span>${esc(c.nombre)}</span>`, num: paletas(String(c.n), 'chico', `${c.n} días`), hasta: c.nota }));
        });
        r.tanques.otros.forEach((t) => {
            const pestana = t.pestana === 'horas' ? 'horas' : 'licencias';
            filas.push(fila({
                clase: t.vence ? 'vence' : '', que: `<a href="#${pestana}" data-pestana="${pestana}" aria-label="${esc(t.aria)}">${esc(t.nombre)}</a>`,
                num: paletas(t.numero, 'medio', `${t.numero} ${t.unidad}`), unidad: t.unidad, de: t.de,
                hasta: t.clave === 'horas_a_favor' ? 'Vencen el viernes 30/10' : 'Vuelve a cero el 1/1', luz: luces(t.valor, t.total, t.vence),
            }));
        });
        const p = r.pastillas;
        const meses = p.meses.map((m) => `<li class="${m.estado === 'vence' ? 'vence' : ''}">${paletas(m.numero, 'chico')}<span><b>${esc(m.mes)}</b>: ${esc(m.nota.charAt(0).toLowerCase() + m.nota.slice(1))}</span></li>`);
        if (p.previo) meses.push(`<li>${paletas(p.previo.numero, 'chico')}<span><b>${esc(p.previo.titulo)}</b>: ${esc(p.previo.nota.toLowerCase())}</span></li>`);
        return `<section class="o4-tablero" aria-labelledby="o4-queda-titulo"><div class="o4-cabeza"><h2 id="o4-queda-titulo">Lo que te queda</h2><span>${esc(r.al_texto)}</span>`
            + '<button type="button" class="sg-link" data-maqueta-accion="Mis vacaciones y saldos">Mis vacaciones y saldos</button></div>'
            + `<table class="o4-tabla"><thead><tr><th scope="col">Qué</th><th scope="col">Te quedan</th><th scope="col">De</th><th scope="col">Hasta cuándo</th><th scope="col" class="luces"><span class="visualmente-oculto">Cuánto queda del total</span></th></tr></thead><tbody>${filas.join('')}</tbody></table>`
            + (meses.length ? `<h3 class="o4-rotulo-col" style="margin-top:16px">${esc(p.titulo)}</h3><ul class="o4-meses">${meses.join('')}</ul>` : '')
            + `<p class="o4-pie">${esc(r.extraordinaria)}</p></section>`;
    }

    function hoy(r) {
        const h = r.hoy_y_manana;
        const ve = r.persona.ve_companeros;
        const grupo = (titulo, dia, ausentes) => {
            const filas = h.eventos.filter((e) => e.dia === dia).map((e) => `<li>${paletas(e.hora, 'chico')}<span>${esc(e.titulo)}<small>${esc(e.detalle.split(' · ')[1])}</small></span></li>`);
            if (ve) ausentes.forEach((a) => filas.push(`<li>${paletas(corta(a.vuelve_texto), 'chico', a.vuelve_texto)}<span>${esc(a.texto)}<small>${esc(a.vuelve_texto)}</small></span></li>`));
            return filas.length ? `<h3>${titulo}</h3><ul class="o4-llegadas">${filas.join('')}</ul>` : '';
        };
        const f = h.proximo_feriado;
        return `<section class="o4-tablero o4-hoy" aria-labelledby="o4-hoy-titulo"><div class="o4-cabeza"><h2 id="o4-hoy-titulo">Hoy y mañana</h2><span>${esc(r.hoy_texto)}</span></div>`
            + grupo('Hoy', 'hoy', h.ausentes_hoy) + grupo('Mañana', 'manana', h.ausentes_manana)
            + `<h3>Próximo feriado</h3><ul class="o4-llegadas"><li>${paletas(corta(f.cuando), 'chico', f.cuando)}<span>${esc(f.nombre)}<small>${esc(f.cuando)}</small></span></li></ul>`
            + (h.eventos.length ? '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a>' : '') + '</section>';
    }

    function animar(raiz) {
        if (Maqueta.reducido()) return;
        const giro = [{ transform: 'scaleY(1)' }, { transform: 'scaleY(0.12)', offset: 0.5 }, { transform: 'scaleY(1)' }];
        raiz.querySelectorAll('.o4-paleta:not(.signo):not(.coma)').forEach((p, i) => {
            const final = p.textContent;
            const vueltas = 5 + Math.floor(Math.random() * 7);
            let n = 0;
            const girar = () => {
                n += 1;
                p.textContent = n >= vueltas ? final : String(Math.floor(Math.random() * 10));
                p.animate(giro, { duration: 80, easing: 'ease-in-out' });
                if (n < vueltas) setTimeout(girar, 75);
            };
            p.textContent = ' ';
            setTimeout(girar, 120 + i * 18);
        });
    }

    Maqueta.opciones['4'] = {
        nombre: 'Tablero',
        idea: 'Un tablero de salidas en el azul de la carcasa: los números y las fechas en paletas que giran al abrir, lo que vence en amarillo y quién vuelve como llegadas.',
        dibujar: (r) => Maqueta.contexto(r) + salidas(r.vence_pronto) + Maqueta.faltantes(r) + `<div class="o4-grilla">${queda(r)}${hoy(r)}</div>`,
        animar,
    };
})();
