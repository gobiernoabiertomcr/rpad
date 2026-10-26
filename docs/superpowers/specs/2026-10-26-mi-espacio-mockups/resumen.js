/* MAQUETA de Mi espacio (26/10/2026): el Resumen. «Vence pronto», la libreta de días (una ficha por día o por hora) y «Hoy».
   Lo dibuja en cada [data-resumen], para las dos personas de «Ver como» (solo-permanente y solo-contrato). Datos inventados.

   Fichas: U usada, R cargada a futuro (ya descontada), D disponible, N todavía no se habilita, M media hora disponible,
   G no utilizada previamente. */
(() => {
    const DATOS = {
        permanente: {
            vence: [
                { dia: '30', mes: 'oct', semana: 'Viernes', titulo: '1 franco compensatorio de octubre', detalle: 'Es el último día hábil del mes. Si no lo usás, queda como no utilizado previamente.', accion: 'Cargarlo' },
                { dia: '31', mes: 'dic', semana: 'Jueves', titulo: '3 días de la licencia 2024', detalle: 'Ese día vence la licencia 2024.', accion: 'Cargar vacaciones' },
            ],
            vacaciones: {
                total: '33', anio: '20 días por año',
                licencias: [
                    { nombre: 'Licencia 2024', mitades: [{ fichas: 'UUUUUUUUUU', rotulo: '1/7/2024' }, { fichas: 'UURRRRRDDD', rotulo: '1/1/2025' }], quedan: '3', nota: 'Vence el 31/12/2026', vence: true },
                    { nombre: 'Licencia 2025', mitades: [{ fichas: 'DDDDDDDDDD', rotulo: '1/7/2025' }, { fichas: 'DDDDDDDDDD', rotulo: '1/1/2026' }], quedan: '20', nota: 'Vence el 31/12/2027' },
                    { nombre: 'Licencia 2026', mitades: [{ fichas: 'DDDDDDDDDD', rotulo: '1/7/2026' }, { fichas: 'NNNNNNNNNN', rotulo: '1/1/2027' }], quedan: '10', nota: 'La otra mitad se habilita el 1/1/2027' },
                ],
                pie: 'Las vacaciones del 03/11 al 09/11 salen de la licencia 2024, la más vieja.',
            },
            filas: [
                { nombre: 'Franquicias', grupos: 7, fichas: 'U'.repeat(17) + 'D'.repeat(25), hora: true, numero: '25', unidad: 'horas', nota: 'De 42 en 2026. Cada grupo es un día de 7 horas.' },
                { nombre: 'Estudios', grupos: 3, fichas: 'U'.repeat(6) + 'D'.repeat(9), numero: '9', unidad: 'días', nota: 'Universitario: 15 en 2026, hasta 3 por examen.' },
                { nombre: 'Atención médica', grupos: 5, fichas: 'U'.repeat(3) + 'D'.repeat(22), numero: '22', unidad: 'días', nota: 'De 25 en 2026.' },
                { nombre: 'Grupo familiar', grupos: 5, fichas: 'U'.repeat(2) + 'D'.repeat(23), numero: '23', unidad: 'días', nota: 'De 25 en 2026.' },
            ],
            francos: [
                { mes: 'Octubre', fichas: 'UD', nota: 'Uno usado el 23/10. El otro, hasta el viernes 30/10.', vence: true },
                { mes: 'Noviembre', fichas: 'D', nota: 'Por las horas extras de septiembre.' },
                { mes: 'Diciembre', fichas: 'N', nota: 'Por las de octubre, que siguen sumando: 10,5 horas.' },
                { mes: 'Agosto', fichas: 'G', nota: 'No utilizado previamente.' },
            ],
            extraordinaria: 'Sin tope y aparte de los 25 días: no usaste en 2026.',
        },
        contrato: {
            vence: [
                { dia: '30', mes: 'oct', semana: 'Viernes', titulo: '1,5 horas a favor de octubre', detalle: 'Es el último día hábil del mes. Lo que no uses pasa a horas no utilizadas previamente.', accion: 'Usarlas' },
            ],
            vacaciones: {
                total: '13', anio: '15 días por año',
                licencias: [
                    { nombre: 'Licencia 2025', mitades: [{ fichas: 'UUUUUUUU', rotulo: '1/7/2025' }, { fichas: 'UUDDDDD', rotulo: '1/1/2026' }], quedan: '5', nota: 'Vence el 31/12/2027' },
                    { nombre: 'Licencia 2026', mitades: [{ fichas: 'DDDDDDDD', rotulo: '1/7/2026' }, { fichas: 'NNNNNNN', rotulo: '1/1/2027' }], quedan: '8', nota: 'La otra mitad se habilita el 1/1/2027' },
                ],
                pie: 'La licencia 2024 ya está usada.',
            },
            filas: [
                { nombre: 'Horas a favor de octubre', grupos: 7, fichas: 'U'.repeat(9) + 'D' + 'M', hora: true, numero: '1,5', unidad: 'horas', nota: 'De 10,5, por las horas extras de septiembre.', vence: true },
                { nombre: 'Horas a favor de noviembre', grupos: 7, fichas: 'NNNN', hora: true, numero: '4', unidad: 'horas', nota: 'Por las horas extras de octubre, que siguen sumando.' },
                { nombre: 'No utilizadas previamente', grupos: 7, fichas: 'GGGGGGM', hora: true, numero: '6,5', unidad: 'horas', nota: 'En 2026. Vuelven a cero el 1/1.', gris: true },
                { nombre: 'Estudios', grupos: 3, fichas: 'U'.repeat(3) + 'D'.repeat(7), numero: '7', unidad: 'días', nota: 'Secundario: 10 en 2026, hasta 3 por examen.' },
                { nombre: 'Atención médica', grupos: 5, fichas: 'D'.repeat(25), numero: '25', unidad: 'días', nota: 'De 25 en 2026.' },
                { nombre: 'Grupo familiar', grupos: 5, fichas: 'U'.repeat(3) + 'R' + 'D'.repeat(21), numero: '21', unidad: 'días', nota: 'De 25 en 2026. Uno cargado para el 30/10.' },
            ],
            francos: null,
            extraordinaria: 'Sin tope y aparte de los 25 días: no usaste en 2026.',
        },
    };

    const CLASE = { U: 'u', R: 'r', D: 'd', N: 'n', M: 'm', G: 'g' };
    const fichas = (texto, { grupos = 0, hora = false } = {}) => {
        const piezas = [...texto].map((f) => `<i class="fi ${hora ? 'hora ' : ''}${CLASE[f]}"></i>`);
        if (!grupos) return piezas.join('');
        const bloques = [];
        for (let i = 0; i < piezas.length; i += grupos) bloques.push(`<span class="fi-grupo">${piezas.slice(i, i + grupos).join('')}</span>`);
        return bloques.join('');
    };
    const contar = (texto, letras) => [...texto].filter((f) => letras.includes(f)).length;

    const htmlDeVence = (vence) => `
        <section class="rs-vence" aria-labelledby="rs-vence-titulo">
            <h2 id="rs-vence-titulo" class="rs-titulo">Vence pronto</h2>
            <ol class="rs-vence-lista">
                ${vence.map((v) => `
                <li class="rs-vence-item">
                    <span class="rs-fecha" aria-hidden="true"><b>${v.dia}</b>${v.mes}</span>
                    <span class="rs-vence-texto"><span class="rs-vence-cuando">${v.semana} ${v.dia}/${v.mes === 'oct' ? '10' : '12'}</span><b>${v.titulo}</b><span>${v.detalle}</span></span>
                    <a class="sg-btn sg-btn-borde sg-btn-chico" href="2-formularios.html#licencia">${v.accion}</a>
                </li>`).join('')}
            </ol>
        </section>`;

    const htmlDeVacaciones = (vac) => `
        <div class="rs-bloque rs-vacaciones">
            <div class="rs-bloque-cabeza">
                <h3>Vacaciones</h3>
                <span class="rs-numero"><b>${vac.total}</b> días hábiles</span>
            </div>
            ${vac.licencias.map((l) => {
                const disponibles = l.mitades.reduce((n, m) => n + contar(m.fichas, 'D'), 0);
                return `
            <div class="rs-licencia${l.vence ? ' vence' : ''}">
                <span class="rs-rotulo">${l.nombre}</span>
                <span class="rs-mitades" role="img" aria-label="${l.nombre}: ${disponibles} días disponibles. ${l.nota}.">
                    ${l.mitades.map((m) => `<span class="rs-mitad"><span class="rs-fichas" aria-hidden="true">${fichas(m.fichas)}</span><span class="rs-desde" aria-hidden="true">desde el ${m.rotulo}</span></span>`).join('')}
                </span>
                <span class="rs-queda"><b>${l.quedan}</b><span>${l.nota}</span></span>
            </div>`;
            }).join('')}
            <p class="rs-pie">${vac.anio}, en dos mitades: el 1/7 y el 1/1. Se usa primero la licencia más vieja. ${vac.pie}</p>
        </div>`;

    const htmlDeFila = (f) => `
        <div class="rs-fila${f.vence ? ' vence' : ''}${f.gris ? ' gris' : ''}">
            <span class="rs-rotulo">${f.nombre}</span>
            <span class="rs-fichas${f.hora ? ' de-horas' : ''}" role="img" aria-label="${f.nombre}: quedan ${f.numero} ${f.unidad}. ${f.nota}">${fichas(f.fichas, { grupos: f.grupos, hora: f.hora })}</span>
            <span class="rs-queda"><b>${f.numero}</b><span>${f.unidad}</span></span>
            <span class="rs-nota">${f.nota}</span>
        </div>`;

    const htmlDeFrancos = (francos) => !francos ? '' : `
        <div class="rs-fila rs-francos">
            <span class="rs-rotulo">Francos compensatorios</span>
            <ul class="rs-meses">
                ${francos.map((m) => `<li class="${m.vence ? 'vence' : ''}"><span class="rs-fichas" aria-hidden="true">${fichas(m.fichas)}</span><span><b>${m.mes}</b>${m.nota}</span></li>`).join('')}
            </ul>
        </div>`;

    const htmlDeLibreta = (d) => `
        <section class="rs-libreta" aria-labelledby="rs-libreta-titulo">
            <div class="rs-libreta-cabeza">
                <h2 id="rs-libreta-titulo" class="rs-titulo">Lo que te queda</h2>
                <span>Al lunes 26/10/2026 · <a class="sg-link" href="2-formularios.html#anio">Mis vacaciones y saldos</a></span>
            </div>
            ${htmlDeVacaciones(d.vacaciones)}
            <div class="rs-bloque">
                ${d.filas.map(htmlDeFila).join('')}
                ${htmlDeFrancos(d.francos)}
                <div class="rs-fila rs-sin-fichas"><span class="rs-rotulo">Médica extraordinaria</span><span class="rs-nota">${d.extraordinaria}</span></div>
            </div>
            <p class="rs-leyenda" aria-hidden="true">
                <span><i class="fi u"></i>Usado</span><span><i class="fi r"></i>Cargado a futuro</span><span><i class="fi d"></i>Disponible</span><span><i class="fi n"></i>Todavía no se habilita</span><span><i class="fi g"></i>No utilizado previamente</span>
            </p>
        </section>`;

    const htmlDeHoy = () => `
        <aside class="rs-hoy" aria-labelledby="rs-hoy-titulo">
            <h2 id="rs-hoy-titulo" class="rs-titulo">Hoy y mañana</h2>
            <ol class="rs-agenda">
                <li><span class="rs-hora">12:00</span><span><b>Llamar a Vialidad por el TMDA</b><small>Hoy · solo vos</small></span></li>
                <li class="compartido"><span class="rs-hora">10:00</span><span><b>Reunión de equipo</b><small>Mañana · con 4 personas</small></span></li>
                <li class="compartido"><span class="rs-hora">09:00</span><span><b>Entrega del informe trimestral</b><small>Jueves 29 · de Martín Ríos</small></span></li>
            </ol>
            <a class="sg-link" href="#agenda" onclick="document.getElementById('tab-agenda')?.click()">Ver la agenda</a>
            <h3 class="rs-subtitulo">No están</h3>
            <p class="rs-ausente"><span class="rs-inicial" aria-hidden="true">MR</span><span><b>Martín Ríos</b><small>Vuelve el lunes 02/11</small></span></p>
            <h3 class="rs-subtitulo">Próximo feriado</h3>
            <p class="rs-feriado"><b>Lunes 23/11</b>Día de la Soberanía Nacional</p>
        </aside>`;

    const htmlDelResumen = (clave) => {
        const d = DATOS[clave];
        return `<div class="rs solo-${clave}">${htmlDeVence(d.vence)}<div class="rs-grilla">${htmlDeLibreta(d)}${htmlDeHoy()}</div></div>`;
    };

    // Para las opciones del Resumen (4-resumen-opciones.html): «Vence pronto» y «Hoy» son los mismos en todas
    window.RESUMEN = { htmlDeVence: (clave) => htmlDeVence(DATOS[clave].vence), htmlDeHoy };

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('[data-resumen]').forEach((el) => {
            el.innerHTML = htmlDelResumen('permanente') + htmlDelResumen('contrato');
            // El orden en que se llenan las fichas usadas de las vacaciones (el único movimiento de la página)
            el.querySelectorAll('.rs').forEach((rs) => rs.querySelectorAll('.rs-vacaciones .fi.u, .rs-vacaciones .fi.r').forEach((f, i) => f.style.setProperty('--i', i)));
        });
    });
})();
