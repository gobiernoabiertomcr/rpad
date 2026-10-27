/* MAQUETA (27/10/2026): lo que hace andar la página de muestra: las pestañas, el menú lateral, la pestaña Horas extras (la tabla
   real de pestana-real.js, con el día por día nuevo) y la planilla de «Cargar horas extras». Las cuentas de cada día son las que
   pidió el usuario: un día hábil cuenta la salida desde las 15:00 (cada media hora vale desde el minuto 16); un feriado, sábado o
   domingo, los minutos de la entrada a la salida, de a media hora, con 10 minutos de tolerancia. No guarda nada: todo vive en
   memoria y «Volver a los datos de entrada» lo deshace. */
(() => {
    const D = window.DATOS;
    const HOY = D.hoy;
    const copia = (valor) => JSON.parse(JSON.stringify(valor));
    const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const $ = (id) => document.getElementById(id);

    // ------------------------------------------------------------------------------------------------------------ Fechas
    const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dos = (n) => String(n).padStart(2, '0');
    const partes = (fecha) => fecha.split('-').map(Number);
    const diaDeLaSemana = (fecha) => { const [a, m, d] = partes(fecha); return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); };
    const ultimoDia = (mes) => { const [a, m] = partes(mes); return new Date(Date.UTC(a, m, 0)).getUTCDate(); };
    const mesDe = (fecha) => fecha.slice(0, 7);
    const mesMas = (mes, n) => { const [a, m] = partes(mes); const i = a * 12 + (m - 1) + n; return `${Math.floor(i / 12)}-${dos((i % 12) + 1)}`; };
    const nombreDelMes = (mes) => MESES[partes(mes)[1] - 1];
    const tituloDelMes = (mes) => { const n = nombreDelMes(mes); return `${n[0].toUpperCase()}${n.slice(1)} ${partes(mes)[0]}`; };
    const fechaCorta = (fecha) => { const [, m, d] = partes(fecha); return `${DIAS_CORTOS[diaDeLaSemana(fecha)]} ${dos(d)}/${dos(m)}`; };
    const fechaLarga = (fecha) => { const [, m, d] = partes(fecha); return `${DIAS_LARGOS[diaDeLaSemana(fecha)]} ${dos(d)}/${dos(m)}`; };
    const esFinde = (fecha) => [0, 6].includes(diaDeLaSemana(fecha));
    const feriadoDe = (fecha) => D.feriados[fecha] ?? null;
    const licenciaDe = (fecha) => D.licencias.find((l) => l.desde <= fecha && fecha <= l.hasta) ?? null;
    const esInhabil = (fecha) => esFinde(fecha) || feriadoDe(fecha) !== null;
    const minutos = (hora) => (/^\d{2}:\d{2}$/.test(hora ?? '') ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null);
    const conComa = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ','));
    const textoHoras = (n) => `${conComa(n)} ${n === 1 ? 'hora' : 'horas'}`;
    // 18,5 → «2 días de franco y 4,5 horas»; 21 → «3 días de franco»; 4,5 → «4,5 horas» (cada día de franco son 7 horas)
    const enDiasDeFranco = (total) => {
        const dias = Math.floor(total / 7);
        const resto = total - dias * 7;
        const partes = [];
        if (dias > 0) partes.push(`${dias} ${dias === 1 ? 'día' : 'días'} de franco`);
        if (resto > 0) partes.push(textoHoras(resto));
        return partes.join(' y ');
    };

    // ------------------------------------------------------------------------------------------------------------ Las cuentas
    const JORNADA_HASTA = 15 * 60;
    const TOLERANCIA_HABIL = 14;   // la media hora vale desde el minuto 16
    const TOLERANCIA_INHABIL = 10; // pueden faltar hasta 10 minutos

    /** Las horas de un día: { horas } o { error }, o null si no hay salida. */
    const horasDelDia = (fecha, valor) => {
        const salida = minutos(valor?.salida);
        if (salida === null) return null;
        if (esInhabil(fecha)) {
            const entrada = minutos(valor?.entrada);
            if (entrada === null) return { error: 'entrada' };
            if (salida <= entrada) return { error: 'orden' };
            return { horas: Math.floor((salida - entrada + TOLERANCIA_INHABIL) / 30) / 2 };
        }
        const despues = salida - JORNADA_HASTA;
        return { horas: despues < 0 ? 0 : Math.floor((despues + TOLERANCIA_HABIL) / 30) / 2 };
    };

    // ------------------------------------------------------------------------------------------------------------ El estado
    let guardado = copia(D.dias);
    let cambios = {};           // fecha → { entrada, salida, nota } o { quitar: true }
    let agregados = new Set();  // sábados y domingos sumados sin guardar
    let errores = {};           // fecha → mensaje
    let notasAbiertas = new Set();
    let mesPlanilla = mesDe(HOY);
    let mesDelDiaPorDia = mesDe(HOY);
    let vuelveA = null;

    const valorDe = (fecha) => (cambios[fecha]?.quitar ? {} : (cambios[fecha] ?? guardado[fecha] ?? {}));
    const totalDelMes = (mes, conCambios = true) => {
        let total = 0;
        const fuente = conCambios ? { ...guardado, ...cambios } : guardado;
        Object.keys(fuente).filter((f) => mesDe(f) === mes).forEach((f) => {
            const r = horasDelDia(f, conCambios ? valorDe(f) : guardado[f]);
            if (r?.horas) total += r.horas;
        });
        return total;
    };
    const diasDelMes = (mes) => {
        const lista = [];
        for (let d = 1; d <= ultimoDia(mes); d += 1) {
            const f = `${mes}-${dos(d)}`;
            const conDatos = guardado[f] !== undefined && !cambios[f]?.quitar;
            if (!esFinde(f) || conDatos || agregados.has(f) || (cambios[f] && !cambios[f].quitar)) lista.push(f);
        }
        return lista;
    };
    const lunesDe = (fecha) => {
        const [a, m, d] = partes(fecha);
        const dow = diaDeLaSemana(fecha);
        const t = new Date(Date.UTC(a, m - 1, d - (dow === 0 ? 6 : dow - 1)));
        return `${t.getUTCFullYear()}-${dos(t.getUTCMonth() + 1)}-${dos(t.getUTCDate())}`;
    };
    const fechasConCambios = () => Object.keys(cambios).filter((f) => {
        const c = cambios[f];
        if (c.quitar) return true;
        const g = guardado[f] ?? {};
        return (c.entrada ?? '') !== (g.entrada ?? '') || (c.salida ?? '') !== (g.salida ?? '') || (c.nota ?? '') !== (g.nota ?? '');
    });

    // ------------------------------------------------------------------------------------------------------------ Aviso y anuncio
    let reloj = null;
    const aviso = (texto) => {
        const el = $('mq-aviso');
        el.textContent = texto;
        el.classList.add('visible');
        clearTimeout(reloj);
        reloj = setTimeout(() => el.classList.remove('visible'), 2800);
    };
    const anunciar = (texto) => { $('me-anuncio').textContent = ''; setTimeout(() => { $('me-anuncio').textContent = texto; }, 30); };

    // ------------------------------------------------------------------------------------------------------------ La pestaña
    const filaDelDiaPorDia = (f) => {
        const v = guardado[f];
        const r = horasDelDia(f, v);
        const horas = r?.horas ?? 0;
        const cero = horas === 0;
        const marca = feriadoDe(f) ? 'Feriado' : (esFinde(f) ? (diaDeLaSemana(f) === 6 ? 'Sábado' : 'Domingo') : '');
        const horario = esInhabil(f) ? `De ${esc(v.entrada)} a ${esc(v.salida)}` : `Salida ${esc(v.salida)}`;
        const entrada = !esInhabil(f) && v.entrada ? `<span class="me-detalle">Entrada ${esc(v.entrada)}</span>` : '';
        return `<li class="me-fila${cero ? ' tenue' : ''}"><span class="me-fila-fecha">${esc(fechaCorta(f))}${marca ? `<small>${marca}</small>` : ''}</span>`
            + `<span class="me-fila-cuerpo">${horario}${entrada}<span class="me-dia-horas">${cero ? '0' : `${conComa(horas)} h`}</span>`
            + (cero ? '<span class="me-detalle">No llega a media hora</span>' : '')
            + (v.nota ? `<span class="me-detalle me-fila-nota">${esc(v.nota)}</span>` : '') + '</span>'
            + `<button type="button" class="sg-link" data-editar-dia="${f}" aria-label="Editar el ${esc(fechaLarga(f))}">Editar</button></li>`;
    };
    const htmlDelDiaPorDia = (mes) => {
        const fechas = Object.keys(guardado).filter((f) => mesDe(f) === mes).sort();
        if (fechas.length === 0) return '';
        return `<div class="me-tarjeta"><div class="me-cabeza"><h3>${tituloDelMes(mes)}, día por día</h3><span>${textoHoras(totalDelMes(mes, false))}</span></div>`
            + `<ul class="me-lista">${fechas.map(filaDelDiaPorDia).join('')}</ul></div>`;
    };
    const pintarPestana = () => {
        const vista = $('vista-horas');
        vista.innerHTML = window.PESTANA_REAL.tabla + htmlDelDiaPorDia(mesDelDiaPorDia) + window.PESTANA_REAL.noUtilizadas;
        // Las horas de cada mes de la tabla, con lo guardado en la maqueta (la tabla se generó con los datos de entrada)
        vista.querySelectorAll('.me-tabla tbody tr').forEach((tr) => {
            const boton = tr.querySelector('[data-mes]');
            if (!boton) return;
            boton.setAttribute('aria-pressed', String(boton.dataset.mes === mesDelDiaPorDia));
            const total = totalDelMes(boton.dataset.mes, false);
            const celda = tr.querySelector('td.num');
            if (celda) celda.textContent = `${conComa(total)} h`;
            // «A favor en»: el mes y, debajo, lo mismo en días de franco y horas (pedido del usuario)
            const aFavor = tr.children[2];
            if (aFavor && total > 0) aFavor.insertAdjacentHTML('beforeend', `<small>${enDiasDeFranco(total)}</small>`);
        });
    };

    // ------------------------------------------------------------------------------------------------------------ La planilla
    const htmlDeLasHoras = (fecha) => {
        const v = valorDe(fecha);
        const r = horasDelDia(fecha, v);
        if (r === null) {
            if (esInhabil(fecha) && v.entrada) return '<b class="nada">—</b><small>Falta la salida</small>';
            return '<b class="nada">—</b>';
        }
        if (r.error === 'entrada') return '<b class="nada">—</b><small>Poné la entrada</small>';
        if (r.error === 'orden') return '<b class="nada">—</b><small>La salida va después</small>';
        if (r.horas === 0) return '<b class="cero">0</b><small>No llega a media hora</small>';
        return `<b>${conComa(r.horas)} h</b>`;
    };
    const htmlDeLasMarcas = (fecha) => {
        const marcas = [];
        const feriado = feriadoDe(fecha);
        const licencia = licenciaDe(fecha);
        if (feriado) marcas.push(`<span class="me-insignia ambar">Feriado: ${esc(feriado)}</span>`);
        else if (esFinde(fecha)) marcas.push(`<span class="me-insignia borde">${diaDeLaSemana(fecha) === 6 ? 'Sábado' : 'Domingo'}</span>`);
        if (licencia && !licencia.entero) marcas.push(`<span class="me-insignia verde">${esc(licencia.texto)}</span>`);
        return marcas.length ? `<span class="mp-marcas">${marcas.join('')}</span>` : '';
    };
    const htmlDelDia = (fecha) => {
        const v = valorDe(fecha);
        const largo = fechaLarga(fecha);
        const licencia = licenciaDe(fecha);
        const futuro = fecha > HOY;
        const inhabil = esInhabil(fecha);
        const clases = ['mp-dia'];
        if (feriadoDe(fecha)) clases.push('feriado');
        else if (esFinde(fecha)) clases.push('finde');
        if (licencia?.entero) clases.push('licencia');
        if (futuro) clases.push('futuro');
        if (fecha === HOY) clases.push('hoy');
        if (fechasConCambios().includes(fecha)) clases.push('cambiado');
        const fechaHtml = `<span class="mp-fecha"><b id="mp-f-${fecha}">${esc(fechaCorta(fecha))}</b>${htmlDeLasMarcas(fecha)}</span>`;
        if (futuro || licencia?.entero) {
            const texto = futuro
                ? (licencia ? `<span class="me-insignia verde">${esc(licencia.texto)}</span> Todavía no llegó.` : 'Todavía no llegó.')
                : `<span class="me-insignia verde">${esc(licencia.texto)}</span> Es un día de licencia: no se cargan horas.`;
            return `<li class="${clases.join(' ')}" id="mp-dia-${fecha}">${fechaHtml}<span class="mp-lugar">${texto}</span></li>`;
        }
        const error = errores[fecha];
        const invalida = (campo) => (error && error.campo === campo ? ' aria-invalid="true"' : '');
        const descrita = error ? ` aria-describedby="mp-e-${fecha}"` : '';
        const entradaRotulo = inhabil ? 'Entrada' : 'Entrada (opcional)';
        const tieneNota = (v.nota ?? '') !== '';
        const abierta = notasAbiertas.has(fecha);
        const quitar = esFinde(fecha) && !feriadoDe(fecha)
            ? `<button type="button" class="sg-link me-link-rojo" data-quitar="${fecha}" aria-label="Quitar el ${esc(largo)}">Quitar</button>` : '';
        return `<li class="${clases.join(' ')}" id="mp-dia-${fecha}" role="group" aria-labelledby="mp-f-${fecha}">${fechaHtml}`
            + `<label class="mp-campo entrada"><span class="mp-rotulo">${entradaRotulo}</span><input type="time" class="${inhabil ? '' : 'opcional'}" data-campo="entrada" data-fecha="${fecha}" value="${esc(v.entrada ?? '')}" data-vacio="${v.entrada ? 0 : 1}" aria-label="${entradaRotulo} del ${esc(largo)}"${invalida('entrada')}${descrita}></label>`
            + `<label class="mp-campo salida"><span class="mp-rotulo">Salida</span><input type="time" data-campo="salida" data-fecha="${fecha}" value="${esc(v.salida ?? '')}" aria-label="Salida del ${esc(largo)}"${invalida('salida')}${descrita}></label>`
            + `<span class="mp-horas" id="mp-h-${fecha}" aria-live="off">${htmlDeLasHoras(fecha)}</span>`
            + `<span class="mp-acciones">${quitar}<button type="button" class="sg-link" data-nota="${fecha}" aria-expanded="${abierta}" aria-label="${tieneNota ? 'Cambiar la nota' : 'Agregar una nota'} del ${esc(largo)}">${tieneNota ? 'Cambiar nota' : 'Nota'}</button></span>`
            + (abierta ? `<span class="mp-nota-campo"><input type="text" data-campo="nota" data-fecha="${fecha}" value="${esc(v.nota ?? '')}" placeholder="Por ejemplo: cierre del informe mensual" aria-label="Nota del ${esc(largo)}"></span>`
                : (tieneNota ? `<p class="mp-nota-vista">${esc(v.nota)}</p>` : ''))
            + (error ? `<p class="mp-error" id="mp-e-${fecha}">${esc(error.mensaje)}</p>` : '')
            + '</li>';
    };
    const textoDeLaSemana = (fechas, mes) => {
        const dias = fechas.map((f) => partes(f)[2]);
        const de = ` de ${nombreDelMes(mes)}`;
        if (dias.length === 1) return `${dias[0]}${de}`;
        if (dias.length === 2 && dias[1] - dias[0] === 1) return `${dias[0]} y ${dias[1]}${de}`;
        return `${dias[0]} al ${dias[dias.length - 1]}${de}`;
    };
    const totalDeFechas = (fechas) => fechas.reduce((t, f) => t + (horasDelDia(f, valorDe(f))?.horas ?? 0), 0);
    const pintarSuma = () => {
        const total = totalDelMes(mesPlanilla);
        const nombre = nombreDelMes(mesPlanilla);
        const siguiente = nombreDelMes(mesMas(mesPlanilla, 1));
        const enCurso = mesPlanilla === mesDe(HOY);
        // En días de franco (7 horas cada uno) y lo que sobra en horas a favor (pedido del usuario: 18,5 h son «2 días de franco y
        // 4,5 horas a favor»; 21 h, «3 días de franco»)
        const dias = Math.floor(total / 7);
        const resto = total - dias * 7;
        const partesDelTexto = [];
        if (dias > 0) partesDelTexto.push(`<b>${dias} ${dias === 1 ? 'día' : 'días'} de franco</b>`);
        if (resto > 0) partesDelTexto.push(`<b>${textoHoras(resto)} a favor</b>`);
        let texto;
        if (total === 0) texto = enCurso ? `Todavía no sumaste horas extras en ${nombre}.` : `En ${nombre} no hiciste horas extras.`;
        else if (enCurso) texto = `En ${siguiente} vas a tener ${partesDelTexto.join(' y ')}.`;
        else texto = `En ${siguiente} tuviste ${partesDelTexto.join(' y ')}.`;
        $('mp-suma').innerHTML = `<span class="mp-suma-cifra">${conComa(total)}<small>h</small></span><p class="mp-suma-texto">${texto}</p>`;
    };
    const pintarPie = () => {
        const fechas = fechasConCambios();
        if (fechas.length === 0) { $('mp-pendientes').textContent = 'Todo guardado.'; return; }
        const meses = [...new Set(fechas.map(mesDe))].sort().map(nombreDelMes);
        const enMeses = meses.length > 1 ? ` (${meses.slice(0, -1).join(', ')} y ${meses[meses.length - 1]})` : '';
        $('mp-pendientes').innerHTML = `<b>${fechas.length} ${fechas.length === 1 ? 'día' : 'días'}</b> con cambios sin guardar${enMeses}.`;
    };
    const pintarSemanas = () => {
        document.querySelectorAll('.mp-semana').forEach((li) => {
            const fechas = li.dataset.fechas.split(',');
            const total = totalDeFechas(fechas);
            li.lastElementChild.textContent = total ? `${conComa(total)} h` : '—';
        });
    };
    const pintarSumar = () => {
        const libres = [];
        for (let d = 1; d <= ultimoDia(mesPlanilla); d += 1) {
            const f = `${mesPlanilla}-${dos(d)}`;
            if (esFinde(f) && !feriadoDe(f) && f <= HOY && !diasDelMes(mesPlanilla).includes(f)) libres.push(f);
        }
        const area = $('mp-sumar');
        if (libres.length === 0) { area.innerHTML = `<p>No quedan sábados ni domingos para sumar en ${nombreDelMes(mesPlanilla)}.</p>`; return; }
        area.innerHTML = '<label class="form-label" for="mp-finde" style="margin:0">¿Trabajaste un sábado o un domingo?</label>'
            + `<select class="form-select" id="mp-finde">${libres.map((f) => `<option value="${f}">${esc(fechaCorta(f))}</option>`).join('')}</select>`
            + '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" id="mp-sumar-boton">Sumar el día</button>';
    };
    const pintarPlanilla = () => {
        $('mp-mes-titulo').textContent = tituloDelMes(mesPlanilla);
        $('mp-anterior').disabled = mesPlanilla <= D.primerMes;
        $('mp-siguiente').disabled = mesPlanilla >= mesDe(HOY);
        const fechas = diasDelMes(mesPlanilla);
        const semanas = [];
        fechas.forEach((f) => {
            const lunes = lunesDe(f);
            if (!semanas.length || semanas[semanas.length - 1].lunes !== lunes) semanas.push({ lunes, fechas: [] });
            semanas[semanas.length - 1].fechas.push(f);
        });
        $('mp-dias').innerHTML = semanas.map((s) => `<li class="mp-semana" data-fechas="${s.fechas.join(',')}"><span>${textoDeLaSemana(s.fechas, mesPlanilla)}</span><span></span></li>`
            + s.fechas.map(htmlDelDia).join('')).join('');
        // Las listas de la semana no son días: el lector de pantalla las lee como texto
        pintarSemanas();
        pintarSuma();
        pintarPie();
        pintarSumar();
        const pendientes = Object.keys(errores).length;
        $('mp-error').hidden = pendientes === 0;
        $('mp-error').textContent = pendientes ? `Revisá ${pendientes === 1 ? 'el día marcado' : `los ${pendientes} días marcados`}.` : '';
    };
    const repintarDia = (fecha, foco) => {
        const viejo = $(`mp-dia-${fecha}`);
        if (!viejo) return;
        viejo.outerHTML = htmlDelDia(fecha);
        if (foco) $(`mp-dia-${fecha}`).querySelector(`[data-campo="${foco}"]`)?.focus();
    };

    const abrirPlanilla = (mes = mesDe(HOY), foco = null, desde = document.activeElement) => {
        vuelveA = desde;
        mesPlanilla = mes;
        errores = {};
        $('modal-planilla').classList.add('active');
        pintarPlanilla();
        const objetivo = foco ?? (mes === mesDe(HOY) ? HOY : null);
        requestAnimationFrame(() => {
            const fila = objetivo ? $(`mp-dia-${objetivo}`) : null;
            const campo = fila?.querySelector('[data-campo="salida"]') ?? document.querySelector('#mp-dias [data-campo="salida"]');
            fila?.scrollIntoView({ block: 'center' });
            campo?.focus({ preventScroll: Boolean(fila) });
        });
    };
    const cerrarPlanilla = () => {
        $('modal-planilla').classList.remove('active');
        $('modal-confirmar').classList.remove('active');
        cambios = {};
        agregados = new Set();
        errores = {};
        notasAbiertas = new Set();
        vuelveA?.focus?.();
    };
    const pedirCerrar = () => {
        const n = fechasConCambios().length;
        if (n === 0) { cerrarPlanilla(); return; }
        $('mc-texto').textContent = `Los cambios de ${n === 1 ? '1 día' : `${n} días`} se pierden.`;
        $('modal-confirmar').classList.add('active');
        requestAnimationFrame(() => document.querySelector('#modal-confirmar [data-cerrar-confirmar].sg-btn').focus());
    };
    const mensajeDelError = (fecha, v) => {
        const r = horasDelDia(fecha, v);
        const tipo = feriadoDe(fecha) ? 'En un feriado' : 'En un sábado o domingo';
        if (esInhabil(fecha)) {
            if (v.salida && !v.entrada) return { campo: 'entrada', mensaje: `${tipo}, poné también la entrada.` };
            if (v.entrada && !v.salida) return { campo: 'salida', mensaje: 'Falta la salida.' };
            if (r?.error === 'orden') return { campo: 'salida', mensaje: 'La salida tiene que ser después de la entrada.' };
            return null;
        }
        if (v.entrada && !v.salida) return { campo: 'salida', mensaje: 'Falta la salida: es la que cuenta.' };
        return null;
    };
    const guardar = () => {
        const fechas = fechasConCambios();
        errores = {};
        fechas.forEach((f) => {
            if (cambios[f].quitar) return;
            const e = mensajeDelError(f, cambios[f]);
            if (e) errores[f] = e;
        });
        const conError = Object.keys(errores).sort();
        if (conError.length) {
            if (!conError.some((f) => mesDe(f) === mesPlanilla)) mesPlanilla = mesDe(conError[0]);
            pintarPlanilla();
            const primero = conError.find((f) => mesDe(f) === mesPlanilla);
            $(`mp-dia-${primero}`)?.querySelector(`[data-campo="${errores[primero].campo}"]`)?.focus();
            return;
        }
        fechas.forEach((f) => {
            const c = cambios[f];
            if (c.quitar || (!c.entrada && !c.salida && !c.nota)) delete guardado[f];
            else guardado[f] = { ...(c.entrada ? { entrada: c.entrada } : {}), ...(c.salida ? { salida: c.salida } : {}), ...(c.nota ? { nota: c.nota } : {}) };
        });
        const n = fechas.length;
        cerrarPlanilla();
        if (n === 0) return;
        mesDelDiaPorDia = mesDe(fechas.sort()[fechas.length - 1]);
        pintarPestana();
        aviso(`Horas extras guardadas: ${n === 1 ? '1 día' : `${n} días`}.`);
        anunciar(`Horas extras guardadas: ${n === 1 ? '1 día' : `${n} días`}.`);
    };

    // ------------------------------------------------------------------------------------------------------------ Los eventos
    document.addEventListener('input', (evento) => {
        const campo = evento.target.closest('#mp-dias [data-campo]');
        if (!campo) return;
        const fecha = campo.dataset.fecha;
        const anterior = valorDe(fecha);
        cambios[fecha] = { entrada: anterior.entrada ?? '', salida: anterior.salida ?? '', nota: anterior.nota ?? '', [campo.dataset.campo]: campo.value };
        if (campo.dataset.campo === 'entrada') campo.dataset.vacio = campo.value ? '0' : '1';
        if (errores[fecha]) { delete errores[fecha]; repintarDia(fecha, campo.dataset.campo); }
        $(`mp-h-${fecha}`).innerHTML = htmlDeLasHoras(fecha);
        $(`mp-dia-${fecha}`).classList.toggle('cambiado', fechasConCambios().includes(fecha));
        pintarSemanas();
        pintarSuma();
        pintarPie();
    });
    // Enter en una salida lleva a la salida del día siguiente
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape') {
            if ($('modal-confirmar').classList.contains('active')) { $('modal-confirmar').classList.remove('active'); return; }
            if ($('modal-planilla').classList.contains('active')) { pedirCerrar(); return; }
        }
        if (evento.key === 'Enter' && evento.target.matches('#mp-dias [data-campo="salida"], #mp-dias [data-campo="nota"]')) {
            evento.preventDefault();
            const salidas = [...document.querySelectorAll('#mp-dias [data-campo="salida"]')];
            const fila = evento.target.closest('.mp-dia');
            const siguiente = salidas.find((s) => s.closest('.mp-dia').compareDocumentPosition(fila) & Node.DOCUMENT_POSITION_PRECEDING);
            (siguiente ?? $('mp-guardar')).focus();
        }
    });
    document.addEventListener('click', (evento) => {
        const t = evento.target;
        if (t.closest('[data-abrir-planilla], [data-cargar="horas"]')) { abrirPlanilla(mesDe(HOY), null, t.closest('button')); return; }
        const editar = t.closest('[data-editar-dia]');
        if (editar) { abrirPlanilla(mesDe(editar.dataset.editarDia), editar.dataset.editarDia, editar); return; }
        const mes = t.closest('[data-mes]');
        if (mes) { mesDelDiaPorDia = mes.dataset.mes; pintarPestana(); document.querySelector(`[data-mes="${mesDelDiaPorDia}"]`)?.focus(); return; }
        if (t.closest('#modal-planilla [data-cerrar]')) { pedirCerrar(); return; }
        if (t.closest('[data-cerrar-confirmar]')) { $('modal-confirmar').classList.remove('active'); $('mp-guardar').focus(); return; }
        if (t.closest('#mc-salir')) { cerrarPlanilla(); return; }
        if (t.closest('#mp-guardar')) { guardar(); return; }
        if (t.closest('#mp-anterior')) { mesPlanilla = mesMas(mesPlanilla, -1); pintarPlanilla(); $('mp-cuerpo').scrollTop = 0; anunciar(tituloDelMes(mesPlanilla)); return; }
        if (t.closest('#mp-siguiente')) { mesPlanilla = mesMas(mesPlanilla, 1); pintarPlanilla(); $('mp-cuerpo').scrollTop = 0; anunciar(tituloDelMes(mesPlanilla)); return; }
        const nota = t.closest('[data-nota]');
        if (nota) {
            const f = nota.dataset.nota;
            if (notasAbiertas.has(f)) notasAbiertas.delete(f); else notasAbiertas.add(f);
            repintarDia(f, notasAbiertas.has(f) ? 'nota' : null);
            if (!notasAbiertas.has(f)) $(`mp-dia-${f}`).querySelector('[data-nota]')?.focus();
            return;
        }
        if (t.closest('#mp-sumar-boton')) {
            const f = $('mp-finde').value;
            agregados.add(f);
            pintarPlanilla();
            const fila = $(`mp-dia-${f}`);
            fila.scrollIntoView({ block: 'center' });
            fila.querySelector('[data-campo="entrada"]').focus();
            return;
        }
        const quitar = t.closest('[data-quitar]');
        if (quitar) {
            const f = quitar.dataset.quitar;
            agregados.delete(f);
            if (guardado[f]) cambios[f] = { quitar: true }; else delete cambios[f];
            delete errores[f];
            pintarPlanilla();
            $('mp-guardar').focus();
            return;
        }
        // Las pestañas
        const pestana = t.closest('[data-pestana]');
        if (pestana) {
            document.querySelectorAll('[data-pestana]').forEach((b) => {
                const si = b === pestana;
                b.setAttribute('aria-selected', String(si));
                b.tabIndex = si ? 0 : -1;
                $(`vista-${b.dataset.pestana}`).hidden = !si;
            });
            return;
        }
        const accion = t.closest('[data-maqueta-accion]');
        if (accion) { aviso(`En la maqueta, «${accion.dataset.maquetaAccion}» no se abre.`); return; }
        // La barra de la maqueta
        const mq = t.closest('[data-mq]');
        if (mq) {
            if (mq.dataset.mq === 'abrir') abrirPlanilla(mesDe(HOY), null, mq);
            if (mq.dataset.mq === 'septiembre') abrirPlanilla('2026-09', null, mq);
            if (mq.dataset.mq === 'reiniciar') {
                guardado = copia(D.dias);
                mesDelDiaPorDia = mesDe(HOY);
                cerrarPlanilla();
                pintarPestana();
                aviso('Volvieron los datos de entrada.');
            }
        }
    });

    // El menú lateral
    const sidebar = $('sidebar');
    const velo = $('sidebarOverlay');
    const boton = $('sidebarToggle');
    const abrirMenu = (si) => {
        sidebar.classList.toggle('open', si);
        velo.classList.toggle('visible', si);
        boton.setAttribute('aria-expanded', String(si));
    };
    boton.addEventListener('click', () => abrirMenu(!sidebar.classList.contains('open')));
    velo.addEventListener('click', () => abrirMenu(false));
    requestAnimationFrame(() => [sidebar, velo, boton].forEach((el) => el.classList.add('menu-animable')));

    pintarPestana();
    // ?abrir=2026-10 abre la planilla en ese mes (para mirarla directo)
    const pedido = new URLSearchParams(location.search).get('abrir');
    if (pedido) abrirPlanilla(/^\d{4}-\d{2}$/.test(pedido) ? pedido : mesDe(HOY), null, null);
})();
