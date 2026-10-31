/* MAQUETA (30/10/2026): lo que hace andar la página de muestra de «Sumar a {mes anterior}» en la planilla de horas extras de
   contrato. Lo que arma el HTML son copias de las funciones de public/js/mi-espacio.js de hoy (htmlDeLaPlanilla,
   htmlDeLaFilaDeLaPlanilla, htmlDeLasHorasDeLaFila, htmlDeLaBandaDeLaPlanilla, htmlDelPieDeLaPlanilla, htmlDelSumarDeLaPlanilla,
   textoDeComoSeCuentan, htmlDeTablaDeHorasAFavor, htmlDeDiaPorDiaDeSalidas, htmlDeNoUtilizadas y htmlDelSegundoPaso) y de
   htmlDeLaNota (services/miEspacioNota.js), con lo nuevo marcado «NUEVO». Lo que en la página real manda el servidor (la planilla
   de un mes, la tabla de la pestaña, la nota) lo arma acá la sección «Lo que mandaría el servidor», con los datos INVENTADOS de
   datos.js. No guarda nada: todo vive en memoria y «Volver a los datos de entrada» lo deshace. */
(() => {
    'use strict';
    const D = window.DATOS;
    const HOY = D.hoy;
    const MES_DE_HOY = HOY.slice(0, 7);
    const $ = (id) => document.getElementById(id);
    const copia = (valor) => JSON.parse(JSON.stringify(valor));

    // =================================================================================================================
    // Copias de lo puro de public/js/mi-espacio.js (y de Utils.escapeHtml de api.js)
    // =================================================================================================================
    const escapeHtml = (text) => (!text ? '' : String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
    const esObjeto = (valor) => valor !== null && typeof valor === 'object' && !Array.isArray(valor);
    const listaDe = (valor) => (Array.isArray(valor) ? valor.filter(esObjeto) : []);
    const esc = (valor) => escapeHtml(String(valor ?? ''));
    const deMapa = (mapa, clave, reserva) => (esObjeto(mapa) && Object.hasOwn(mapa, clave) ? mapa[clave] : reserva);
    const conTexto = (valor) => typeof valor === 'string' && valor.trim() !== '';
    const comoTexto = (valor) => (typeof valor === 'string' ? valor : '');
    const delAnio = (anio) => (Number.isInteger(anio) ? ` de ${String(anio)}` : '');
    const enElAnio = (anio) => (Number.isInteger(anio) ? ` en ${String(anio)}` : '');
    const numeroConComa = (valor) => {
        const numero = Math.round(Number(valor) * 10) / 10;
        return Number.isFinite(numero) ? String(numero).replace('.', ',') : '—';
    };
    const NOMBRES_DE_LOS_MESES = Object.freeze(['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
        'septiembre', 'octubre', 'noviembre', 'diciembre']);
    const nombreDelMes = (mes, mas = 0) => NOMBRES_DE_LOS_MESES[(Number(mes.slice(5, 7)) - 1 + mas) % 12];
    const textoDeHoras = (horas) => `${numeroConComa(horas)} ${horas === 1 ? 'hora' : 'horas'}`;
    const NOMBRES_DE_LOS_DIAS = Object.freeze(['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']);
    const DIAS_CORTOS = Object.freeze(['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']);
    const diaUtc = (iso) => { const [a, m, d] = iso.split('-').map(Number); return Date.UTC(a, m - 1, d); };
    const fechaDeUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
    const sumarDiasA = (fecha, dias) => fechaDeUtc(diaUtc(fecha) + dias * 86400000);
    const lugarEnLaSemana = (fecha) => (new Date(diaUtc(fecha)).getUTCDay() + 6) % 7;
    const diaLargoDe = (fecha) => `${NOMBRES_DE_LOS_DIAS[lugarEnLaSemana(fecha)]} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
    const esFechaDeTexto = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && fechaDeUtc(diaUtc(valor)) === valor;
    const esMesDeTexto = (mes) => typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
        && Number(mes.slice(0, 4)) >= 2000 && Number(mes.slice(0, 4)) <= 2100;
    function mesVecino(mes, n) {
        if (!esMesDeTexto(mes) || !Number.isInteger(n)) return null;
        const indice = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + n;
        const vecino = `${String(Math.floor(indice / 12))}-${String((indice % 12) + 1).padStart(2, '0')}`;
        return esMesDeTexto(vecino) ? vecino : null;
    }
    function tituloDelMes(mes) {
        if (!esMesDeTexto(mes)) return '';
        const nombre = nombreDelMes(mes);
        return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${mes.slice(0, 4)}`;
    }
    const listaConY = (nombres) => (nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join(''));

    const JORNADA = 7;
    const LARGO_NOTA = 200;
    const MENSAJES_FORMULARIOS = Object.freeze({
        nota: 'La nota puede tener hasta 200 caracteres.',
        horaSalida: 'Escribí la hora como 16:45.',
        salidaQueCuenta: 'Falta la salida: es la que cuenta.',
        salidaFalta: 'Falta la salida.',
        entradaFeriado: 'En un feriado, poné también la entrada.',
        entradaFinde: 'En un sábado o domingo, poné también la entrada.',
        salidaAntes: 'La salida tiene que ser después de la entrada.'
    });
    const SALIDA_DE_LA_JORNADA = '15:00';
    const TOLERANCIA_DIA_HABIL = 14;
    const TOLERANCIA_DIA_INHABIL = 10;
    const TIPOS_DE_DIA = Object.freeze(['habil', 'feriado', 'finde']);
    const minutosDeLaSalida = (hora) => (typeof hora === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora)
        ? Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3)) : null);
    function horasDelDiaDeLaPlanilla(dia) {
        if (!esObjeto(dia) || !TIPOS_DE_DIA.includes(dia.tipo)) return null;
        const salida = minutosDeLaSalida(dia.salida);
        if (salida === null) return null;
        const entrada = minutosDeLaSalida(dia.entrada);
        if (entrada !== null && salida <= entrada) return null;
        if (dia.tipo === 'habil') {
            const minutos = Math.max(0, salida - minutosDeLaSalida(SALIDA_DE_LA_JORNADA));
            return Math.floor((minutos + TOLERANCIA_DIA_HABIL) / 30) / 2;
        }
        if (entrada === null) return null;
        return Math.floor((salida - entrada + TOLERANCIA_DIA_INHABIL) / 30) / 2;
    }
    const diasYHorasDeLaPlanilla = (horas) => {
        if (typeof horas !== 'number' || !Number.isFinite(horas) || horas <= 0) return { dias: 0, resto: 0 };
        const total = Math.round(horas * 10) / 10;
        const dias = Math.floor(total / JORNADA);
        return { dias, resto: Math.round((total - dias * JORNADA) * 10) / 10 };
    };
    const partesEnDiasDeFranco = (horas) => {
        const { dias, resto } = diasYHorasDeLaPlanilla(horas);
        return [dias > 0 ? `${dias} ${dias === 1 ? 'día' : 'días'} de franco` : '', resto > 0 ? textoDeHoras(resto) : '']
            .filter((parte) => parte !== '');
    };
    const enDiasDeFranco = (horas) => partesEnDiasDeFranco(horas).join(' y ');

    /* La frase de la banda. NUEVO: el verbo mira el mes en que se usan las horas (el siguiente), no solo el mes trabajado: si ese mes
       ya pasó, «tuviste»; si es el de hoy, «tenés» (la real decía «tuviste» en enero aunque febrero estuviera en curso); si todavía
       no llegó, «vas a tener». El caso sin horas, como antes */
    const fraseDeLaSumaDelMes = (mes, horas, hoy, marcar) => {
        if (!esMesDeTexto(mes) || !esFechaDeTexto(hoy)) return '';
        const mesDeHoy = hoy.slice(0, 7);
        const partes = partesEnDiasDeFranco(horas);
        if (partes.length === 0) {
            return mes < mesDeHoy ? `En ${nombreDelMes(mes)} no hiciste horas extras.` : `Todavía no sumaste horas extras en ${nombreDelMes(mes)}.`;
        }
        const deUso = mesVecino(mes, 1);
        let verbo = 'vas a tener';
        if (deUso < mesDeHoy) verbo = 'tuviste';
        else if (deUso === mesDeHoy) verbo = 'tenés';
        const aFavor = diasYHorasDeLaPlanilla(horas).resto > 0 ? ' a favor' : '';
        const marcadas = partes.map((parte, indice) => marcar(indice === partes.length - 1 ? `${parte}${aFavor}` : parte));
        return `En ${nombreDelMes(mes, 1)} ${verbo} ${marcadas.join(' y ')}.`;
    };

    const esMapa = (valor) => valor !== null && typeof valor === 'object' && typeof valor.get === 'function'
        && typeof valor.has === 'function' && typeof valor[Symbol.iterator] === 'function';
    const esConjunto = (valor) => valor !== null && typeof valor === 'object' && typeof valor.has === 'function';
    const cambioDe = (cambios, fecha) => (esMapa(cambios) ? cambios.get(fecha) : undefined);
    const tieneEn = (conjunto, fecha) => esConjunto(conjunto) && conjunto.has(fecha) === true;
    const esFinDeSemana = (fecha) => lugarEnLaSemana(fecha) >= 5;
    const horaDelCampo = (valor) => {
        if (typeof valor !== 'string') return '';
        const limpio = valor.trim();
        return /^\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(limpio) ? limpio.slice(0, 5) : limpio;
    };
    // NUEVO: lo de un día suma `al_mes_anterior` (el tilde), que vale solo con una salida: sin salida, el día es un borrado
    const valoresDeLaSalida = (fuente) => {
        const datos = esObjeto(fuente) && fuente.quitar !== true ? fuente : {};
        const salida = horaDelCampo(datos.salida);
        return { entrada: horaDelCampo(datos.entrada), salida, nota: comoTexto(datos.nota).trim(),
            al_mes_anterior: salida !== '' && datos.al_mes_anterior === true };
    };
    const valorDelDia = (dia, cambio) => {
        const fuente = esObjeto(cambio) ? cambio : (esObjeto(dia) ? dia : {});
        if (fuente.quitar === true) return { entrada: '', salida: '', nota: '', al_mes_anterior: false };
        return { entrada: comoTexto(fuente.entrada), salida: comoTexto(fuente.salida), nota: comoTexto(fuente.nota),
            al_mes_anterior: fuente.al_mes_anterior === true };
    };
    // NUEVO: tildar o destildar es un cambio (el pie lo cuenta), como la entrada, la salida y la nota
    function fechasCambiadas(cambios) {
        if (!esMapa(cambios)) return [];
        const fechas = [];
        for (const [fecha, cambio] of cambios) {
            if (!esFechaDeTexto(fecha)) continue;
            const ahora = valoresDeLaSalida(cambio);
            const antes = valoresDeLaSalida(diaDelServidor(fecha));
            if (ahora.entrada !== antes.entrada || ahora.salida !== antes.salida || ahora.nota !== antes.nota
                || ahora.al_mes_anterior !== antes.al_mes_anterior) fechas.push(fecha);
        }
        return fechas.sort();
    }
    const largoDeLaNota = (nota) => Array.from(comoTexto(nota).trim()).length;
    const errorDeLaSalida = (tipo, { entrada, salida, nota }) => {
        if (entrada === '' && salida === '' && nota === '') return null;
        if (entrada !== '' && minutosDeLaSalida(entrada) === null) return { campo: 'entrada', mensaje: MENSAJES_FORMULARIOS.horaSalida };
        if (salida !== '' && minutosDeLaSalida(salida) === null) return { campo: 'salida', mensaje: MENSAJES_FORMULARIOS.horaSalida };
        if (salida === '') {
            return { campo: 'salida', mensaje: tipo === 'habil' ? MENSAJES_FORMULARIOS.salidaQueCuenta : MENSAJES_FORMULARIOS.salidaFalta };
        }
        if (tipo !== 'habil' && entrada === '') {
            return { campo: 'entrada', mensaje: tipo === 'feriado' ? MENSAJES_FORMULARIOS.entradaFeriado : MENSAJES_FORMULARIOS.entradaFinde };
        }
        if (entrada !== '' && minutosDeLaSalida(salida) <= minutosDeLaSalida(entrada)) {
            return { campo: 'salida', mensaje: MENSAJES_FORMULARIOS.salidaAntes };
        }
        if (largoDeLaNota(nota) > LARGO_NOTA) return { campo: 'nota', mensaje: MENSAJES_FORMULARIOS.nota };
        return null;
    };

    function diasVisiblesDeLaPlanilla(planilla, estado) {
        const { cambios = null, agregados = null } = esObjeto(estado) ? estado : {};
        if (!esObjeto(planilla)) return [];
        const visibles = new Map();
        for (const dia of listaDe(planilla.dias)) {
            if (!esFechaDeTexto(dia.fecha) || visibles.has(dia.fecha)) continue;
            const quitado = cambioDe(cambios, dia.fecha)?.quitar === true;
            if (!esFinDeSemana(dia.fecha) || !quitado || tieneEn(agregados, dia.fecha)) visibles.set(dia.fecha, dia);
        }
        for (const dia of listaDe(planilla.fines_de_semana)) {
            if (esFechaDeTexto(dia.fecha) && !visibles.has(dia.fecha) && tieneEn(agregados, dia.fecha)) visibles.set(dia.fecha, dia);
        }
        return [...visibles.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    }
    function finesDeSemanaParaSumar(planilla, estado) {
        if (!esObjeto(planilla)) return [];
        const visibles = new Set(diasVisiblesDeLaPlanilla(planilla, estado).map((dia) => dia.fecha));
        const libres = new Map();
        for (const dia of [...listaDe(planilla.dias), ...listaDe(planilla.fines_de_semana)]) {
            if (esFechaDeTexto(dia.fecha) && esFinDeSemana(dia.fecha) && !visibles.has(dia.fecha)) libres.set(dia.fecha, dia);
        }
        return [...libres.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    }

    // NUEVO: las horas de un día con lo de la página encima, y si suman al mes anterior (tildado y con una salida)
    const horasDelDia = (dia, cambios) => horasDelDiaDeLaPlanilla({ tipo: dia.tipo, ...valoresDeLaSalida(valorDelDia(dia, cambioDe(cambios, dia.fecha))) });
    const sumaAlAnterior = (dia, cambios) => valoresDeLaSalida(valorDelDia(dia, cambioDe(cambios, dia.fecha))).al_mes_anterior;
    // Lo que suman unos días en su propio mes: NUEVO, sin los que suman al mes anterior (la banda y el total de cada semana)
    const horasDeLosDias = (dias, cambios) => listaDe(dias)
        .reduce((suma, dia) => suma + (sumaAlAnterior(dia, cambios) ? 0 : (horasDelDia(dia, cambios) ?? 0)), 0);
    // NUEVO: los días de un mes que suman al anterior, con sus horas (los tildados, con o sin horas)
    const diasQueSumanAlAnterior = (dias, cambios) => listaDe(dias).filter((dia) => sumaAlAnterior(dia, cambios))
        .map((dia) => ({ dia, horas: horasDelDia(dia, cambios) ?? 0 }));
    const sumaDe = (lista) => lista.reduce((suma, uno) => suma + uno.horas, 0);

    /* NUEVO: la segunda línea de la banda. Lo que viene del mes siguiente («Incluye 1,5 h de febrero.») y lo que se va al anterior
       («1,5 h del martes 02/02 suman a enero.», «3,5 h del martes 02/02 y del jueves 04/02 suman a enero.», «4 h de 3 días suman a
       enero.»). Solo los que dan horas */
    function lineasDeLaBanda(mes, entran, seVan) {
        const lineas = [];
        const queEntran = sumaDe(entran);
        if (queEntran > 0) lineas.push(`Incluye ${numeroConComa(queEntran)} h de ${nombreDelMes(mes, 1)}.`);
        const conHoras = seVan.filter((uno) => uno.horas > 0);
        if (conHoras.length > 0) {
            const total = sumaDe(conHoras);
            const verbo = total === 1 ? 'suma' : 'suman';
            const anterior = nombreDelMes(mesVecino(mes, -1));
            let de;
            if (conHoras.length === 1) de = `del ${diaLargoDe(conHoras[0].dia.fecha)}`;
            else if (conHoras.length === 2) de = `del ${diaLargoDe(conHoras[0].dia.fecha)} y del ${diaLargoDe(conHoras[1].dia.fecha)}`;
            else de = `de ${conHoras.length} días`;
            lineas.push(`${numeroConComa(total)} h ${de} ${verbo} a ${anterior}.`);
        }
        return lineas;
    }

    // La banda de arriba de la planilla (htmlDeLaBandaDeLaPlanilla), con NUEVO: la segunda línea, en .mp-suma-aparte
    function htmlDeLaBandaDeLaPlanilla(mes, horas, hoy, lineas = []) {
        return `<span class="mp-suma-cifra">${esc(numeroConComa(horas))}<small>h</small></span>`
            + '<div class="mp-suma-textos">'
            + `<p class="mp-suma-texto">${fraseDeLaSumaDelMes(mes, horas, hoy, (parte) => `<b>${esc(parte)}</b>`)}</p>`
            + lineas.map((linea) => `<p class="mp-suma-aparte">${esc(linea)}</p>`).join('')
            + '</div>';
    }

    function partesDelPie(fechas) {
        const validas = [...new Set((Array.isArray(fechas) ? fechas : []).filter(esFechaDeTexto))];
        if (validas.length === 0) return null;
        const meses = [...new Set(validas.map((fecha) => fecha.slice(0, 7)))].sort();
        const nombres = meses.map((mes) => nombreDelMes(mes));
        const conAnio = new Set(nombres).size < nombres.length;
        const enMeses = meses.length > 1
            ? ` (${listaConY(meses.map((mes, indice) => (conAnio ? `${nombres[indice]} de ${mes.slice(0, 4)}` : nombres[indice])))})` : '';
        return { cuenta: `${validas.length} ${validas.length === 1 ? 'día' : 'días'}`, resto: ` con cambios sin guardar${enMeses}.` };
    }
    function htmlDelPieDeLaPlanilla(fechas) {
        const partes = partesDelPie(fechas);
        return partes === null ? 'Todo guardado.' : `<b>${esc(partes.cuenta)}</b>${esc(partes.resto)}`;
    }
    function htmlDelSumarDeLaPlanilla(planilla, estado) {
        if (!esObjeto(planilla) || !esMesDeTexto(planilla.mes)) return '';
        const libres = finesDeSemanaParaSumar(planilla, estado);
        if (libres.length === 0) return `<p>No quedan sábados ni domingos para sumar en ${esc(nombreDelMes(planilla.mes))}.</p>`;
        const opciones = libres.map((dia) => `<option value="${esc(dia.fecha)}">${esc(conTexto(dia.fecha_texto) ? dia.fecha_texto : dia.fecha)}</option>`);
        return '<label class="form-label" for="mp-finde">¿Trabajaste un sábado o un domingo?</label>'
            + `<select class="form-select" id="mp-finde">${opciones.join('')}</select>`
            + '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" id="mp-sumar-boton">Sumar el día</button>';
    }
    const textoDeSalirSinGuardar = (cantidad) => `Los cambios de ${cantidad === 1 ? '1 día' : `${String(cantidad)} días`} se pierden.`;
    const textoDeLosErroresDeLaPlanilla = (cantidad) => (cantidad === 1 ? 'Revisá el día marcado.' : `Revisá los ${String(cantidad)} días marcados.`);
    const textoDeComoSeCuentan = (mes) => (esMesDeTexto(mes) ? `Las horas de ${nombreDelMes(mes)} son horas a favor en ${nombreDelMes(mes, 1)}.` : '');
    // NUEVO: el último renglón de «Cómo se cuentan las horas»
    const textoDeSumarAlAnterior = (mes) => {
        const anterior = nombreDelMes(mesVecino(mes, -1));
        return `Si te autorizan a sumar las horas de un día al mes anterior, tildá «Sumar a ${anterior}»: cuentan como horas extras de ${anterior}.`;
    };
    function textoDeLaSemana(fechas) {
        const validas = (Array.isArray(fechas) ? fechas : []).filter(esFechaDeTexto).sort();
        if (validas.length === 0) return '';
        const dias = validas.map((fecha) => Number(fecha.slice(8, 10)));
        const delMes = ` de ${nombreDelMes(validas[0])}`;
        if (dias.length === 1) return `${dias[0]}${delMes}`;
        if (dias.length === 2 && dias[1] - dias[0] === 1) return `${dias[0]} y ${dias[1]}${delMes}`;
        return `${dias[0]} al ${dias.at(-1)}${delMes}`;
    }
    const textoDelTotalDeLaSemana = (horas) => (horas > 0 ? `${numeroConComa(horas)} h` : '—');

    /* Las horas de una fila (htmlDeLasHorasDeLaFila). NUEVO: un día tildado lleva la pastilla punteada y, al lado, «→ enero» (el
       lector de pantalla lee «1,5 h, van a enero») */
    function htmlDeLasHorasDeLaFila(dia, valor) {
        const tipo = esObjeto(dia) ? dia.tipo : null;
        const { entrada, salida, al_mes_anterior: alAnterior } = valoresDeLaSalida(valor);
        const nada = '<b class="nada">—</b>';
        if (salida === '') return tipo !== 'habil' && entrada !== '' ? `${nada}<small>Falta la salida</small>` : nada;
        const horas = horasDelDiaDeLaPlanilla({ tipo, entrada, salida });
        if (horas === null) {
            if (minutosDeLaSalida(salida) === null || (entrada !== '' && minutosDeLaSalida(entrada) === null)) return nada;
            if (tipo !== 'habil' && entrada === '') return `${nada}<small>Poné la entrada</small>`;
            return `${nada}<small>La salida va después</small>`;
        }
        if (horas === 0) return '<b class="cero">0</b><small>No llega a media hora</small>';
        if (alAnterior) {
            const anterior = nombreDelMes(mesVecino(dia.fecha.slice(0, 7), -1));
            return `<b class="otro-mes">${esc(numeroConComa(horas))} h</b><small class="mp-va-a"><span aria-hidden="true">→ </span>`
                + `<span class="visualmente-oculto">van a </span>${esc(anterior)}</small>`;
        }
        return `<b>${esc(numeroConComa(horas))} h</b>`;
    }

    const htmlDeLasMarcasDelDia = (dia, { conEntera = false } = {}) => {
        const marcas = [];
        if (dia.tipo === 'feriado') marcas.push(`<span class="me-insignia ambar">Feriado: ${esc(dia.feriado)}</span>`);
        else if (dia.tipo === 'finde' && conTexto(dia.finde_texto)) marcas.push(`<span class="me-insignia borde">${esc(dia.finde_texto)}</span>`);
        if (esObjeto(dia.licencia) && (dia.licencia.entera !== true || conEntera)) {
            marcas.push(`<span class="me-insignia verde">${esc(dia.licencia.texto)}</span>`);
        }
        return marcas.length > 0 ? `<span class="mp-marcas">${marcas.join('')}</span>` : '';
    };

    /* NUEVO: el tilde «Sumar a {mes anterior}», entre las horas y «Nota». Sin salida, oculto pero en su lugar (.vacio). En el primer
       mes que se puede mirar (el mes anterior no se puede mirar) no hay tilde: queda el lugar vacío */
    function htmlDelTilde(dia, valor, largo) {
        const id = esc(dia.fecha);
        const mes = dia.fecha.slice(0, 7);
        if (!puedeSumarAlAnterior(mes)) return '<span class="mp-anterior vacio" aria-hidden="true"></span>';
        const anterior = nombreDelMes(mesVecino(mes, -1));
        const vacio = valor.salida.trim() === '';
        return `<label class="mp-anterior${vacio ? ' vacio' : ''}" id="mp-t-${id}"><input type="checkbox" data-campo="al_mes_anterior" `
            + `data-fecha="${id}"${valor.al_mes_anterior ? ' checked' : ''} aria-label="Sumar el ${esc(largo)} a ${esc(anterior)}">`
            + `<span>Sumar a ${esc(anterior)}</span></label>`;
    }

    // Una fila de la planilla (htmlDeLaFilaDeLaPlanilla), con NUEVO: el tilde entre las horas y «Quitar» / «Nota»
    function htmlDeLaFilaDeLaPlanilla(dia, { cambios, errores, notasAbiertas, cambiadas }) {
        const { fecha } = dia;
        const id = esc(fecha);
        const largo = conTexto(dia.fecha_larga) ? dia.fecha_larga : diaLargoDe(fecha);
        const valor = valorDelDia(dia, cambioDe(cambios, fecha));
        const entera = esObjeto(dia.licencia) && dia.licencia.entera === true;
        const cambiado = cambiadas.has(fecha);
        const error = esMapa(errores) && esObjeto(errores.get(fecha)) ? errores.get(fecha) : null;
        const clases = ['mp-dia'];
        if (dia.tipo === 'feriado') clases.push('feriado');
        else if (dia.tipo === 'finde') clases.push('finde');
        if (entera) clases.push('licencia');
        if (dia.futuro === true) clases.push('futuro');
        if (dia.hoy === true) clases.push('hoy');
        if (cambiado) clases.push('cambiado');
        const abre = `<div class="${clases.join(' ')}" id="mp-dia-${id}"`;
        const nombre = `<b id="mp-f-${id}">${esc(dia.fecha_texto)}${dia.hoy === true ? ' <span class="mp-hoy">Hoy</span>' : ''}</b>`;
        const htmlDelError = error === null ? '' : `<p class="mp-error" id="mp-e-${id}">${esc(error.mensaje)}</p>`;
        const insigniaEntera = entera ? `<span class="me-insignia verde">${esc(dia.licencia.texto)}</span> ` : '';
        const conSalida = valor.salida.trim() !== '';
        const grupo = `${abre} role="group" aria-labelledby="mp-f-${id}"`;

        if (dia.futuro === true || (entera && !conSalida)) {
            const texto = dia.futuro === true ? 'Todavía no llegó.' : 'Es un día de licencia: no se cargan horas.';
            const conError = error === null ? '>' : ` tabindex="-1" aria-describedby="mp-e-${id}">`;
            return `${error === null ? abre : grupo}${conError}<span class="mp-fecha">${nombre}${htmlDeLasMarcasDelDia(dia)}</span>`
                + `<span class="mp-lugar">${insigniaEntera}${texto}</span>${htmlDelError}</div>`;
        }

        const aviso = !cambiado && conTexto(dia.aviso) ? `<p class="mp-aviso" id="mp-a-${id}">${esc(dia.aviso)}</p>` : '';
        const nota = conTexto(valor.nota) ? `<p class="mp-nota-vista">${esc(valor.nota)}</p>` : '';
        const campoDelError = error === null ? null : (['entrada', 'salida', 'nota'].includes(error.campo) ? error.campo : 'salida');
        const describir = (campo) => {
            const ids = [...(campoDelError === campo ? [`mp-e-${id}`] : []), ...(campo === 'salida' && aviso !== '' ? [`mp-a-${id}`] : [])];
            return (campoDelError === campo ? ' aria-invalid="true"' : '') + (ids.length > 0 ? ` aria-describedby="${ids.join(' ')}"` : '');
        };
        const habil = dia.tipo === 'habil';
        const rotulo = habil ? 'Entrada (opcional)' : 'Entrada';
        const tieneNota = valor.nota.trim() !== '';
        const abierta = tieneEn(notasAbiertas, fecha) || campoDelError === 'nota';
        const quitar = esFinDeSemana(fecha) ? `<button type="button" class="sg-link me-link-rojo" data-quitar="${id}" `
            + `aria-label="Quitar el ${esc(largo)}">Quitar</button>` : '';
        const campoDeLaNota = `<span class="mp-nota-campo"><input type="text" data-campo="nota" data-fecha="${id}" value="${esc(valor.nota)}" `
            + `placeholder="Por ejemplo: cierre del informe mensual" aria-label="Nota del ${esc(largo)}"${describir('nota')}></span>`;
        return `${grupo}><span class="mp-fecha">${nombre}${htmlDeLasMarcasDelDia(dia)}</span>`
            + `<label class="mp-campo entrada"><span class="mp-rotulo">${rotulo}</span><input type="time"${habil ? ' class="opcional"' : ''} `
            + `data-campo="entrada" data-fecha="${id}" value="${esc(valor.entrada)}" data-vacio="${valor.entrada.trim() === '' ? '1' : '0'}" `
            + `aria-label="${rotulo} del ${esc(largo)}"${describir('entrada')}></label>`
            + '<label class="mp-campo salida"><span class="mp-rotulo">Salida</span><input type="time" '
            + `data-campo="salida" data-fecha="${id}" value="${esc(valor.salida)}" aria-label="Salida del ${esc(largo)}"${describir('salida')}></label>`
            + `<span class="mp-horas" id="mp-h-${id}">${htmlDeLasHorasDeLaFila(dia, valor)}</span>`
            + htmlDelTilde(dia, valor, largo)
            + `<span class="mp-acciones">${quitar}<button type="button" class="sg-link" data-nota="${id}" aria-expanded="${String(abierta)}" `
            + `aria-label="${tieneNota ? 'Cambiar la nota' : 'Agregar una nota'} del ${esc(largo)}">${tieneNota ? 'Cambiar nota' : 'Nota'}</button></span>`
            + `${abierta ? campoDeLaNota : nota}${aviso}${htmlDelError}</div>`;
    }

    /* NUEVO: un día del mes siguiente que suma a este, de solo lectura, después de la última semana: la fecha, la salida (y la
       entrada), sus horas y «Ver en febrero», que lleva a la planilla de ese mes con el foco en su tilde */
    function htmlDelDiaDeOtroMes({ dia, horas }, cambios) {
        const id = esc(dia.fecha);
        const valor = valoresDeLaSalida(valorDelDia(dia, cambioDe(cambios, dia.fecha)));
        const deMes = nombreDelMes(dia.fecha.slice(0, 7));
        const entrada = valor.entrada !== '' ? `<small>Entrada ${esc(valor.entrada)}</small>` : '';
        const pastilla = horas === 0 ? '<b class="cero">0</b><small>No llega a media hora</small>' : `<b>${esc(numeroConComa(horas))} h</b>`;
        return `<div class="mp-dia de-otro-mes" id="mp-otro-${id}" role="group" aria-labelledby="mp-of-${id}">`
            + `<span class="mp-fecha"><b id="mp-of-${id}">${esc(dia.fecha_texto)}</b>${htmlDeLasMarcasDelDia(dia)}</span>`
            + `<span class="mp-guardada">Salida ${esc(valor.salida)}${entrada}</span>`
            + `<span class="mp-horas">${pastilla}</span>`
            + `<span class="mp-acciones"><button type="button" class="sg-link" data-ver-en="${id}" `
            + `aria-label="Ver el ${esc(diaLargoDe(dia.fecha))} en ${esc(deMes)}">Ver en ${esc(deMes)}</button></span>`
            + (valor.nota !== '' ? `<p class="mp-nota-vista">${esc(valor.nota)}</p>` : '')
            + '</div>';
    }

    // La planilla de un mes (htmlDeLaPlanilla), con NUEVO: al final, el bloque «De febrero»
    function htmlDeLaPlanilla(planilla, estado) {
        const { cambios = null, agregados = null, errores = null, notasAbiertas = null } = esObjeto(estado) ? estado : {};
        const dias = diasVisiblesDeLaPlanilla(planilla, { cambios, agregados });
        const contexto = { cambios, errores, notasAbiertas, cambiadas: new Set(fechasCambiadas(cambios)) };
        const semanas = [];
        for (const dia of dias) {
            const lunes = sumarDiasA(dia.fecha, -lugarEnLaSemana(dia.fecha));
            if (semanas.length === 0 || semanas.at(-1).lunes !== lunes) semanas.push({ lunes, dias: [] });
            semanas.at(-1).dias.push(dia);
        }
        const html = semanas.map(({ dias: deLaSemana }) => {
            const fechas = deLaSemana.map((dia) => dia.fecha);
            return `<div class="mp-semana" data-fechas="${esc(fechas.join(','))}"><span>${esc(textoDeLaSemana(fechas))}</span>`
                + `<span class="mp-semana-total">${esc(textoDelTotalDeLaSemana(horasDeLosDias(deLaSemana, cambios)))}</span></div>`
                + deLaSemana.map((dia) => htmlDeLaFilaDeLaPlanilla(dia, contexto)).join('');
        }).join('');
        const entran = diasQueEntran(planilla.mes, estado);
        if (entran.length === 0) return html;
        const siguiente = nombreDelMes(planilla.mes, 1);
        return html + `<div class="mp-semana de-otro-mes"><span>De ${esc(siguiente)}</span>`
            + `<span class="mp-semana-total">${esc(textoDelTotalDeLaSemana(sumaDe(entran)))}</span></div>`
            + entran.map((uno) => htmlDelDiaDeOtroMes(uno, cambios)).join('');
    }

    // ---- La pestaña Horas extras (htmlDeTablaDeHorasAFavor, htmlDeDiaPorDiaDeSalidas y htmlDeNoUtilizadas) ----
    const CLASE_DE_LA_SITUACION = Object.freeze({ sumando: 'gris', proximo: 'azul', en_uso: 'ambar', usados: 'verde', usadas: 'verde' });
    const SITUACIONES_EN_GRIS = Object.freeze(['sin_franco', 'no_utilizado', 'no_utilizadas', 'antes_del_arranque']);
    const NOTA_DE_LAS_HORAS_A_FAVOR = 'Cada hora extra de un mes es una hora menos de trabajo el mes siguiente, de a media hora. 7 horas '
        + 'son el día entero.';
    const NOTA_DE_LAS_NO_UTILIZADAS = 'Quedan a la vista aunque su mes ya pasó. Vuelven a cero el 1/1.';
    function htmlDelSelectorDeAnio(anios, anio) {
        const botones = (Array.isArray(anios) ? anios : []).filter(Number.isInteger)
            .map((uno) => `<button type="button" data-anio="${String(uno)}" aria-pressed="${String(uno === anio)}">${String(uno)}</button>`)
            .join('');
        return botones ? `<span class="me-segmento" role="group" aria-label="Año">${botones}</span>` : '';
    }
    function mesInicialDe(tabla) {
        const meses = listaDe(tabla?.meses).map((fila) => fila.mes);
        if (meses.includes(tabla?.mes_en_curso)) return tabla.mes_en_curso;
        return meses[0] ?? null;
    }
    const mesDeLaTabla = (tabla, mes) => (listaDe(tabla?.meses).some((fila) => fila.mes === mes) ? mes : mesInicialDe(tabla));
    const cabezaDeHoras = (titulo, tabla) => `<div class="me-cabeza"><h2>${titulo}${delAnio(tabla?.anio)}</h2>`
        + `<span class="me-acciones">${htmlDelSelectorDeAnio(tabla?.anios, tabla?.anio)}`
        + '<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-cargar="horas">Cargar horas extras</button></span></div>';
    const botonDelMes = (fila, elegido) => `<button type="button" class="me-mes-boton" data-mes="${esc(fila.mes)}" `
        + `aria-pressed="${String(fila.mes === elegido)}">${esc(fila.mes_texto)}</button>`;
    function htmlDeSituacion(fila) {
        const clase = deMapa(CLASE_DE_LA_SITUACION, fila.estado, null);
        return clase === null ? esc(fila.situacion) : `<span class="me-insignia ${clase}">${esc(fila.situacion)}</span>`;
    }
    const claseDeLaFila = (fila) => (SITUACIONES_EN_GRIS.includes(fila.estado) ? ' class="tenue"' : '');
    function htmlDeTabla(tabla, columnas, filas) {
        if (filas.length === 0) return `<p class="me-vacio">No hay horas extras cargadas${enElAnio(tabla?.anio)}.</p>`;
        return `<div class="me-tabla-marco"><table class="me-tabla"><thead><tr>${columnas.map((columna) => `<th>${columna}</th>`).join('')}`
            + `</tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
    }
    function htmlDelUsoAutorizado(uso) {
        if (!esObjeto(uso)) return '';
        const boton = uso.puede === true
            ? '<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-abrir="uso">Registrar un uso autorizado</button>' : '';
        return `<div class="me-uso"><p class="me-nota">${esc(uso.texto)}</p>${boton}</div>`;
    }
    // NUEVO: debajo de las horas de un mes, de dónde salen («5,5 h + 1,5 h de febrero»), como `horas_detalle`
    function htmlDeTablaDeHorasAFavor(tabla, mes = mesInicialDe(tabla)) {
        const filas = listaDe(tabla?.meses).map((fila) => `<tr${claseDeLaFila(fila)}><td>${botonDelMes(fila, mes)}</td>`
            + `<td class="num">${esc(fila.horas_texto)}${conTexto(fila.horas_detalle) ? `<small>${esc(fila.horas_detalle)}</small>` : ''}</td>`
            + `<td>${esc(fila.a_favor_texto)}${conTexto(fila.a_favor_detalle) ? `<small>${esc(fila.a_favor_detalle)}</small>` : ''}</td>`
            + `<td class="num">${esc(fila.usadas_texto)}${conTexto(fila.usadas_detalle) ? `<small>${esc(fila.usadas_detalle)}</small>` : ''}</td>`
            + `<td>${htmlDeSituacion(fila)}</td></tr>`);
        return `<div class="me-tarjeta">${cabezaDeHoras('Horas extras y horas a favor', tabla)}`
            + htmlDeTabla(tabla, ['Mes trabajado', 'Horas extras', 'A favor en', 'Usadas', 'Situación'], filas)
            + `<p class="me-nota">${NOTA_DE_LAS_HORAS_A_FAVOR}</p></div>`;
    }
    /* El día por día de contrato (htmlDeDiaPorDiaDeSalidas), con NUEVO: un día que suma al mes anterior lleva la pastilla punteada y
       «Suma a enero»; y al final de un mes, los del mes siguiente que suman a él, con «De febrero» debajo de la fecha */
    function htmlDeDiaPorDiaDeSalidas(tabla, mes) {
        const fila = listaDe(tabla?.meses).find((uno) => uno.mes === mes);
        const dias = listaDe(deMapa(tabla?.dias_por_mes, mes, []));
        if (fila === undefined || dias.length === 0) return '';
        const detalle = (texto, clase = 'me-detalle') => (conTexto(texto) ? `<span class="${clase}">${esc(texto)}</span>` : '');
        const filas = dias.map((dia) => {
            const largo = esFechaDeTexto(dia.fecha) ? diaLargoDe(dia.fecha) : dia.fecha_texto;
            const cero = dia.cero === true;
            const pastilla = conTexto(dia.horas_texto)
                ? `<span class="me-dia-horas${dia.suma_a ? ' otro-mes' : ''}">${esc(dia.horas_texto)}</span>` : '';
            return `<li class="me-fila${cero ? ' tenue' : ''}"><span class="me-fila-fecha">${esc(dia.fecha_texto)}`
                + `${conTexto(dia.tipo_texto) ? `<small>${esc(dia.tipo_texto)}</small>` : ''}</span>`
                + `<span class="me-fila-cuerpo">${esc(dia.horario)}${detalle(dia.entrada_texto)}${pastilla}`
                + `${conTexto(dia.suma_a) ? detalle(dia.suma_a, 'me-detalle me-fila-otro-mes') : ''}`
                + `${cero ? '<span class="me-detalle">No llega a media hora</span>' : ''}${detalle(dia.aviso, 'me-detalle me-fila-aviso')}`
                + `${detalle(dia.nota, 'me-detalle me-fila-nota')}</span>`
                + `<button type="button" class="sg-link" data-editar-salida="${esc(dia.fecha)}" aria-label="Editar el ${esc(largo)}">Editar</button></li>`;
        });
        return `<div class="me-tarjeta"><div class="me-cabeza"><h3>${esc(fila.mes_texto)}, día por día</h3>`
            + `<span>${esc(deMapa(tabla.totales_por_mes, mes, ''))}</span></div><ul class="me-lista">${filas.join('')}</ul></div>`;
    }
    function htmlDeNoUtilizadas(tabla) {
        const noUtilizadas = tabla?.no_utilizadas;
        if (!esObjeto(noUtilizadas)) return '';
        const filas = listaDe(noUtilizadas.filas).map((fila) => `<li class="me-fila me-fila-dos"><span class="me-fila-fecha">${esc(fila.titulo)}</span>`
            + `<span class="me-fila-cuerpo">${esc(fila.texto)}${conTexto(fila.detalle) ? `<span class="me-detalle">${esc(fila.detalle)}</span>` : ''}`
            + '</span></li>');
        return '<div class="me-tarjeta"><div class="me-cabeza"><h3>Horas no utilizadas previamente</h3>'
            + `<span>${esc(noUtilizadas.total_texto)}</span></div>`
            + (filas.length > 0 ? `<ul class="me-lista">${filas.join('')}</ul>` : '')
            + `<p class="me-nota">${NOTA_DE_LAS_NO_UTILIZADAS}</p>${htmlDelUsoAutorizado(noUtilizadas.uso_autorizado)}</div>`;
    }
    function htmlDeHorasExtras(tabla, mes) {
        const elegido = mesDeLaTabla(tabla, mes);
        return htmlDeTablaDeHorasAFavor(tabla, elegido) + htmlDeDiaPorDiaDeSalidas(tabla, elegido) + htmlDeNoUtilizadas(tabla);
    }

    // ---- El segundo paso de «Cargar licencia» (htmlDelSegundoPaso) y la hoja (htmlDeLaNota) ----
    const CLASE_DEL_TIPO = Object.freeze({ horas_a_favor: 'verde' });
    const TILDE_DEL_SEGUNDO_PASO = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" '
        + 'stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
        + '<path d="M20 6 9 17l-5-5"/></svg>';
    function htmlDelSegundoPaso({ fila = null, html = '', aclaracion = '', lista = null } = {}) {
        const partes = [''];
        if (esObjeto(fila)) {
            const linea = [`<span class="me-insignia ${deMapa(CLASE_DEL_TIPO, fila.tipo, 'gris')}">${esc(fila.tipo_nombre)}</span>`];
            if (conTexto(fila.fechas_texto)) linea.push(`<b class="me-paso-dos-fechas">${esc(fila.fechas_texto)}</b>`);
            if (conTexto(fila.cantidad_texto)) linea.push(`<span class="me-paso-dos-cantidad">${esc(fila.cantidad_texto)}</span>`);
            const detalles = [fila.configuracion_texto, fila.mostrar_texto].filter(conTexto).map((texto) => `<span>${esc(texto)}</span>`);
            partes.push(`<div class="me-paso-dos-hecho"><span class="me-tilde" aria-hidden="true">${TILDE_DEL_SEGUNDO_PASO}</span>`
                + `<div class="me-paso-dos-licencia"><p class="me-paso-dos-linea">${linea.join('')}</p>`
                + (detalles.length > 0 ? `<p class="me-paso-dos-detalle">${detalles.join(' ')}</p>` : '') + '</div></div>');
        }
        if (conTexto(lista)) partes.push(`<p class="me-paso-dos-lista">${esc(lista)}</p>`);
        partes.push('<h3 class="me-paso-dos-titulo">Así sale la nota</h3>');
        if (conTexto(aclaracion)) partes.push(`<p class="me-paso-dos-ayuda">${esc(aclaracion)}</p>`);
        partes.push(`<div class="me-mesa">${typeof html === 'string' ? html : ''}</div>`);
        return partes.join('');
    }
    const renglon = (html, clase = '') => `<p${clase ? ` class="${clase}"` : ''}>${html}</p>`;
    const vacios = (cuantos) => '<p></p>'.repeat(cuantos);
    const LINEA_DE_LA_FIRMA = '_'.repeat(30);
    const SD = `S${' '.repeat(15)}/${' '.repeat(15)}D`;

    // =================================================================================================================
    // Lo que mandaría el servidor (en la página real: GET /mi-espacio/salidas, GET /mi-espacio/horas-extras y la nota)
    // =================================================================================================================
    let guardado = copia(D.salidas);
    const diaYMes = (fecha) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
    const diaCortoSinAnio = (fecha) => `${DIAS_CORTOS[lugarEnLaSemana(fecha)]} ${diaYMes(fecha)}`;
    const tipoDeDia = (fecha) => (Object.hasOwn(D.feriados, fecha) ? 'feriado' : (esFinDeSemana(fecha) ? 'finde' : 'habil'));
    const nombreDelFinde = (fecha) => ({ 5: 'Sábado', 6: 'Domingo' }[lugarEnLaSemana(fecha)] ?? null);
    const conUnidad = (cantidad, una, varias) => `${numeroConComa(cantidad)} ${cantidad === 1 ? una : varias}`;
    const ultimoDelMes = (mes) => fechaDeUtc(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
    const puedeSumarAlAnterior = (mes) => mes > D.primerMes;
    function ultimoDiaHabil(mes) {
        let fecha = ultimoDelMes(mes);
        while (tipoDeDia(fecha) !== 'habil') fecha = sumarDiasA(fecha, -1);
        return fecha;
    }
    // Un día de la planilla, con la forma de la spec (lo guardado de la maqueta)
    function diaDelServidor(fecha) {
        const fila = Object.hasOwn(guardado, fecha) ? guardado[fecha] : null;
        const tipo = tipoDeDia(fecha);
        const horas = fila === null ? null : horasDelDiaDeLaPlanilla({ tipo, entrada: fila.entrada ?? '', salida: fila.salida });
        return {
            fecha, fecha_texto: diaCortoSinAnio(fecha), fecha_larga: diaLargoDe(fecha), tipo,
            feriado: tipo === 'feriado' ? D.feriados[fecha] : null, finde_texto: nombreDelFinde(fecha), licencia: null,
            futuro: fecha > HOY, hoy: fecha === HOY,
            entrada: fila?.entrada ?? null, salida: fila?.salida ?? null, nota: fila?.nota ?? null,
            al_mes_anterior: fila?.al_mes_anterior === true,
            horas, horas_texto: horas === null ? '' : (horas === 0 ? '0' : `${numeroConComa(horas)} h`), aviso: null
        };
    }
    function planillaDelMes(mes) {
        const dias = [];
        const finesDeSemana = [];
        for (let fecha = `${mes}-01`; fecha.startsWith(`${mes}-`); fecha = sumarDiasA(fecha, 1)) {
            if (nombreDelFinde(fecha) === null || Object.hasOwn(guardado, fecha)) dias.push(diaDelServidor(fecha));
            else if (fecha <= HOY) finesDeSemana.push(diaDelServidor(fecha));
        }
        return {
            modalidad: 'contrato', mes, mes_texto: tituloDelMes(mes), hoy: HOY,
            anterior: mes <= D.primerMes ? null : mesVecino(mes, -1), siguiente: mes >= MES_DE_HOY ? null : mesVecino(mes, 1),
            dias, fines_de_semana: finesDeSemana
        };
    }
    // NUEVO: los días del mes siguiente que suman a este (con lo de la página encima), con sus horas
    function diasQueEntran(mes, estado) {
        const siguiente = mesVecino(mes, 1);
        if (siguiente === null || siguiente > MES_DE_HOY) return [];
        const { cambios = null } = esObjeto(estado) ? estado : {};
        return diasQueSumanAlAnterior(diasVisiblesDeLaPlanilla(planillaDelMes(siguiente), estado), cambios);
    }

    // La tabla de la pestaña de un año, con lo guardado (tablaDeHorasExtras de services/miEspacioResumen.js, para contrato)
    function tablaDeHoras(anio) {
        const fechas = Object.keys(guardado).sort();
        const porMes = new Map(); // mes → { propias, entran: [{ fecha, horas }], dias: [] }
        const delMes = (mes) => {
            if (!porMes.has(mes)) porMes.set(mes, { propias: 0, entran: [], dias: [] });
            return porMes.get(mes);
        };
        for (const fecha of fechas) {
            const dia = diaDelServidor(fecha);
            const horas = dia.horas ?? 0;
            const mes = fecha.slice(0, 7);
            const suma = dia.al_mes_anterior && puedeSumarAlAnterior(mes);
            delMes(mes).dias.push(dia);
            if (suma) delMes(mesVecino(mes, -1)).entran.push({ dia, horas });
            else delMes(mes).propias += horas;
        }
        const filaDeLaTabla = (mes, datos) => {
            const queEntran = sumaDe(datos.entran);
            const horas = datos.propias + queEntran;
            const deUso = mesVecino(mes, 1);
            let estado = 'sumando';
            let situacion = 'El mes sigue sumando';
            if (mes < MES_DE_HOY && deUso >= MES_DE_HOY) {
                estado = 'en_uso';
                situacion = `${numeroConComa(horas)} h para usar hasta el ${diaYMes(ultimoDiaHabil(deUso))}`;
            } else if (mes < MES_DE_HOY) {
                estado = 'no_utilizadas';
                situacion = `${numeroConComa(horas)} h ${horas === 1 ? 'no utilizada' : 'no utilizadas'} previamente`;
            }
            let detalle = '';
            if (queEntran > 0) {
                const siguiente = nombreDelMes(mes, 1);
                detalle = datos.propias > 0 ? `${numeroConComa(datos.propias)} h + ${numeroConComa(queEntran)} h de ${siguiente}`
                    : `${numeroConComa(queEntran)} h de ${siguiente}`;
            }
            return {
                mes, mes_texto: tituloDelMes(mes), horas, horas_texto: `${numeroConComa(horas)} h`, horas_detalle: detalle,
                a_favor_texto: tituloDelMes(deUso), a_favor_detalle: enDiasDeFranco(horas), usadas_texto: '—', usadas_detalle: '',
                estado, situacion
            };
        };
        const meses = [...porMes.keys()].filter((mes) => mes.startsWith(`${anio}-`)).sort().reverse()
            .map((mes) => filaDeLaTabla(mes, porMes.get(mes))).filter((fila) => fila.horas > 0);
        const diaDeLaLista = (dia, extra = {}) => {
            const entrada = dia.tipo === 'habil' && conTexto(dia.entrada) ? `Entrada ${dia.entrada}` : '';
            return {
                fecha: dia.fecha, fecha_texto: dia.fecha_texto,
                tipo_texto: dia.tipo === 'feriado' ? 'Feriado' : (nombreDelFinde(dia.fecha) ?? ''),
                horario: dia.tipo !== 'habil' && conTexto(dia.entrada) ? `De ${dia.entrada} a ${dia.salida}` : `Salida ${dia.salida}`,
                entrada_texto: entrada, horas_texto: dia.horas_texto, cero: dia.horas === 0, nota: dia.nota, aviso: null, ...extra
            };
        };
        const diasPorMes = {};
        const totales = {};
        for (const fila of meses) {
            const datos = porMes.get(fila.mes);
            const propios = [...datos.dias].reverse().map((dia) => diaDeLaLista(dia, dia.al_mes_anterior && puedeSumarAlAnterior(fila.mes)
                ? { suma_a: `Suma a ${nombreDelMes(mesVecino(fila.mes, -1))}` } : {}));
            const deOtro = datos.entran.map(({ dia }) => diaDeLaLista(dia, { tipo_texto: `De ${nombreDelMes(fila.mes, 1)}` }));
            diasPorMes[fila.mes] = [...propios, ...deOtro];
            totales[fila.mes] = conUnidad(fila.horas, 'hora', 'horas');
        }
        // Las horas no utilizadas previamente: las de los meses cuyo mes de uso ya pasó, en el año de su mes de uso
        const noUtilizadas = [...porMes.keys()].map((mes) => filaDeLaTabla(mes, porMes.get(mes)))
            .filter((fila) => fila.estado === 'no_utilizadas' && fila.horas > 0 && mesVecino(fila.mes, 1).startsWith(`${anio}-`))
            .map((fila) => ({ titulo: tituloDelMes(mesVecino(fila.mes, 1)), texto: conUnidad(fila.horas, 'hora', 'horas'),
                detalle: `de las extras de ${nombreDelMes(fila.mes)}`, horas: fila.horas }));
        const quedan = noUtilizadas.reduce((suma, fila) => suma + fila.horas, 0);
        return {
            modalidad: 'contrato', anio, anios: [2025, 2026, 2027, 2028], meses, dias_por_mes: diasPorMes, totales_por_mes: totales,
            mes_en_curso: MES_DE_HOY.startsWith(`${anio}-`) ? MES_DE_HOY : null,
            no_utilizadas: {
                total_texto: `${conUnidad(quedan, 'hora', 'horas')} en ${anio}`, filas: noUtilizadas,
                uso_autorizado: quedan > 0
                    ? { puede: true, texto: 'Si te autorizan a tomarlas, registrá un uso autorizado: se descuentan primero las más viejas.' }
                    : { puede: false, texto: `En ${anio} no te quedan horas no utilizadas previamente.` }
            }
        };
    }

    /* La nota de las horas a favor de datos.js (notaDeLicencia + htmlDeLaNota). NUEVO, resaltado solo en la maqueta: los días del
       mes de la licencia que suman al mes anterior («y el martes 2 de febrero de 2027») */
    const MESES_LARGOS = NOMBRES_DE_LOS_MESES;
    const formatoLargo = (fecha) => `${Number(fecha.slice(8, 10))} de ${MESES_LARGOS[Number(fecha.slice(5, 7)) - 1]} de ${fecha.slice(0, 4)}`;
    const conElDia = (fecha) => `${NOMBRES_DE_LOS_DIAS[lugarEnLaSemana(fecha)]} ${formatoLargo(fecha)}`;
    const EN_LETRAS = Object.freeze({ 1: 'una', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete' });
    function htmlDeLaNota() {
        const { desde, horas, guardada } = D.nota;
        const mesDeLaLicencia = desde.slice(0, 7);
        const anterior = mesVecino(mesDeLaLicencia, -1);
        const delMes = `${MESES_LARGOS[Number(anterior.slice(5, 7)) - 1]} de ${anterior.slice(0, 4)}`;
        const tildados = Object.keys(guardado).sort()
            .filter((fecha) => fecha.startsWith(`${mesDeLaLicencia}-`) && guardado[fecha].al_mes_anterior === true);
        // Redacción C, elegida por el usuario (30/10/2026): el día primero, en todas las notas de horas a favor, y los días sumados
        // entre paréntesis: «(incluidas las del martes 2 de febrero de 2027, sumadas a enero)».
        const mesSumado = MESES_LARGOS[Number(anterior.slice(5, 7)) - 1];
        let nuevo = '';
        if (tildados.length === 1) nuevo = ` (incluidas las del ${conElDia(tildados[0])}, sumadas a ${mesSumado})`;
        else if (tildados.length > 1) {
            const dias = tildados.map((fecha, i) => `${i === 0 ? '' : 'el '}${NOMBRES_DE_LOS_DIAS[lugarEnLaSemana(fecha)]} ${Number(fecha.slice(8, 10))}`);
            nuevo = ` (incluidas las del ${listaConY(dias)} de ${MESES_LARGOS[Number(mesDeLaLicencia.slice(5, 7)) - 1]} de ${mesDeLaLicencia.slice(0, 4)}, sumadas a ${mesSumado})`;
        }
        const cuerpo = esc(`Me dirijo a Ud. a fin de solicitarle tenga a bien autorizar el usufructo de ${EN_LETRAS[horas]} (${horas}) horas a favor `)
            + `<mark class="mq-nuevo">${esc(`el día ${conElDia(desde)}`)}</mark>`
            + esc(`, correspondientes a las horas extras realizadas en ${delMes}`)
            + (nuevo === '' ? '' : `<mark class="mq-nuevo">${esc(nuevo)}</mark>`)
            + '.';
        const firma = [
            renglon(esc(D.persona.nombre)),
            renglon(esc('Personal contratado, cumpliendo funciones de'), 'chico'),
            renglon(esc(D.persona.cargo))
        ].join('');
        return '<div class="me-hoja"><div class="me-hoja-texto">'
            + renglon(esc(`Comodoro Rivadavia, ${formatoLargo(guardada)}`), 'derecha') + vacios(2)
            + renglon(esc('Al Señor Director General de')) + renglon(esc('Modernización e Investigación Territorial'))
            + renglon(esc(SD), 'sd') + vacios(1)
            + renglon(esc('De mi mayor consideración:')) + vacios(1)
            + renglon(cuerpo, 'sangria justificado') + vacios(1)
            + renglon(esc('Sin otro particular, saludo a Ud. atentamente.'), 'sangria') + vacios(4)
            + `<div class="firma">${renglon(esc(LINEA_DE_LA_FIRMA))}${firma}</div>`
            + '</div></div>';
    }

    // =================================================================================================================
    // Lo que toca el DOM
    // =================================================================================================================
    let reloj = null;
    const aviso = (texto) => {
        const el = $('mq-aviso');
        el.textContent = texto;
        el.classList.add('visible');
        clearTimeout(reloj);
        reloj = setTimeout(() => el.classList.remove('visible'), 3200);
    };
    const anunciarEn = (id, texto) => {
        const region = $(id);
        if (region) region.textContent = region.textContent === texto ? `${texto} ` : texto;
    };

    // ---- Los modales (como abrirModal y cerrarModal: el foco adentro, Escape, y de vuelta al botón que lo abrió) ----
    const pilaDeModales = [];
    const FOCUSABLES = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"]), summary';
    function abrirModal(id, { volverA = document.activeElement, foco = null } = {}) {
        const overlay = $(id);
        overlay.classList.add('active');
        pilaDeModales.push({ id, volverA });
        requestAnimationFrame(() => {
            const destino = typeof foco === 'function' ? foco() : foco;
            (destino ?? overlay.querySelector('.modal-close'))?.focus?.({ preventScroll: true });
        });
    }
    function cerrarModal(id) {
        const lugar = pilaDeModales.findIndex((uno) => uno.id === id);
        if (lugar === -1) return;
        const [{ volverA }] = pilaDeModales.splice(lugar, 1);
        $(id).classList.remove('active');
        if (volverA && document.contains(volverA)) volverA.focus?.({ preventScroll: true });
    }
    const modalDeArriba = () => pilaDeModales.at(-1)?.id ?? null;
    document.addEventListener('keydown', (evento) => {
        const arriba = modalDeArriba();
        if (!arriba) return;
        if (evento.key === 'Escape') {
            evento.preventDefault();
            if (arriba === 'modal-planilla') pedirSalirDeLaPlanilla();
            else cerrarModal(arriba);
            return;
        }
        if (evento.key !== 'Tab') return;
        const visibles = [...$(arriba).querySelectorAll(FOCUSABLES)].filter((el) => el.offsetParent !== null
            && getComputedStyle(el).visibility !== 'hidden');
        if (visibles.length === 0) return;
        const primero = visibles[0];
        const ultimo = visibles.at(-1);
        if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo.focus(); }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero.focus(); }
    });

    // ---- La pestaña ----
    const pestana = { anio: 2027, mes: MES_DE_HOY };
    function pintarHoras() {
        const tabla = tablaDeHoras(pestana.anio);
        pestana.mes = mesDeLaTabla(tabla, pestana.mes);
        $('vista-horas').innerHTML = htmlDeHorasExtras(tabla, pestana.mes);
    }
    function mostrarPestana(nombre) {
        for (const boton of document.querySelectorAll('[data-pestana]')) {
            const si = boton.getAttribute('data-pestana') === nombre;
            boton.setAttribute('aria-selected', String(si));
            boton.tabIndex = si ? 0 : -1;
            $(`vista-${boton.getAttribute('data-pestana')}`).hidden = !si;
        }
    }

    // ---- La planilla ----
    let planilla = null; // { mes, cambios, agregados, errores, notasAbiertas }
    const estadoDeLaPlanilla = () => planilla;
    function abrirPlanilla({ mes = MES_DE_HOY, fecha = null, campo = 'salida', volverA = document.activeElement, foco = null } = {}) {
        if (planilla === null) {
            planilla = { mes, cambios: new Map(), agregados: new Set(), errores: new Map(), notasAbiertas: new Set() };
        }
        planilla.mes = mes;
        $('mp-error').hidden = true;
        $('mp-error').textContent = '';
        $('mp-anuncio').textContent = '';
        pintarLaPlanilla();
        $('mp-cuerpo').scrollTop = 0;
        if (!$('modal-planilla').classList.contains('active')) abrirModal('modal-planilla', { volverA, foco: foco ?? (() => controlDelFoco(fecha, campo)) });
        else requestAnimationFrame(() => controlDelFoco(fecha, campo)?.focus?.({ preventScroll: true }));
    }
    // El foco al abrir (controlDelFocoInicial): el campo pedido del día pedido, o la salida de hoy, o la primera; con la fila centrada
    function controlDelFoco(fecha, campo) {
        const datos = planillaDelMes(planilla.mes);
        const hoy = listaDe(datos.dias).find((dia) => dia.hoy === true)?.fecha ?? null;
        for (const una of [fecha, hoy]) {
            const fila = esFechaDeTexto(una) ? $(`mp-dia-${una}`) : null;
            const control = fila?.querySelector(`[data-campo="${una === fecha ? campo : 'salida'}"]`)
                ?? fila?.querySelector('[data-campo="salida"]') ?? null;
            if (control) {
                fila.scrollIntoView({ block: 'center' });
                return control;
            }
        }
        return $('mp-dias').querySelector('[data-campo="salida"]');
    }
    function pintarLaPlanilla() {
        const datos = planillaDelMes(planilla.mes);
        $('mp-mes-titulo').textContent = datos.mes_texto;
        $('mp-anterior').disabled = !esMesDeTexto(datos.anterior);
        $('mp-siguiente').disabled = !esMesDeTexto(datos.siguiente);
        $('mp-como-mes').textContent = textoDeComoSeCuentan(planilla.mes);
        const conTilde = puedeSumarAlAnterior(planilla.mes);
        $('mp-como-anterior').hidden = !conTilde;
        $('mp-como-anterior').textContent = conTilde ? textoDeSumarAlAnterior(planilla.mes) : '';
        $('mp-dias').innerHTML = htmlDeLaPlanilla(datos, estadoDeLaPlanilla());
        $('mp-sumar').innerHTML = htmlDelSumarDeLaPlanilla(datos, estadoDeLaPlanilla());
        pintarLaSumaDeLaPlanilla();
    }
    // Lo que cambia mientras se escribe o se tilda (pintarLaSumaDeLaPlanilla): la banda, el total de cada semana y el pie
    function pintarLaSumaDeLaPlanilla() {
        const datos = planillaDelMes(planilla.mes);
        const visibles = diasVisiblesDeLaPlanilla(datos, planilla);
        const entran = diasQueEntran(planilla.mes, planilla);
        const seVan = puedeSumarAlAnterior(planilla.mes) ? diasQueSumanAlAnterior(visibles, planilla.cambios) : [];
        const horas = horasDeLosDias(visibles, planilla.cambios) + sumaDe(entran);
        $('mp-suma').innerHTML = htmlDeLaBandaDeLaPlanilla(planilla.mes, horas, HOY, lineasDeLaBanda(planilla.mes, entran, seVan));
        const porFecha = new Map(visibles.map((dia) => [dia.fecha, dia]));
        for (const semana of $('mp-dias').querySelectorAll('.mp-semana[data-fechas]')) {
            const dias = comoTexto(semana.getAttribute('data-fechas')).split(',').map((fecha) => porFecha.get(fecha)).filter(Boolean);
            const total = semana.querySelector('.mp-semana-total');
            if (total) total.textContent = textoDelTotalDeLaSemana(horasDeLosDias(dias, planilla.cambios));
        }
        $('mp-pendientes').innerHTML = htmlDelPieDeLaPlanilla(fechasCambiadas(planilla.cambios));
    }
    // Una fila mientras se escribe o se tilda, sin reemplazarla: sus horas, la raya de lo cambiado y, NUEVO, el tilde (se ve con una
    // salida)
    function actualizarLaFila(fecha) {
        const fila = $(`mp-dia-${fecha}`);
        if (!fila) return;
        const dia = diaDelServidor(fecha);
        const valor = valorDelDia(dia, planilla.cambios.get(fecha));
        const horas = $(`mp-h-${fecha}`);
        if (horas) horas.innerHTML = htmlDeLasHorasDeLaFila(dia, valor);
        fila.classList.toggle('cambiado', fechasCambiadas(new Map([[fecha, planilla.cambios.get(fecha)]])).length > 0);
        const tilde = $(`mp-t-${fecha}`);
        if (tilde) tilde.classList.toggle('vacio', valor.salida.trim() === '');
        if (!planilla.errores.has(fecha)) {
            $(`mp-e-${fecha}`)?.remove();
            for (const control of fila.querySelectorAll('[aria-invalid]')) {
                control.removeAttribute('aria-invalid');
                control.removeAttribute('aria-describedby');
            }
        }
    }
    function sinErrorDeLosDias() {
        if (planilla.errores.size > 0) return;
        $('mp-error').hidden = true;
        $('mp-error').textContent = '';
    }
    function alEscribirEnLaPlanilla(campo) {
        const fecha = campo.getAttribute('data-fecha');
        const nombre = campo.getAttribute('data-campo');
        const dia = diaDelServidor(fecha);
        const anterior = valorDelDia(dia, planilla.cambios.get(fecha));
        const valor = nombre === 'al_mes_anterior' ? campo.checked === true : comoTexto(campo.value);
        planilla.cambios.set(fecha, { ...anterior, [nombre]: valor });
        if (nombre === 'entrada') campo.setAttribute('data-vacio', comoTexto(campo.value).trim() === '' ? '1' : '0');
        if (planilla.errores.delete(fecha)) sinErrorDeLosDias();
        actualizarLaFila(fecha);
        pintarLaSumaDeLaPlanilla();
    }
    function irAlMes(mes, { fecha = null, campo = 'salida', anunciar = true } = {}) {
        if (!esMesDeTexto(mes) || mes < D.primerMes || mes > MES_DE_HOY) return;
        planilla.mes = mes;
        pintarLaPlanilla();
        $('mp-cuerpo').scrollTop = 0;
        if (anunciar) anunciarEn('mp-anuncio', $('mp-mes-titulo').textContent);
        if (fecha !== null) requestAnimationFrame(() => controlDelFoco(fecha, campo)?.focus?.({ preventScroll: true }));
    }
    function cerrarLaPlanilla() {
        cerrarModal('modal-confirmar');
        cerrarModal('modal-planilla');
        planilla = null;
    }
    function pedirSalirDeLaPlanilla() {
        const cantidad = fechasCambiadas(planilla?.cambios).length;
        if (cantidad === 0) { cerrarLaPlanilla(); return; }
        $('modal-confirmar-texto').textContent = textoDeSalirSinGuardar(cantidad);
        abrirModal('modal-confirmar', { foco: () => $('modal-confirmar-no') });
    }
    function guardarLaPlanilla() {
        const fechas = fechasCambiadas(planilla.cambios);
        if (fechas.length === 0) { cerrarLaPlanilla(); return; }
        const errores = new Map();
        for (const fecha of fechas) {
            const error = errorDeLaSalida(tipoDeDia(fecha), valoresDeLaSalida(planilla.cambios.get(fecha)));
            if (error !== null) errores.set(fecha, error);
        }
        if (errores.size > 0) {
            planilla.errores = errores;
            const primera = [...errores.keys()].sort()[0];
            if (primera.slice(0, 7) !== planilla.mes) planilla.mes = primera.slice(0, 7);
            pintarLaPlanilla();
            $('mp-error').textContent = textoDeLosErroresDeLaPlanilla(errores.size);
            $('mp-error').hidden = false;
            const fila = $(`mp-dia-${primera}`);
            fila?.scrollIntoView({ block: 'center' });
            fila?.querySelector(`[data-campo="${errores.get(primera).campo}"]`)?.focus();
            return;
        }
        for (const fecha of fechas) {
            const { entrada, salida, nota, al_mes_anterior: alAnterior } = valoresDeLaSalida(planilla.cambios.get(fecha));
            if (entrada === '' && salida === '' && nota === '') delete guardado[fecha];
            else guardado[fecha] = { ...(entrada ? { entrada } : {}), salida, ...(nota ? { nota } : {}), ...(alAnterior ? { al_mes_anterior: true } : {}) };
        }
        cerrarLaPlanilla();
        pintarHoras();
        const texto = `Horas extras guardadas: ${fechas.length === 1 ? '1 día' : `${fechas.length} días`}.`;
        aviso(texto);
        anunciarEn('me-anuncio', texto);
    }

    // ---- La nota en Word ----
    function abrirLaNota(volverA = document.activeElement) {
        const { desde, horas, guardada } = D.nota;
        const fila = {
            tipo: 'horas_a_favor', tipo_nombre: 'Horas a favor', fechas_texto: `${diaCortoSinAnio(desde)}/${desde.slice(0, 4)}`,
            cantidad_texto: horas === JORNADA ? `${horas} horas, el día entero` : conUnidad(horas, 'hora', 'horas'),
            configuracion_texto: 'También en Configuración → Licencias.',
            mostrar_texto: `Tus compañeros ven «${D.persona.nombre_corto} no está».`
        };
        const aclaracion = `Lleva la fecha del ${guardada.split('-').reverse().join('/')}, la última vez que guardaste un cambio en la `
            + 'licencia. Se baja en Word, para imprimir y firmar.';
        $('ml-paso-dos').innerHTML = htmlDelSegundoPaso({ fila, html: htmlDeLaNota(), aclaracion });
        $('ml-paso-dos').scrollTop = 0;
        anunciarEn('me-anuncio', 'Licencia cargada. Podés descargar la nota en Word.');
        abrirModal('modal-licencia', { volverA, foco: () => $('ml-descargar-word') });
    }

    // ---- Los eventos ----
    document.addEventListener('input', (evento) => {
        const campo = evento.target.closest?.('#mp-dias [data-campo]');
        if (!campo || !planilla || campo.type === 'checkbox') return;
        alEscribirEnLaPlanilla(campo);
    });
    document.addEventListener('change', (evento) => {
        const campo = evento.target.closest?.('#mp-dias [data-campo="al_mes_anterior"]');
        if (!campo || !planilla) return;
        alEscribirEnLaPlanilla(campo);
    });
    document.addEventListener('keydown', (evento) => {
        if (evento.key !== 'Enter' || evento.altKey || evento.ctrlKey || evento.metaKey || evento.shiftKey) return;
        const campo = evento.target.closest?.('#mp-dias [data-campo]');
        const nombre = campo?.getAttribute('data-campo');
        if (nombre !== 'salida' && nombre !== 'nota') return;
        evento.preventDefault();
        const salidas = [...$('mp-dias').querySelectorAll('[data-campo="salida"]')];
        const lugar = salidas.findIndex((salida) => salida.getAttribute('data-fecha') === campo.getAttribute('data-fecha'));
        (lugar === -1 ? null : (salidas[lugar + 1] ?? $('mp-guardar')))?.focus?.();
    });
    document.addEventListener('click', (evento) => {
        const t = evento.target;
        // La planilla
        if (t.closest('#modal-planilla [data-cerrar]')) { pedirSalirDeLaPlanilla(); return; }
        if (t.closest('#modal-confirmar-si')) { cerrarLaPlanilla(); return; }
        if (t.closest('#modal-confirmar [data-cerrar]')) { cerrarModal('modal-confirmar'); return; }
        if (t.closest('#modal-licencia [data-cerrar]')) { cerrarModal('modal-licencia'); return; }
        if (t.closest('#ml-descargar-word')) { aviso('En la maqueta no se descarga el Word: es la misma nota de la vista.'); return; }
        if (t.closest('#mp-guardar')) { guardarLaPlanilla(); return; }
        if (t.closest('#mp-anterior')) { irAlMes(mesVecino(planilla.mes, -1)); if ($('mp-anterior').disabled) $('mp-siguiente').focus(); return; }
        if (t.closest('#mp-siguiente')) { irAlMes(mesVecino(planilla.mes, 1)); if ($('mp-siguiente').disabled) $('mp-anterior').focus(); return; }
        const verEn = t.closest('[data-ver-en]');
        if (verEn) {
            const fecha = verEn.getAttribute('data-ver-en');
            irAlMes(fecha.slice(0, 7), { fecha, campo: 'al_mes_anterior' });
            return;
        }
        const nota = t.closest('#mp-dias [data-nota]');
        if (nota) {
            const fecha = nota.getAttribute('data-nota');
            const abrir = !planilla.notasAbiertas.has(fecha);
            if (abrir) planilla.notasAbiertas.add(fecha);
            else planilla.notasAbiertas.delete(fecha);
            pintarLaPlanilla();
            const fila = $(`mp-dia-${fecha}`);
            (fila?.querySelector(abrir ? '[data-campo="nota"]' : '[data-nota]') ?? fila?.querySelector('[data-nota]'))?.focus?.();
            return;
        }
        const quitar = t.closest('#mp-dias [data-quitar]');
        if (quitar) {
            const fecha = quitar.getAttribute('data-quitar');
            const anterior = valoresDeLaSalida(diaDelServidor(fecha));
            planilla.agregados.delete(fecha);
            if (anterior.entrada !== '' || anterior.salida !== '' || anterior.nota !== '') planilla.cambios.set(fecha, { quitar: true });
            else planilla.cambios.delete(fecha);
            planilla.notasAbiertas.delete(fecha);
            if (planilla.errores.delete(fecha)) sinErrorDeLosDias();
            pintarLaPlanilla();
            $('mp-guardar').focus();
            return;
        }
        if (t.closest('#mp-sumar-boton')) {
            const fecha = $('mp-finde').value;
            planilla.agregados.add(fecha);
            if (planilla.cambios.get(fecha)?.quitar === true) planilla.cambios.delete(fecha);
            pintarLaPlanilla();
            const fila = $(`mp-dia-${fecha}`);
            fila?.scrollIntoView({ block: 'center' });
            fila?.querySelector('[data-campo="entrada"]')?.focus();
            return;
        }
        // La página
        if (t.closest('#btn-cargar-horas, [data-cargar="horas"]')) { abrirPlanilla({ volverA: t.closest('button') }); return; }
        if (t.closest('#btn-cargar-licencia')) {
            aviso('En la maqueta, «Cargar licencia» muestra directo el segundo paso: unas horas a favor de 7 h el viernes 05/02.');
            abrirLaNota(t.closest('button'));
            return;
        }
        const editar = t.closest('[data-editar-salida]');
        if (editar) {
            const fecha = editar.getAttribute('data-editar-salida');
            abrirPlanilla({ mes: fecha.slice(0, 7), fecha, volverA: editar });
            return;
        }
        const mes = t.closest('#vista-horas [data-mes]');
        if (mes) {
            pestana.mes = mes.getAttribute('data-mes');
            pintarHoras();
            $('vista-horas').querySelector(`[data-mes="${pestana.mes}"]`)?.focus();
            return;
        }
        const anio = t.closest('#vista-horas [data-anio]');
        if (anio) {
            pestana.anio = Number(anio.getAttribute('data-anio'));
            pestana.mes = null;
            pintarHoras();
            $('vista-horas').querySelector(`[data-anio="${pestana.anio}"]`)?.focus();
            return;
        }
        if (t.closest('[data-abrir="uso"]')) { aviso('En la maqueta, «Registrar un uso autorizado» no se abre.'); return; }
        const laPestana = t.closest('[data-pestana]');
        if (laPestana) { mostrarPestana(laPestana.getAttribute('data-pestana')); return; }
        const accion = t.closest('[data-maqueta-accion]');
        if (accion) { aviso(`En la maqueta, «${accion.getAttribute('data-maqueta-accion')}» no hace nada.`); return; }
        // La barra de la maqueta
        const mq = t.closest('[data-mq]');
        if (mq) irA(mq.getAttribute('data-mq'), mq);
    });
    // Las pestañas con las flechas (roving tabindex)
    document.querySelector('.me-pestanas').addEventListener('keydown', (evento) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(evento.key)) return;
        const botones = [...document.querySelectorAll('[data-pestana]')];
        const lugar = botones.indexOf(document.activeElement);
        if (lugar === -1) return;
        evento.preventDefault();
        let destino = lugar;
        if (evento.key === 'ArrowLeft') destino = (lugar + botones.length - 1) % botones.length;
        if (evento.key === 'ArrowRight') destino = (lugar + 1) % botones.length;
        if (evento.key === 'Home') destino = 0;
        if (evento.key === 'End') destino = botones.length - 1;
        mostrarPestana(botones[destino].getAttribute('data-pestana'));
        botones[destino].focus();
    });

    // Las pantallas de la barra (y de ?ver=)
    function cerrarTodo() {
        for (const id of ['modal-confirmar', 'modal-licencia', 'modal-planilla']) cerrarModal(id);
        planilla = null;
        $('mp-como').open = false;
    }
    function irA(pantalla, desde = null) {
        if (pantalla === 'reiniciar') {
            cerrarTodo();
            guardado = copia(D.salidas);
            Object.assign(pestana, { anio: 2027, mes: MES_DE_HOY });
            mostrarPestana('horas');
            pintarHoras();
            aviso('Volvieron los datos de entrada.');
            return;
        }
        cerrarTodo();
        mostrarPestana('horas');
        if (pantalla === 'febrero') abrirPlanilla({ mes: '2027-02', volverA: desde });
        if (pantalla === 'enero') abrirPlanilla({ mes: '2027-01', volverA: desde });
        if (pantalla === 'como') {
            // «Cómo se cuentan las horas» abierto, con el foco en su título y el cuerpo arriba de todo
            $('mp-como').open = true;
            abrirPlanilla({ mes: '2027-02', volverA: desde, foco: () => $('mp-como').querySelector('summary') });
        }
        if (pantalla === 'pestana' || pantalla === 'pestana-enero') {
            Object.assign(pestana, { anio: 2027, mes: pantalla === 'pestana' ? '2027-02' : '2027-01' });
            pintarHoras();
            $('vista-horas').scrollIntoView({ block: 'start' });
        }
        if (pantalla === 'nota') abrirLaNota(desde);
    }

    // El menú lateral
    const sidebar = $('sidebar');
    const velo = $('sidebarOverlay');
    const botonDelMenu = $('sidebarToggle');
    const abrirMenu = (si) => {
        sidebar.classList.toggle('open', si);
        velo.classList.toggle('visible', si);
        botonDelMenu.setAttribute('aria-expanded', String(si));
    };
    botonDelMenu.addEventListener('click', () => abrirMenu(!sidebar.classList.contains('open')));
    velo.addEventListener('click', () => abrirMenu(false));
    requestAnimationFrame(() => [sidebar, velo, botonDelMenu].forEach((el) => el.classList.add('menu-animable')));

    // Al cargar: la pestaña Horas extras y, con ?ver=, una pantalla (?sinbarra=1, dentro del marco del teléfono)
    const parametros = new URLSearchParams(location.search);
    if (parametros.get('sinbarra') === '1') document.documentElement.classList.add('mq-sin-barra');
    pintarHoras();
    const ver = parametros.get('ver');
    if (ver) irA(ver);
})();
