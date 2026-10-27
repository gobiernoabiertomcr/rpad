/* MAQUETA de Mi espacio (26/10/2026): tres opciones más gráficas para «Lo que te queda» del Resumen.
   1 Niveles: un tanque por saldo, con el número arriba; el de vacaciones, por capas (una por licencia).
   2 Mosaico: bloques de distinto tamaño con anillos, una barra por capas y los números grandes.
   3 Tu año: los números en una tira y el saldo de vacaciones mes a mes, con lo que lo sube y lo que lo baja.
   «Vence pronto» y «Hoy» son los de resumen.js (window.RESUMEN). Datos inventados, los mismos de resumen.js. */
(() => {
    const DATOS = {
        permanente: {
            vac: {
                total: 33,
                capas: [
                    { n: 3, clase: 'c-vence', nombre: 'Licencia 2024', nota: 'Vence el 31/12/2026' },
                    { n: 20, clase: 'c-25', nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027' },
                    { n: 10, clase: 'c-26', nombre: 'Licencia 2026', nota: 'La primera mitad' },
                ],
                reservado: { n: 5, nota: 'Cargados para noviembre' },
                porVenir: { n: 10, nota: 'Se habilitan el 1/1/2027' },
            },
            saldos: [
                { nombre: 'Franquicias', valor: 25, total: 42, numero: '25', unidad: 'horas', de: 'de 42 horas' },
                { nombre: 'Estudios', valor: 9, total: 15, numero: '9', unidad: 'días', de: 'de 15 días' },
                { nombre: 'Atención médica', valor: 22, total: 25, numero: '22', unidad: 'días', de: 'de 25 días' },
                { nombre: 'Grupo familiar', valor: 23, total: 25, numero: '23', unidad: 'días', de: 'de 25 días' },
            ],
            extra: {
                titulo: 'Francos compensatorios', carril: 'Francos',
                meses: [
                    { mes: 'Octubre', fecha: '2026-10-15', numero: '1', unidad: 'franco', corto: '1 franco', nota: 'Hasta el viernes 30/10', vence: true },
                    { mes: 'Noviembre', fecha: '2026-11-15', numero: '1', unidad: 'franco', corto: '1 franco', nota: 'Por las horas de septiembre' },
                    { mes: 'Diciembre', fecha: '2026-12-15', numero: '1', unidad: 'franco', corto: '1 franco', nota: 'Octubre sigue sumando', pendiente: true },
                ],
                previos: '1 franco no utilizado previamente, el de agosto.',
                previo: { numero: '1', titulo: 'Agosto', nota: 'No utilizado previamente' },
            },
            serie: {
                desde: '2026-06-01', hasta: '2027-05-31', inicial: 28,
                cambios: [
                    { fecha: '2026-07-01', delta: 10, texto: 'Primera mitad de la 2026', lado: 'arriba' },
                    { fecha: '2026-11-03', delta: -5, texto: 'Vacaciones cargadas', lado: 'arriba' },
                    { fecha: '2026-12-31', delta: -3, texto: 'Vence la 2024', lado: 'abajo', vence: true },
                    { fecha: '2027-01-01', delta: 10, texto: 'Segunda mitad de la 2026', lado: 'arriba' },
                ],
            },
        },
        contrato: {
            vac: {
                total: 13,
                capas: [
                    { n: 5, clase: 'c-25', nombre: 'Licencia 2025', nota: 'Vence el 31/12/2027' },
                    { n: 8, clase: 'c-26', nombre: 'Licencia 2026', nota: 'La primera mitad' },
                ],
                reservado: null,
                porVenir: { n: 7, nota: 'Se habilitan el 1/1/2027' },
            },
            saldos: [
                { nombre: 'Horas a favor', valor: 1.5, total: 10.5, numero: '1,5', unidad: 'horas', de: 'de 10,5 en octubre', vence: true, pestana: 'horas' },
                { nombre: 'Estudios', valor: 7, total: 10, numero: '7', unidad: 'días', de: 'de 10 días' },
                { nombre: 'Atención médica', valor: 25, total: 25, numero: '25', unidad: 'días', de: 'de 25 días' },
                { nombre: 'Grupo familiar', valor: 21, total: 25, numero: '21', unidad: 'días', de: 'de 25 días' },
            ],
            extra: {
                titulo: 'Horas a favor', carril: 'Horas a favor',
                meses: [
                    { mes: 'Octubre', fecha: '2026-10-15', numero: '1,5', unidad: 'horas', corto: '1,5 h', nota: 'De 10,5, hasta el 30/10', vence: true },
                    { mes: 'Noviembre', fecha: '2026-11-15', numero: '4', unidad: 'horas', corto: '4 h', nota: 'Octubre sigue sumando', pendiente: true },
                ],
                previos: '6,5 horas no utilizadas previamente en 2026.',
                previo: { numero: '6,5', titulo: 'Horas de 2026', nota: 'No utilizadas previamente' },
            },
            serie: {
                desde: '2026-06-01', hasta: '2027-05-31', inicial: 5,
                cambios: [
                    { fecha: '2026-07-01', delta: 8, texto: 'Primera mitad de la 2026', lado: 'arriba' },
                    { fecha: '2027-01-01', delta: 7, texto: 'Segunda mitad de la 2026', lado: 'arriba' },
                ],
            },
        },
    };
    const HOY = '2026-10-26';
    let idSvg = 0;

    /* ---------------------------------------------------------------- 1 · Niveles */
    const tanque = ({ capas, capacidad, ancho = 64, alto = 150 }) => {
        const id = `tq${++idSvg}`;
        let y = alto;
        const partes = capas.map((c) => {
            const h = (c.n / capacidad) * alto;
            y -= h;
            return `<rect class="${c.clase}" x="0" y="${y.toFixed(1)}" width="${ancho}" height="${h.toFixed(1)}"/>`;
        });
        return `<svg class="op-tanque" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true">
            <defs><clipPath id="${id}"><rect width="${ancho}" height="${alto}" rx="16"/></clipPath>
            <pattern id="${id}r" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#fff"/><rect width="3" height="6" fill="#1A365D"/></pattern></defs>
            <rect class="t-fondo" width="${ancho}" height="${alto}" rx="16"/>
            <g clip-path="url(#${id})"><g class="t-nivel" style="--alto:${alto}px">${partes.join('').replace(/class="c-reservado"/g, `class="c-reservado" fill="url(#${id}r)"`)}</g></g>
            <rect class="t-borde" x="1" y="1" width="${ancho - 2}" height="${alto - 2}" rx="15"/>
        </svg>`;
    };
    const capasDeVacaciones = (vac) => [
        ...vac.capas,
        ...(vac.reservado ? [{ n: vac.reservado.n, clase: 'c-reservado' }] : []),
        ...(vac.porVenir ? [{ n: vac.porVenir.n, clase: 'c-por-venir' }] : []),
    ];
    const capacidadDe = (vac) => vac.total + (vac.reservado?.n || 0) + (vac.porVenir?.n || 0);
    const leyendaDeVacaciones = (vac) => `
        <ul class="op-leyenda-vac">
            ${vac.capas.map((c) => `<li class="${c.clase === 'c-vence' ? 'vence' : ''}"><i class="op-muestra ${c.clase}"></i><span><b>${c.nombre}</b>${c.nota}</span><b class="op-n">${c.n}</b></li>`).join('')}
            ${vac.reservado ? `<li class="tenue"><i class="op-muestra c-reservado"></i><span><b>Cargados</b>${vac.reservado.nota}</span><b class="op-n">${vac.reservado.n}</b></li>` : ''}
            ${vac.porVenir ? `<li class="tenue"><i class="op-muestra c-por-venir"></i><span><b>Todavía no</b>${vac.porVenir.nota}</span><b class="op-n">${vac.porVenir.n}</b></li>` : ''}
        </ul>`;

    // Cada tanque es un link a su pestaña (Licencias u Horas extras). Todos terminan en la misma línea: el número arriba,
    // el tanque y el nombre con su total debajo (dos renglones, sin cortar)
    const htmlDeNiveles = (d) => `
        <section class="op-panel op-niveles" aria-labelledby="niv-${d.clave}">
            <div class="op-cabeza"><h2 class="rs-titulo" id="niv-${d.clave}">Lo que te queda</h2><span>Al lunes 26/10/2026</span></div>
            <div class="op-niveles-fila">
                <div class="op-nivel-vac">
                    <a class="op-nivel" href="1-mi-espacio.html#licencias" data-pestana="licencias" aria-label="Vacaciones: ${d.vac.total} días hábiles disponibles. Ver tus licencias">
                        <span class="op-nivel-num"><b>${d.vac.total}</b><span>días</span></span>
                        ${tanque({ capas: capasDeVacaciones(d.vac), capacidad: capacidadDe(d.vac), ancho: 88, alto: 176 })}
                        <span class="op-nivel-pie"><b>Vacaciones</b><span>de ${d.vac.capas.length} licencias</span></span>
                    </a>
                    ${leyendaDeVacaciones(d.vac)}
                </div>
                <div class="op-niveles-resto">
                    ${d.saldos.map((s) => `
                    <a class="op-nivel${s.vence ? ' vence' : ''}" href="1-mi-espacio.html#${s.pestana || 'licencias'}" data-pestana="${s.pestana || 'licencias'}" aria-label="${s.nombre}: quedan ${s.numero} ${s.unidad} ${s.de}">
                        <span class="op-nivel-num chico"><b>${s.numero}</b><span>${s.unidad}</span></span>
                        ${tanque({ capas: [{ n: s.valor, clase: s.vence ? 'c-vence' : 'c-25' }], capacidad: s.total, ancho: 52, alto: 112 })}
                        <span class="op-nivel-pie"><b>${s.nombre}</b><span>${s.de}</span></span>
                    </a>`).join('')}
                </div>
            </div>
            <div class="op-niveles-pie">
                <h3 class="rs-subtitulo">${d.extra.titulo}</h3>
                <ol class="op-pastillas">
                    ${d.extra.meses.map((m) => `<li class="${m.vence ? 'vence' : ''}${m.pendiente ? ' pendiente' : ''}"><b>${m.numero}</b><span><b>${m.mes}</b>${m.nota}</span></li>`).join('')}
                    <li class="previo"><b>${d.extra.previo.numero}</b><span><b>${d.extra.previo.titulo}</b>${d.extra.previo.nota}</span></li>
                </ol>
                <p class="op-previos">Atención médica extraordinaria: sin tope y aparte de los 25 días. No usaste en 2026.</p>
            </div>
        </section>`;

    /* ---------------------------------------------------------------- 2 · Mosaico */
    const anillo = (valor, total, vence) => {
        const r = 42; const c = 2 * Math.PI * r; const f = Math.max(0, Math.min(1, valor / total));
        return `<svg class="op-anillo${vence ? ' vence' : ''}" viewBox="0 0 100 100" aria-hidden="true"><circle class="a-pista" cx="50" cy="50" r="${r}"/><circle class="a-valor" cx="50" cy="50" r="${r}" stroke-dasharray="${(f * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/></svg>`;
    };
    const barraDeVacaciones = (vac) => {
        const cap = capacidadDe(vac);
        return `<div class="op-barra" aria-hidden="true">${capasDeVacaciones(vac).map((c) => `<span class="${c.clase}" style="width:${((c.n / cap) * 100).toFixed(2)}%"></span>`).join('')}</div>`;
    };
    const htmlDeMosaico = (d) => `
        <section class="op-mosaico" aria-label="Lo que te queda">
            <div class="op-tesela op-t-vac">
                <h2 class="op-tesela-titulo">Vacaciones</h2>
                <div class="op-gigante"><b>${d.vac.total}</b><span>días hábiles<br>disponibles</span></div>
                ${barraDeVacaciones(d.vac)}
                ${leyendaDeVacaciones(d.vac)}
            </div>
            ${d.saldos.map((s) => `
            <div class="op-tesela op-t-anillo${s.vence ? ' vence' : ''}">
                <div class="op-anillo-marco">${anillo(s.valor, s.total, s.vence)}<span class="op-anillo-num"><b>${s.numero}</b>${s.unidad}</span></div>
                <div class="op-tesela-pie"><b>${s.nombre}</b><span>${s.de}</span></div>
            </div>`).join('')}
            <div class="op-tesela op-t-meses">
                <h2 class="op-tesela-titulo">${d.extra.titulo}</h2>
                <ol class="op-meses-grandes">
                    ${d.extra.meses.map((m) => `<li class="${m.vence ? 'vence' : ''}${m.pendiente ? ' pendiente' : ''}"><span class="op-mes">${m.mes}</span><b>${m.numero}</b><span class="op-unidad">${m.unidad}</span><small>${m.nota}</small></li>`).join('')}
                </ol>
            </div>
            <div class="op-tesela op-t-nota">
                <p><b>Médica extraordinaria</b>Sin tope y aparte de los 25 días. No usaste en 2026.</p>
                <p><b>No utilizado previamente</b>${d.extra.previos}</p>
            </div>
        </section>`;

    /* ---------------------------------------------------------------- 3 · Tu año */
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const dia = (f) => { const [a, m, d] = f.split('-').map(Number); return Date.UTC(a, m - 1, d) / 86400000; };
    const graficoDelAnio = (d) => {
        const s = d.serie;
        const W = 760, H = 270, izq = 30, der = 14, arriba = 34, abajo = 92;
        const d0 = dia(s.desde), d1 = dia(s.hasta) + 1;
        const x = (f) => izq + ((dia(f) - d0) / (d1 - d0)) * (W - izq - der);
        let v = s.inicial; const niveles = [v];
        s.cambios.forEach((c) => { v += c.delta; niveles.push(v); });
        const tope = Math.ceil((Math.max(...niveles) + 8) / 10) * 10;
        const base = H - abajo;
        const y = (val) => base - (val / tope) * (base - arriba);
        // La escalera
        let camino = `M ${izq} ${y(s.inicial).toFixed(1)}`;
        v = s.inicial;
        s.cambios.forEach((c) => { v += c.delta; camino += ` H ${x(c.fecha).toFixed(1)} V ${y(v).toFixed(1)}`; });
        camino += ` H ${W - der}`;
        const area = `${camino} V ${base} H ${izq} Z`;
        const xHoy = x(HOY);
        // Los meses
        const meses = [];
        for (let a = 2026, m = 6; a < 2027 || m <= 5; m++) {
            if (m > 12) { m = 1; a++; }
            const f = `${a}-${String(m).padStart(2, '0')}-01`;
            meses.push(`<line class="g-mes" x1="${x(f).toFixed(1)}" x2="${x(f).toFixed(1)}" y1="${arriba - 6}" y2="${base}"/><text class="g-eje" x="${(x(f) + 4).toFixed(1)}" y="${base + 16}">${MESES[m - 1]}${m === 1 ? ` ${a}` : ''}</text>`);
            if (a === 2027 && m === 5) break;
        }
        // Los números de cada tramo y las marcas de cada cambio
        const tramos = [s.desde, ...s.cambios.map((c) => c.fecha)];
        // El número de cada tramo va debajo de la línea, dentro del área; los cambios, a la derecha de su escalón:
        // arriba del tramo más alto de los dos, o debajo del nuevo
        const numeros = tramos.map((f, i) => {
            const fin = i + 1 < tramos.length ? tramos[i + 1] : s.hasta;
            const ancho = x(fin) - x(f);
            if (ancho < 40) return '';
            return `<text class="g-nivel" x="${(x(f) + ancho / 2).toFixed(1)}" y="${(y(niveles[i]) + 20).toFixed(1)}">${niveles[i]}</text>`;
        }).join('');
        v = s.inicial;
        const marcas = s.cambios.map((c) => {
            const antes = v;
            v += c.delta;
            const cx = x(c.fecha), cy = y(v);
            const signo = c.delta > 0 ? `+${c.delta}` : `−${-c.delta}`;
            const ty = c.lado === 'abajo' ? y(v) + 24 : y(Math.max(antes, v)) - 24;
            const tx = cx + 6;
            return `<g class="g-cambio${c.vence ? ' vence' : ''}${c.delta < 0 ? ' baja' : ''}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="4.5"/>
                <text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}"><tspan class="g-delta">${signo}</tspan><tspan class="g-texto" x="${tx.toFixed(1)}" dy="14">${c.texto}</tspan></text></g>`;
        }).join('');
        // El carril de los francos o de las horas a favor
        const yCarril = base + 46;
        const carril = d.extra.meses.map((m) => {
            const cx = x(m.fecha);
            return `<g class="g-pastilla${m.vence ? ' vence' : ''}${m.pendiente ? ' pendiente' : ''}"><rect x="${(cx - 28).toFixed(1)}" y="${yCarril - 13}" width="56" height="24" rx="12"/><text x="${cx.toFixed(1)}" y="${yCarril + 4}" text-anchor="middle">${m.corto}</text></g>`;
        }).join('');
        return `<svg class="op-grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saldo de vacaciones de junio de 2026 a mayo de 2027: ${niveles.join(', ')} días">
            <defs>
                <linearGradient id="g-area-${d.clave}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#4C7AB0" stop-opacity="0.32"/><stop offset="1" stop-color="#4C7AB0" stop-opacity="0.04"/></linearGradient>
                <clipPath id="g-pasado-${d.clave}"><rect x="0" y="0" width="${xHoy.toFixed(1)}" height="${H}"/></clipPath>
                <clipPath id="g-futuro-${d.clave}"><rect x="${xHoy.toFixed(1)}" y="0" width="${W}" height="${H}"/></clipPath>
            </defs>
            ${meses.join('')}
            <line class="g-base" x1="${izq}" x2="${W - der}" y1="${base}" y2="${base}"/>
            <path class="g-area" d="${area}" fill="url(#g-area-${d.clave})"/>
            <path class="g-linea" d="${camino}" clip-path="url(#g-pasado-${d.clave})"/>
            <path class="g-linea futuro" d="${camino}" clip-path="url(#g-futuro-${d.clave})"/>
            <line class="g-hoy" x1="${xHoy.toFixed(1)}" x2="${xHoy.toFixed(1)}" y1="${arriba - 16}" y2="${base + 54}"/>
            <text class="g-hoy-texto" x="${(xHoy + 5).toFixed(1)}" y="${arriba - 8}">Hoy</text>
            ${numeros}${marcas}
            <text class="g-carril" x="${izq}" y="${yCarril + 4}">${d.extra.carril}</text>
            ${carril}
        </svg>`;
    };
    const htmlDeTuAnio = (d) => `
        <section class="op-panel op-anio" aria-labelledby="anio-${d.clave}">
            <dl class="op-tira">
                <div class="destacado"><dt>Vacaciones</dt><dd><b>${d.vac.total}</b> días</dd></div>
                ${d.saldos.map((s) => `<div class="${s.vence ? 'vence' : ''}"><dt>${s.nombre}</dt><dd><b>${s.numero}</b> ${s.unidad}</dd><dd class="op-de">${s.de}</dd></div>`).join('')}
            </dl>
            <div class="op-cabeza"><h2 class="rs-titulo" id="anio-${d.clave}">Tus vacaciones, mes a mes</h2><span>De junio de 2026 a mayo de 2027</span></div>
            ${graficoDelAnio(d)}
            <p class="op-previos">Sube cuando se habilita una mitad y baja cuando cargás vacaciones o vence una licencia. ${d.extra.previos}</p>
        </section>`;

    /* ---------------------------------------------------------------- Armado */
    const OPCIONES = { niveles: htmlDeNiveles, mosaico: htmlDeMosaico, anio: htmlDeTuAnio };
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-pestana]');
        const tab = link && document.getElementById(`tab-${link.dataset.pestana}`);
        if (!tab) return;
        e.preventDefault();
        tab.click();
        tab.focus();
    });
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-opcion]').forEach((el) => {
            const dibujar = OPCIONES[el.dataset.opcion];
            el.innerHTML = ['permanente', 'contrato'].map((clave) => `
                <div class="rs solo-${clave}">
                    ${window.RESUMEN.htmlDeVence(clave)}
                    <div class="rs-grilla">${dibujar({ ...DATOS[clave], clave: `${clave}-${el.dataset.opcion}` })}${window.RESUMEN.htmlDeHoy()}</div>
                </div>`).join('');
        });
    });
})();
