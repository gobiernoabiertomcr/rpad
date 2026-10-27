/* Opción 2 · Titular (opcion-2.css). La frase y su bajada las armaría el servidor (nuevo: `frase` y `bajada` del Resumen, como
   los demás textos: Ruling 19); acá se arman con los datos de la maqueta. Al abrir, el número de la frase cuenta mientras la
   regla se dibuja de izquierda a derecha, tramo por tramo; después se llenan las líneas del resto. */
(() => {
    const { esc } = Maqueta;
    const COLOR = { vence: 'var(--sg-sol-borde)', tinta: 'var(--sg-tinta)', medio: 'var(--sg-medio)', cargadas: 'repeating-linear-gradient(135deg, #1A365D 0 2px, #fff 2px 5px)', por_habilitar: '#fff' };

    function frase(r) {
        const v = r.tanques.vacaciones;
        const queda = v.numero === 1 ? 'Te queda' : 'Te quedan';
        return `<h2 class="o2-frase" id="o2-frase">${queda} <span class="o2-cifra" data-contar>${esc(v.numero)}</span> ${v.numero === 1 ? 'día' : 'días'} de vacaciones</h2>`;
    }

    function bajada(r) {
        const capas = r.tanques.vacaciones.capas;
        const partes = [];
        const vence = capas.find((c) => c.clase === 'vence');
        const cargadas = capas.find((c) => c.clase === 'cargadas');
        const por = capas.find((c) => c.clase === 'por_habilitar');
        const primera = [];
        if (vence) primera.push(`<b class="vence">${vence.n} vencen el jueves 31/12</b>`);
        if (cargadas) primera.push(`${cargadas.n} ya están cargados para noviembre`);
        if (primera.length) partes.push(`${primera.join(', y ')}.`);
        if (por) partes.push(`Otros ${por.n} se habilitan el 1/1/2027.`);
        return partes.length ? `<p class="o2-bajada">${partes.join(' ')}</p>` : '';
    }

    function regla(r) {
        const capas = r.tanques.vacaciones.capas;
        const columnas = capas.map((c) => `minmax(0, ${c.n}fr)`).join(' ');
        const tramos = capas.map((c) => `<span class="o2-tramo ${c.clase}" style="--n:${c.n}"><span>${esc(c.n)}</span></span>`).join('');
        const rotulos = capas.map((c) => `<li class="${c.clase === 'vence' ? 'vence' : ''}"><i class="o2-muestra" style="background:${COLOR[c.clase]};${c.clase === 'por_habilitar' ? 'box-shadow: inset 0 0 0 2px #8FA3BA;' : ''}" aria-hidden="true"></i><span><b>${esc(c.nombre)}: ${esc(c.n)}</b>${esc(c.nota)}</span></li>`).join('');
        return `<div class="o2-regla"><div class="o2-barra" aria-hidden="true" style="--o2-columnas:${columnas}">${tramos}</div>`
            + `<ul class="o2-rotulos" style="--o2-columnas:${columnas}" aria-label="Tus vacaciones, por licencia">${rotulos}</ul></div>`;
    }

    function vencePronto(lista) {
        if (!lista.length) return '';
        return `<aside class="o2-vence" aria-labelledby="o2-vence-titulo"><h2 id="o2-vence-titulo">Vence pronto</h2><ol class="o2-entradas">${lista.map((c, i) =>
            `<li class="o2-entrada"><span class="o2-talon" aria-hidden="true"><b>${esc(c.dia)}</b>${esc(c.mes)}</span>`
            + `<span class="o2-entrada-cuerpo"><span class="cuando">${esc(c.cuando)}, faltan ${esc(c.faltan)} días</span><b id="o2-vence-${i}">${esc(c.titulo)}</b>`
            + `<span class="detalle">${esc(c.detalle)}</span><button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-maqueta-accion="Cargar licencia" aria-describedby="o2-vence-${i}">${esc(c.accion.texto)}</button></span></li>`).join('')}</ol></aside>`;
    }

    function resto(r) {
        const numeros = r.tanques.otros.map((t) => {
            const pestana = t.pestana === 'horas' ? 'horas' : 'licencias';
            return `<li><a class="o2-numero${t.vence ? ' vence' : ''}" href="#${pestana}" data-pestana="${pestana}" aria-label="${esc(t.aria)}">`
                + `<span class="grande"><span data-contar>${esc(t.numero)}</span><small>${esc(t.unidad)}</small></span>`
                + `<span class="nombre">${esc(t.nombre)}</span><span class="de">${esc(t.de)}</span>`
                + `<span class="o2-linea" aria-hidden="true"><i style="--p:${Math.round((t.valor / t.total) * 1000) / 10}%"></i></span></a></li>`;
        }).join('');
        const p = r.pastillas;
        const mes = (clase, numero, titulo, nota) => `<span class="o2-mes ${clase}"><strong>${esc(numero)}</strong> ${esc(titulo)} <span>${esc(nota)}</span></span>`;
        const meses = p.meses.map((m) => mes(m.estado, m.numero, m.mes.toLowerCase(), m.nota));
        if (p.previo) meses.push(mes('previo', p.previo.numero, p.previo.titulo.toLowerCase(), p.previo.nota));
        return `<section aria-labelledby="o2-resto-titulo"><div class="o2-resto"><h2 id="o2-resto-titulo">El resto de ${esc(r.anio)}</h2>`
            + `<span class="o2-resto-al"><span>${esc(r.al_texto)}</span><button type="button" class="sg-link" data-maqueta-accion="Mis vacaciones y saldos">Mis vacaciones y saldos</button></span></div>`
            + `<ul class="o2-numeros">${numeros}</ul>`
            + (meses.length ? `<p class="o2-meses"><b>${esc(p.titulo)}:</b>${meses.join('')}</p>` : '')
            + `<p class="o2-extra">${esc(r.extraordinaria)}</p></section>`;
    }

    function hoy(r) {
        const h = r.hoy_y_manana;
        const ve = r.persona.ve_companeros;
        const columna = (titulo, dia, ausentes) => {
            const filas = h.eventos.filter((e) => e.dia === dia).map((e) => `<li><time>${esc(e.hora)}</time>${esc(e.titulo)}<small>${esc(e.detalle.split(' · ')[1])}</small></li>`);
            if (ve) ausentes.forEach((a) => filas.push(`<li class="ausente">${esc(a.texto)}<small>${esc(a.vuelve_texto)}</small></li>`));
            return filas.length ? `<div class="o2-columna"><h3>${titulo}</h3><ul>${filas.join('')}</ul></div>` : '';
        };
        const f = h.proximo_feriado;
        return `<section class="o2-hoy" aria-labelledby="o2-hoy-titulo"><h2 id="o2-hoy-titulo">Hoy y mañana</h2><div class="o2-columnas">`
            + columna('Hoy', 'hoy', h.ausentes_hoy) + columna('Mañana', 'manana', h.ausentes_manana)
            + `<div class="o2-columna"><h3>Próximo feriado</h3><ul><li><b>${esc(f.cuando)}</b><small>${esc(f.nombre)}</small></li></ul>`
            + (h.eventos.length ? '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a>' : '') + '</div></div></section>';
    }

    function animar(raiz) {
        if (Maqueta.reducido()) return;
        const tramos = [...raiz.querySelectorAll('.o2-tramo')];
        const total = tramos.reduce((s, t) => s + Number(t.style.getPropertyValue('--n')), 0) || 1;
        const DURACION = 1300;
        let t0 = 250;
        tramos.forEach((t) => {
            const ms = Math.max(160, (Number(t.style.getPropertyValue('--n')) / total) * DURACION);
            t.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: ms, delay: t0, easing: 'cubic-bezier(0.4, 0, 0.3, 1)', fill: 'backwards' });
            t.querySelector('span').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: t0 + ms * 0.7, fill: 'backwards' });
            t0 += ms;
        });
        // El número de la frase cuenta solo lo disponible: la regla también dibuja lo cargado y lo que falta habilitar
        const cifra = raiz.querySelector('.o2-cifra');
        if (cifra) Maqueta.contar(cifra, { ms: DURACION, demora: 250 });
        raiz.querySelectorAll('.o2-linea i').forEach((i, n) => i.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 700, delay: 900 + n * 90, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)', fill: 'backwards' }));
        raiz.querySelectorAll('.o2-numero [data-contar]').forEach((n, i) => Maqueta.contar(n, { ms: 700, demora: 900 + i * 90 }));
    }

    Maqueta.opciones['2'] = {
        nombre: 'Titular',
        idea: 'La cuenta dicha en una frase grande, sobre la banda celeste del sitio público, con la regla de tus días partida por licencia. Lo que vence, como entradas. El resto, en silencio.',
        dibujar: (r) => {
            const vence = vencePronto(r.vence_pronto);
            return Maqueta.faltantes(r) + `<section class="o2-banda" aria-labelledby="o2-frase"><div class="o2-banda-cuerpo${vence ? '' : ' sin-vence'}">`
                + `<div><p class="o2-dia"><span>${esc(r.hoy_texto)}</span>, <span>${esc(r.modalidad.texto.toLowerCase())}</span></p>${frase(r)}${bajada(r)}${regla(r)}</div>${vence}</div>`
                + '<svg class="o2-ola" viewBox="0 0 1200 28" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 0 H1200 V14 C 1100 26, 1000 26, 900 14 S 700 2, 600 12 S 400 28, 300 16 S 100 4, 0 18 Z" fill="currentColor"/></svg></section>'
                + resto(r) + hoy(r);
        },
        animar,
    };
})();
