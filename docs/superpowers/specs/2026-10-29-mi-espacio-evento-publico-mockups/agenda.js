/*
 * MAQUETA de los tres tipos de evento de la agenda de Mi espacio (29/10/2026). Sale de la de la agenda con más onda: dibuja con los
 * datos de datos.js lo que en la página real va a mandar el servidor (los días hábiles, el nombre corto de cada persona, qué ve cada
 * uno y los textos). No guarda nada.
 *
 * Las reglas que dibuja (las decidió el usuario hoy):
 * - Personal (Privado): el «Solo yo» de siempre. Lo ve solo quien lo creó.
 * - Personal (Público): quien lo creó ve su título; los demás, «Tomás: Turno médico» (su nombre corto y lo que eligió mostrar), con la
 *   fecha y las horas, nunca el detalle. Lo ven todos (las 9 personas, todos los roles) o las personas que se eligen. Lo crea cualquier
 *   rol. No manda ningún email a los demás y no tienen «Mi recordatorio»: el recordatorio, si lo hay, le llega solo a quien lo creó.
 * - Laboral: el «Compartido» de siempre (solo administración, con sus emails), con «Toda la administración» en lugar de «Todos».
 */
(() => {
  const D = window.DATOS;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
  const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const FIJOS = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];
  const params = new URLSearchParams(location.search);
  const EN_EL_MARCO = params.get('marco') === '1';

  // ---- Fechas, como texto 'AAAA-MM-DD' contado con Date.UTC ----
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const utc = (f) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)));
  const deUtc = (ms) => new Date(ms).toISOString().slice(0, 10);
  const sumar = (f, n) => deUtc(utc(f) + n * 86400000);
  const lugar = (f) => (new Date(utc(f)).getUTCDay() + 6) % 7;
  const esFinde = (f) => lugar(f) >= 5;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const minuscula = (t) => t.charAt(0).toLowerCase() + t.slice(1);
  const esFecha = (f) => /^\d{4}-\d{2}-\d{2}$/.test(f ?? '');
  const esHora = (h) => /^\d{2}:\d{2}$/.test(h ?? '');
  const feriadosDe = new Map();
  for (const f of D.feriados) {
    if (!feriadosDe.has(f.fecha)) feriadosDe.set(f.fecha, []);
    feriadosDe.get(f.fecha).push(f.nombre);
  }
  const esHabil = (f) => !esFinde(f) && !feriadosDe.has(f) && !FIJOS.includes(f.slice(5));
  const diasHabiles = (desde, hasta) => {
    const dias = [];
    for (let f = desde; f <= hasta; f = sumar(f, 1)) if (esHabil(f)) dias.push(f);
    return dias;
  };
  const diaHabilAntes = (f) => { let d = sumar(f, -1); while (!esHabil(d)) d = sumar(d, -1); return d; };
  const diaHabilDespues = (f) => { let d = sumar(f, 1); while (!esHabil(d)) d = sumar(d, 1); return d; };
  const diaCorto = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const diaLargo = (f) => `${DIAS_LARGOS[lugar(f)]} ${diaCorto(f)}`;
  const diaConMes = (f) => `${DIAS_LARGOS[lugar(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
  const tituloDelMes = (m) => `${cap(MESES[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;
  const mesVecino = (m, n) => {
    const i = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  };
  const listaConY = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l.at(-1)}`);
  const largo = (t) => Array.from(t ?? '').length;

  // ---- Íconos (Lucide, embebidos y decorativos) ----
  const svg = (cuerpo, tam = 13) => `<svg aria-hidden="true" focusable="false" class="ag-icono" xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
  const ICONOS = {
    feriado: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>'),
    licencia: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    ausente: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    compartido: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    // `eye` de Lucide: un Personal (Público), tuyo o de otra persona (lo ven otros)
    ojo: svg('<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
    propio: ''
  };
  const MAS = svg('<path d="M5 12h14"/><path d="M12 5v14"/>', 14);
  const TODOS = svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', 16);

  // ---- Las opciones de la barra de la maqueta, y lo que se ve ----
  const COLORES = ['violeta', 'rosado', 'gris'];
  const estado = {
    quien: [2, 4, 6, 3].includes(Number(params.get('quien'))) ? Number(params.get('quien')) : 2,
    nombres: params.get('nombres') === 'b' ? 'b' : 'a',
    color: COLORES.includes(params.get('color')) ? params.get('color') : 'rosado',
    propuestas: params.get('propuestas') !== '0',
    pestana: params.get('pestana') === 'resumen' ? 'resumen' : 'agenda',
    finde: leerFinde(),
    mes: D.hoy.slice(0, 7),
    elegido: D.hoy,
    abiertos: new Set()
  };
  function leerFinde() {
    try { return localStorage.getItem('rpad-maqueta-evento-publico-finde') === '1'; } catch { return false; }
  }
  function guardarFinde() {
    try { localStorage.setItem('rpad-maqueta-evento-publico-finde', estado.finde ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }

  // Los nombres de los tipos: A, los del usuario (de entrada); B, la alternativa
  const NOMBRES_DE_LOS_TIPOS = {
    a: { privado: 'Personal (Privado)', publico: 'Personal (Público)', laboral: 'Laboral' },
    b: { privado: 'Solo yo', publico: 'Personal, a la vista', laboral: 'Laboral' }
  };
  const nombreDelTipo = (tipo) => NOMBRES_DE_LOS_TIPOS[estado.nombres][tipo];

  const TEXTO_RECORDATORIO = { '1h': '1 hora antes', '2h': '2 horas antes', dia_anterior: 'El día hábil anterior', ninguno: 'Sin aviso' };
  const AVISO_CORTO = { '1h': 'Aviso 1 h antes', '2h': 'Aviso 2 h antes', dia_anterior: 'Aviso el día hábil anterior', ninguno: 'Sin aviso' };
  const LARGO_DEL_PUBLICO = 60;
  const MENSAJES = {
    titulo: 'Escribí qué es el evento.',
    desde: 'Elegí a qué hora empieza.',
    hasta: 'La hora de fin tiene que ser después de la de inicio, el mismo día.',
    categoria: 'Elegí qué ven los demás.',
    otro: 'Escribí qué ven los demás.',
    otroLargo: `Lo que ven los demás puede tener hasta ${LARGO_DEL_PUBLICO} caracteres.`,
    personasPublico: 'Elegí con quién lo compartís, o «Todos».',
    personasLaboral: 'Elegí con quién lo compartís, o «Toda la administración».'
  };
  const AYUDA_PERSONAS = {
    publico: 'No les llega ningún email: lo ven en su agenda y en el Resumen.',
    laboral: 'Les llega un email cuando los sumás, y otro si cambiás o borrás el evento. Solo vos lo podés cambiar.'
  };
  const AYUDA_RECORDATORIO = { privado: '', publico: 'Te llega solo a vos.', laboral: 'Les llega a todas las personas del evento.' };

  const esAdmin = (u) => ['superadmin', 'admin', 'editor'].includes(u.rol);
  const usuario = (id) => D.usuarios.find((u) => u.id === id);
  const iniciales = (nombre) => nombre.split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('');

  // El nombre corto: el primer nombre; «Carla B.» si otra persona de administración activa tiene el mismo primer nombre
  function nombresCortos() {
    const primero = (u) => u.nombre.split(/\s+/)[0];
    const admin = D.usuarios.filter(esAdmin);
    const m = new Map();
    for (const u of D.usuarios) {
      const partes = u.nombre.split(/\s+/);
      const repetido = admin.some((o) => o.id !== u.id && primero(o) === primero(u));
      m.set(u.id, repetido ? `${partes[0]} ${partes.at(-1).charAt(0)}.` : partes[0]);
    }
    return m;
  }

  // Quién ve cada evento: el privado, solo quien lo creó; el público, todos o las personas elegidas (cualquier rol); el laboral, la
  // administración de «Toda la administración» o las personas elegidas
  function veElEvento(e, yo) {
    if (e.creador === yo.id) return true;
    if (e.tipo === 'publico') return e.con === 'todos' || e.con.includes(yo.id);
    if (e.tipo === 'laboral') return esAdmin(yo) && (e.con === 'todos' || e.con.includes(yo.id));
    return false;
  }

  // «Lo ven todos como «Turno médico»», «Lo ven Julián y Tomás como …», «Lo ve Julián como …», «Lo ven 4 personas como …»
  function textoDeLoVen(e, corto) {
    const como = `como «${e.publico}»`;
    if (e.con === 'todos') return `Lo ven todos ${como}`;
    if (e.con.length === 1) return `Lo ve ${corto.get(e.con[0])} ${como}`;
    if (e.con.length === 2) return `Lo ven ${listaConY(e.con.map((id) => corto.get(id)))} ${como}`;
    return `Lo ven ${e.con.length} personas ${como}`;
  }
  // Un laboral tuyo: «Con toda la administración», «Con Carla», «Con 2 personas»
  function textoDeConQuien(e, corto) {
    if (e.con === 'todos') return 'Con toda la administración';
    return e.con.length === 1 ? `Con ${corto.get(e.con[0])}` : `Con ${e.con.length} personas`;
  }

  // Lo de quien mira: sus eventos tal como los ve, sus licencias y, si es administración, los compañeros que no están
  function datos() {
    const yo = usuario(estado.quien);
    const soyAdmin = esAdmin(yo);
    const corto = nombresCortos();
    const eventos = D.eventos.filter((e) => veElEvento(e, yo)).map((e) => {
      const mio = e.creador === yo.id;
      const publicoDeOtro = !mio && e.tipo === 'publico';
      let quien = '';
      if (mio && e.tipo === 'privado') quien = 'Solo vos';
      else if (mio && e.tipo === 'laboral') quien = textoDeConQuien(e, corto);
      else if (!mio && e.tipo === 'laboral') quien = `De ${corto.get(e.creador)}`;
      const loVen = mio && e.tipo === 'publico' ? textoDeLoVen(e, corto) : '';
      return {
        ...e,
        mio,
        clase: publicoDeOtro ? 'publico-otro' : (e.tipo === 'laboral' ? 'compartido' : 'propio'),
        icono: e.tipo === 'publico' ? 'ojo' : (e.tipo === 'laboral' ? 'compartido' : 'propio'),
        // Lo que se lee: el título, salvo en el público de otra persona
        texto: publicoDeOtro ? `${corto.get(e.creador)}: ${e.publico}` : e.titulo,
        quien,
        loVen,
        // El recordatorio: el tuyo y el de un laboral en el que estás; los que ven un público no tienen
        aviso: publicoDeOtro ? '' : AVISO_CORTO[e.recordatorio],
        // Lo de abajo en «Hoy y mañana» del Resumen, en minúscula
        resumen: minuscula(loVen || quien)
      };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desde.localeCompare(b.desde));
    const licencias = D.licencias.filter((l) => l.usuario === yo.id).map((l) => ({ ...l, dias: diasHabiles(l.desde, l.hasta) }));
    // Los compañeros que no están, por día (solo administración los ve, y solo se ven ellos; sin las de horas)
    const ausentes = new Map();
    const hastaDe = new Map();
    const deOtros = soyAdmin ? D.licencias.filter((l) => {
      const u = usuario(l.usuario);
      return u && u.id !== yo.id && !l.horas && esAdmin(u);
    }) : [];
    for (const l of deOtros) {
      for (const f of diasHabiles(l.desde, l.hasta)) {
        const nombre = corto.get(l.usuario);
        if (!ausentes.has(f)) ausentes.set(f, []);
        ausentes.get(f).push(nombre);
        hastaDe.set(`${f} ${nombre}`, l.hasta);
      }
    }
    for (const lista of ausentes.values()) lista.sort((a, b) => a.localeCompare(b, 'es'));
    return { yo, soyAdmin, corto, eventos, licencias, ausentes, hastaDe, deOtros };
  }
  const textoAusentes = (nombres) => `${listaConY(nombres)} ${nombres.length === 1 ? 'no está' : 'no están'}`;

  // ---- El mes ----
  // Las semanas de un mes, de lunes a domingo; sin sábado y domingo, las que no tienen ningún día del mes de lunes a viernes no van
  function semanasDe(mes) {
    const primero = `${mes}-01`;
    const ultimo = deUtc(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
    const fin = sumar(ultimo, 6 - lugar(ultimo));
    const semanas = [];
    for (let f = sumar(primero, -lugar(primero)); f <= fin; f = sumar(f, 7)) {
      const dias = Array.from({ length: 7 }, (_, i) => sumar(f, i)).filter((d) => estado.finde || !esFinde(d));
      if (dias.some((d) => d.slice(0, 7) === mes)) semanas.push(dias);
    }
    return semanas;
  }

  // Lo de cada día que no es una barra: los feriados y los eventos, por hora
  function cosasDelDia(f, dt) {
    const cosas = (feriadosDe.get(f) ?? []).map((n) => ({ clase: 'feriado', icono: 'feriado', texto: `Feriado: ${n}` }));
    for (const e of dt.eventos.filter((x) => x.fecha === f)) {
      cosas.push({ clase: e.clase, icono: e.icono, hora: e.desde, texto: e.texto, loVen: e.loVen, evento: e.id });
    }
    return cosas;
  }

  // Los renglones de cada cosa, con 4 lugares por día menos las barras de la semana: 1 cosa, hasta 3 renglones; 2, hasta 2; 3, uno
  function repartir(k, lugares) {
    if (k === 0) return { lineas: [], mas: 0 };
    const tope = k === 1 ? 3 : k === 2 ? 2 : 1;
    if (k <= lugares && k <= 3) {
      const lineas = Array(k).fill(1);
      let sobra = lugares - k;
      for (let i = 0; i < k && sobra > 0; i++) {
        const extra = Math.min(tope - 1, sobra);
        lineas[i] += extra;
        sobra -= extra;
      }
      return { lineas, mas: 0 };
    }
    const mostrar = Math.max(1, lugares - 1);
    return { lineas: Array(mostrar).fill(1), mas: k - mostrar };
  }

  const htmlDeCosa = (cosa, lineas) => {
    const hora = cosa.hora ? `<b>${esc(cosa.hora)}</b> ` : '';
    const titulo = `${cosa.hora ? `${cosa.hora} ` : ''}${cosa.texto}${cosa.loVen ? `. ${cosa.loVen}` : ''}`;
    const cuerpo = `${ICONOS[cosa.icono]}${hora}${esc(cosa.texto)}`;
    return cosa.evento != null
      ? `<button type="button" class="ag-ev ${cosa.clase}" data-evento="${cosa.evento}" style="--lineas:${lineas}" title="${esc(titulo)}">${cuerpo}</button>`
      : `<span class="ag-ev ${cosa.clase}" style="--lineas:${lineas}" title="${esc(titulo)}">${cuerpo}</span>`;
  };

  // Las barras de una semana: tramos seguidos de días con lo mismo (la misma licencia tuya, o los mismos compañeros)
  function tramos(dias, claveDe) {
    const lista = [];
    dias.forEach((f, i) => {
      const clave = claveDe(f);
      const ultimo = lista.at(-1);
      if (clave === null) return;
      if (ultimo && ultimo.clave === clave && ultimo.hasta === i - 1) ultimo.hasta = i;
      else lista.push({ clave, desde: i, hasta: i });
    });
    return lista;
  }

  function htmlDelMes(dt) {
    const semanas = semanasDe(estado.mes);
    const columnas = estado.finde ? 7 : 5;
    const cabeza = Array.from({ length: columnas }, (_, i) => {
      const esHoy = lugar(D.hoy) === i && D.hoy.slice(0, 7) === estado.mes;
      return `<div class="ag-cabeza${esHoy ? ' hoy' : ''}" role="columnheader"><span aria-hidden="true">${DIAS_CORTOS[i]}</span><span class="visualmente-oculto">${DIAS_LARGOS[i]}</span></div>`;
    }).join('');
    const licenciaDe = (f) => dt.licencias.find((l) => l.dias.includes(f)) ?? null;
    const filas = semanas.map((dias, s) => {
      const tramosLic = tramos(dias, (f) => {
        const l = licenciaDe(f);
        return l ? dt.licencias.indexOf(l) : null;
      });
      const tramosAus = tramos(dias, (f) => (dt.ausentes.has(f) ? dt.ausentes.get(f).join('|') : null));
      const carriles = (tramosLic.length > 0 ? 1 : 0) + (tramosAus.length > 0 ? 1 : 0);
      const filaLic = 2;
      const filaAus = tramosLic.length > 0 ? 3 : 2;
      const celdas = dias.map((f, i) => {
        const cosas = cosasDelDia(f, dt);
        const { lineas, mas } = repartir(cosas.length, 4 - carriles);
        const abierto = estado.abiertos.has(f);
        const vistas = abierto ? cosas : cosas.slice(0, lineas.length);
        const clases = ['ag-dia', i === 0 && 'primera', f.slice(0, 7) !== estado.mes && 'otro-mes', esFinde(f) && 'finde', feriadosDe.has(f) && 'feriado',
          f === D.hoy && 'hoy', f < D.hoy && f.slice(0, 7) === estado.mes && 'paso', f === estado.elegido && 'elegido'].filter(Boolean).join(' ');
        const puntos = cosas.map((c) => `<i class="${c.clase}"></i>`).join('');
        return `<div class="${clases}" data-fecha="${f}" style="grid-column:${i + 1}" role="gridcell" aria-label="${esc(cap(diaConMes(f)))}${f === D.hoy ? ', hoy' : ''}">`
          + `<span class="ag-num">${Number(f.slice(8, 10))}</span>`
          + `<button type="button" class="ag-agregar" data-agregar="${f}" aria-label="Nuevo evento el ${esc(diaLargo(f))}">${MAS}</button>`
          + `<div class="ag-cosas">${vistas.map((c, j) => htmlDeCosa(c, abierto ? 3 : lineas[j])).join('')}`
          + `${mas > 0 && !abierto ? `<button type="button" class="ag-mas" data-ver-mas="${f}">y ${mas} más</button>` : ''}</div>`
          + `<span class="ag-puntos" aria-hidden="true">${puntos}</span></div>`;
      }).join('');
      const barra = (clase, fila, t, texto, titulo, sigueAntes, sigueDespues) => `<div class="ag-barra ${clase}${sigueAntes ? ' sigue-antes' : ''}${sigueDespues ? ' sigue-despues' : ''}" style="grid-column:${t.desde + 1} / ${t.hasta + 2};grid-row:${fila};--demora:${(s * 0.16 + t.desde * 0.05).toFixed(2)}s" title="${esc(titulo)}">`
        + `${ICONOS[clase]}<span>${esc(texto)}</span></div>`;
      const barrasLic = tramosLic.map((t) => {
        const l = dt.licencias[t.clave];
        const rango = l.desde === l.hasta ? `el ${diaLargo(l.desde)}` : `del ${diaLargo(l.desde)} al ${diaLargo(l.hasta)}`;
        return barra('licencia', filaLic, t, l.tipo, `${l.tipo}, ${rango}`, dias[t.desde] > l.dias[0] && t.desde === 0, dias[t.hasta] < l.dias.at(-1) && t.hasta === dias.length - 1);
      }).join('');
      const barrasAus = tramosAus.map((t) => {
        const nombres = t.clave.split('|');
        const sigueAntes = t.desde === 0 && dt.ausentes.get(diaHabilAntes(dias[t.desde]))?.join('|') === t.clave;
        const sigueDespues = t.hasta === dias.length - 1 && dt.ausentes.get(diaHabilDespues(dias[t.hasta]))?.join('|') === t.clave;
        const titulo = nombres.map((n) => `${n} no está. Hasta el ${diaLargo(dt.hastaDe.get(`${dias[t.hasta]} ${n}`) ?? dias[t.hasta])}`).join('. ');
        return barra('ausente', filaAus, t, textoAusentes(nombres), titulo, sigueAntes, sigueDespues);
      }).join('');
      return `<div class="ag-semana carriles-${carriles}" role="row" style="--carriles:${carriles}">${celdas}${barrasLic}${barrasAus}</div>`;
    }).join('');
    return `<div class="ag-grilla" role="grid" aria-labelledby="ag-mes-titulo" style="--columnas:${columnas}"><div class="ag-cabezas" role="row">${cabeza}</div>${filas}</div>`;
  }

  // La frase de la banda: lo del mes en una línea
  function fraseDelMes(dt) {
    const mes = estado.mes;
    const delMes = (f) => f.slice(0, 7) === mes;
    const nEventos = dt.eventos.filter((e) => delMes(e.fecha)).length;
    const nFeriados = D.feriados.filter((f) => delMes(f.fecha)).length;
    const partes = [];
    if (nEventos > 0) partes.push(`${nEventos} ${nEventos === 1 ? 'evento' : 'eventos'}`);
    if (nFeriados > 0) partes.push(`${nFeriados} ${nFeriados === 1 ? 'feriado' : 'feriados'}`);
    for (const l of dt.licencias.filter((x) => x.dias.some(delMes))) {
      const ultimo = deUtc(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
      const desde = l.desde < `${mes}-01` ? `${mes}-01` : l.desde;
      const hasta = l.hasta > ultimo ? ultimo : l.hasta;
      const nombre = l.tipo.split(',')[0].toLowerCase();
      const tu = nombre.split(' ')[0].endsWith('s') ? 'tus' : 'tu';
      partes.push(desde === hasta ? `${tu} ${nombre} el ${Number(desde.slice(8, 10))}` : `${tu} ${nombre} del ${Number(desde.slice(8, 10))} al ${Number(hasta.slice(8, 10))}`);
    }
    if (partes.length === 0) return `Nada cargado en ${MESES[Number(mes.slice(5, 7)) - 1]}. Tocá un día para agendar algo.`;
    return `${cap(listaConY(partes))}.`;
  }

  // Lo que queda escondido el fin de semana: los eventos y los feriados de los sábados y domingos del mes
  function cuentaDelFinde(dt) {
    const delMes = (f) => f.slice(0, 7) === estado.mes && esFinde(f);
    return dt.eventos.filter((e) => delMes(e.fecha)).length + D.feriados.filter((f) => delMes(f.fecha)).length;
  }

  // ---- Próximos ----
  // El detalle de un evento: quién está, en su color (o, en un público tuyo, a quiénes se lo mostrás y cómo), y su aviso
  function detalleDeEvento(c) {
    const quien = c.quien ? `<span class="me-insignia ${c.clase === 'propio' ? 'azul' : 'violeta'}">${esc(c.quien)}</span>` : '';
    const loVen = c.loVen ? `<span class="ag-lo-ven">${ICONOS.ojo}${esc(c.loVen)}</span>` : '';
    return `${quien}${loVen}${c.aviso ? `<span>${esc(c.aviso)}</span>` : ''}`;
  }
  function htmlDeProximos(dt) {
    const hasta = sumar(D.hoy, 30);
    const manana = sumar(D.hoy, 1);
    const domingo = sumar(D.hoy, 6 - lugar(D.hoy));
    const cosas = [];
    for (const f of D.feriados) if (f.fecha >= D.hoy && f.fecha <= hasta) cosas.push({ fecha: f.fecha, clase: 'feriado', icono: 'feriado', texto: `Feriado: ${f.nombre}`, detalle: '' });
    for (const l of dt.licencias) {
      if (l.hasta < D.hoy || l.desde > hasta) continue;
      cosas.push({ fecha: l.desde > D.hoy ? l.desde : D.hoy, clase: 'licencia', icono: 'licencia', texto: l.tipo, detalle: l.desde === l.hasta ? '' : `Hasta el ${diaLargo(l.hasta)}` });
    }
    for (const l of dt.deOtros) {
      if (l.hasta < D.hoy || l.desde > hasta) continue;
      cosas.push({ fecha: l.desde > D.hoy ? l.desde : D.hoy, clase: 'ausente', icono: 'ausente', texto: `${dt.corto.get(l.usuario)} no está`, detalle: l.desde === l.hasta ? '' : `Hasta el ${diaLargo(l.hasta)}` });
    }
    for (const e of dt.eventos) {
      if (e.fecha < D.hoy || e.fecha > hasta) continue;
      cosas.push({ fecha: e.fecha, clase: e.clase, icono: e.icono, hora: e.desde, texto: e.texto, quien: e.quien, loVen: e.loVen, aviso: e.aviso, evento: e.id });
    }
    cosas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora ?? '').localeCompare(b.hora ?? ''));
    const grupos = [
      { titulo: `Hoy, ${diaLargo(D.hoy)}`, es: (f) => f === D.hoy, dia: null },
      { titulo: `Mañana, ${diaLargo(manana)}`, es: (f) => f === manana, dia: null },
      { titulo: 'Esta semana', es: (f) => f <= domingo, dia: (f) => `${DIAS_CORTOS[lugar(f)]} ${Number(f.slice(8, 10))}` },
      { titulo: 'Más adelante', es: () => true, dia: (f) => `${DIAS_CORTOS[lugar(f)]} ${diaCorto(f)}` }
    ].map((g) => ({ ...g, items: [] }));
    for (const c of cosas) grupos.find((g) => g.es(c.fecha)).items.push(c);
    return grupos.filter((g) => g.items.length > 0).map((g) => `<h3>${esc(g.titulo)}</h3><ul class="me-prox-lista">${g.items.map((c) => {
      const hora = g.dia === null ? (c.hora ?? 'Todo el día') : g.dia(c.fecha);
      const texto = g.dia !== null && c.hora ? `${c.hora} ${c.texto}` : c.texto;
      const marca = `<span class="ag-prox-marca ${c.clase}" aria-hidden="true">${ICONOS[c.icono] || '<i></i>'}</span>`;
      const titulo = c.evento != null
        ? `<button type="button" class="me-prox-titulo" data-evento="${c.evento}">${marca}${esc(texto)}</button>`
        : `<span class="me-prox-titulo">${marca}${esc(texto)}</span>`;
      const detalle = c.evento != null ? detalleDeEvento(c) : esc(c.detalle);
      return `<li class="me-prox ag-prox ${c.clase}"><span class="me-prox-hora">${esc(hora)}</span>${titulo}${detalle ? `<span class="me-prox-detalle">${detalle}</span>` : ''}</li>`;
    }).join('')}</ul>`).join('');
  }

  // ---- El día elegido (en el teléfono) ----
  function htmlDelElegido(dt) {
    const f = estado.elegido;
    const items = [];
    for (const n of feriadosDe.get(f) ?? []) items.push({ clase: 'feriado', icono: 'feriado', hora: 'Todo el día', texto: `Feriado: ${n}` });
    for (const l of dt.licencias.filter((x) => x.dias.includes(f))) items.push({ clase: 'licencia', icono: 'licencia', hora: 'Todo el día', texto: l.tipo });
    if (dt.ausentes.has(f)) items.push({ clase: 'ausente', icono: 'ausente', hora: 'Todo el día', texto: textoAusentes(dt.ausentes.get(f)) });
    for (const e of dt.eventos.filter((x) => x.fecha === f)) items.push({ clase: e.clase, icono: e.icono, hora: e.desde, texto: e.texto, quien: e.loVen || e.quien, evento: e.id });
    const lista = items.length === 0
      ? '<p class="me-vacio">No hay nada este día.</p>'
      : `<ul class="ag-elegido-lista">${items.map((c) => {
        const cuerpo = `<span class="ag-elegido-hora">${esc(c.hora)}</span><span class="ag-elegido-texto">${esc(c.texto)}${c.quien ? `<small>${esc(c.quien)}</small>` : ''}</span>`;
        const icono = `<span class="ag-fila-icono" aria-hidden="true">${ICONOS[c.icono] || '<i></i>'}</span>`;
        return `<li class="ag-ev-fila ${c.clase}">${c.evento != null ? `<button type="button" data-evento="${c.evento}">${icono}${cuerpo}</button>` : `<div>${icono}${cuerpo}</div>`}</li>`;
      }).join('')}</ul>`;
    return `<div class="ag-elegido-cabeza"><h3 id="ag-elegido-titulo">${esc(cap(diaConMes(f)))}${f === D.hoy ? ' (hoy)' : ''}</h3>`
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-agregar="${f}">${MAS}Nuevo evento</button></div>${lista}`;
  }

  /*
   * La leyenda. Habla de quién lo ve, no de los nombres de los tipos, así se lee igual con los nombres A o B: «Solo vos» queda como
   * hoy (lo tuyo, en tinta y sin ícono); el ojo es siempre «lo ven otros», así que lo tuyo con ojo es «Tuyos, a la vista» y lo de otra
   * persona con ojo, «Personales de otros» (en el color que se elige en la barra); y lo que era «Compartidos» pasa a «Laborales». Lo que
   * quien mira no puede ver no va: «Laborales» y «Compañeros que no están», solo para administración (como la decisión del 27/10/2026
   * con los compañeros)
   */
  const htmlDeLaLeyenda = (dt) => [
    ['propio', 'propio', 'Solo vos'],
    ['propio', 'ojo', 'Tuyos, a la vista'],
    ['publico-otro', 'ojo', 'Personales de otros'],
    ...(dt.soyAdmin ? [['compartido', 'compartido', 'Laborales']] : []),
    ['licencia', 'licencia', 'Tus licencias y francos'],
    ['feriado', 'feriado', 'Feriados'],
    ...(dt.soyAdmin ? [['ausente', 'ausente', 'Compañeros que no están']] : [])
  ].map(([clase, icono, texto]) => `<li><span class="ag-muestra ${clase}" aria-hidden="true">${ICONOS[icono]}</span>${texto}</li>`).join('');

  // ---- «Hoy y mañana» del Resumen (htmlDeHoyYManana de la página real, con los eventos como los ve quien mira) ----
  function htmlDeHoyYManana(dt) {
    const manana = sumar(D.hoy, 1);
    const ahora = D.ahora.slice(11, 16);
    const terminado = (e) => e.fecha === D.hoy && (e.hasta ?? e.desde) < ahora;
    const filaDeEvento = (e) => `<li><time>${esc(e.desde)}</time> ${esc(e.texto)}${e.resumen ? `<small>${esc(e.resumen)}</small>` : ''}</li>`;
    const ausentesDe = (dia) => dt.deOtros.filter((l) => diasHabiles(l.desde, l.hasta).includes(dia)
      && (dia === D.hoy || !diasHabiles(l.desde, l.hasta).includes(D.hoy)))
      .map((l) => `<li class="ausente">${esc(dt.corto.get(l.usuario))} no está<small>Vuelve el ${esc(diaLargo(diaHabilDespues(l.hasta)))}</small></li>`);
    const delDia = (dia) => [...dt.eventos.filter((e) => e.fecha === dia && !terminado(e)).map(filaDeEvento), ...ausentesDe(dia)];
    const feriado = D.feriados.find((f) => f.fecha >= D.hoy);
    const columnas = [
      ['Hoy', delDia(D.hoy)],
      ['Mañana', delDia(manana)],
      ['Próximo feriado', feriado ? [`<li><b>${esc(cap(diaLargo(feriado.fecha)))}</b><small>${esc(feriado.nombre)}</small></li>`] : []]
    ].filter(([, filas]) => filas.length > 0);
    const sinEventos = !dt.eventos.some((e) => (e.fecha === D.hoy && !terminado(e)) || e.fecha === manana);
    const verLaAgenda = '<a class="sg-link" href="#agenda" data-pestana="agenda">Ver la agenda</a>';
    const html = columnas.map(([titulo, filas], i) => `<div class="me-columna"><h3>${titulo}</h3><ul>${filas.join('')}</ul>${i === columnas.length - 1 ? verLaAgenda : ''}</div>`);
    return '<section class="me-hoy" aria-labelledby="me-hoy-titulo"><h2 id="me-hoy-titulo">Hoy y mañana</h2>'
      + `${sinEventos ? '<p class="me-vacio">No tenés eventos hoy ni mañana.</p>' : ''}`
      + `${html.length > 0 ? `<div class="me-columnas">${html.join('')}</div>` : verLaAgenda}</section>`;
  }

  // ---- Dibujar ----
  const porId = (id) => document.getElementById(id);
  const reducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  function pintar({ animar = false } = {}) {
    const dt = datos();
    document.documentElement.dataset.colorPublico = estado.color;
    porId('ag-mes-titulo').textContent = tituloDelMes(estado.mes);
    porId('ag-frase').textContent = fraseDelMes(dt);
    const cuenta = cuentaDelFinde(dt);
    const boton = porId('ag-finde');
    boton.setAttribute('aria-pressed', String(estado.finde));
    const cuentaEl = porId('ag-finde-cuenta');
    cuentaEl.hidden = estado.finde || cuenta === 0;
    cuentaEl.textContent = String(cuenta);
    boton.setAttribute('aria-label', `Sábado y domingo${!estado.finde && cuenta > 0 ? `: ${cuenta} ${cuenta === 1 ? 'cosa escondida' : 'cosas escondidas'}` : ''}`);
    const mes = porId('ag-mes');
    if (animar && !reducido()) mes.setAttribute('data-animar', '');
    mes.innerHTML = htmlDelMes(dt);
    if (animar && !reducido()) requestAnimationFrame(() => requestAnimationFrame(() => mes.removeAttribute('data-animar')));
    porId('ag-leyenda').innerHTML = htmlDeLaLeyenda(dt);
    porId('ag-proximos').innerHTML = htmlDeProximos(dt);
    porId('ag-elegido').innerHTML = htmlDelElegido(dt);
    porId('me-resumen-hoy').innerHTML = htmlDeHoyYManana(dt);
    porId('header-nombre').textContent = dt.yo.nombre;
    porId('header-rol').textContent = dt.yo.rolTexto;
    porId('header-iniciales').textContent = iniciales(dt.yo.nombre);
    porId('sidebarAdmin').hidden = !dt.soyAdmin;
    porId('header-campana').hidden = !dt.soyAdmin;
    porId('sidebarNotas').hidden = !(dt.soyAdmin || dt.yo.rol === 'colaborador');
    mostrarPestana(estado.pestana, { foco: false });
  }

  // Las pestañas: la maqueta tiene el Resumen (solo «Hoy y mañana») y la Agenda; Licencias y Horas extras no cambian
  function mostrarPestana(nombre, { foco = true } = {}) {
    estado.pestana = nombre;
    for (const p of ['resumen', 'licencias', 'horas', 'agenda']) {
      const tab = porId(`tab-${p}`);
      const elegida = p === nombre;
      tab.setAttribute('aria-selected', String(elegida));
      tab.tabIndex = elegida ? 0 : -1;
      porId(`vista-${p}`).hidden = !elegida;
    }
    if (foco) porId(`tab-${nombre}`).focus();
  }

  // ---- El formulario (el de la página real, con «Tipo de evento»; la maqueta no guarda nada) ----
  const RECORDATORIOS = ['1h', '2h', 'dia_anterior', 'ninguno'];
  const form = { evento: null, tipo: 'privado', categoria: null, otro: '', todos: false, personas: new Set(), validado: false };
  const enLaLista = (texto) => D.categorias.find((c) => c.texto === texto) ?? null;
  const categoriasVisibles = () => D.categorias.filter((c) => estado.propuestas || !c.propuesta);
  // Lo que ven los demás, como texto: la pastilla elegida o lo escrito en «Otro»
  const textoDelPublico = () => (form.categoria === 'otro' ? form.otro.trim() : (form.categoria ?? ''));

  const minutos = (h) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  // Cuándo sale el recordatorio (en la página real lo calcula el servidor: GET /mi-espacio/eventos/aviso)
  function textoDelAviso(fecha, desde, recordatorio) {
    const texto = TEXTO_RECORDATORIO[recordatorio];
    if (recordatorio === 'ninguno' || !esFecha(fecha) || !esHora(desde)) return texto;
    let dia = fecha;
    let hora = minutos(desde);
    if (recordatorio === 'dia_anterior') dia = diaHabilAntes(fecha);
    else {
      hora -= recordatorio === '1h' ? 60 : 120;
      if (hora < 0) { hora += 1440; dia = sumar(dia, -1); }
      if (!esHabil(dia)) dia = diaHabilAntes(dia);
    }
    const momento = `${dia} ${hhmm(hora)}`;
    if (D.ahora >= `${fecha} ${desde}`) return `${texto} (el evento ya empezó)`;
    if (momento < D.ahora) return `${texto} (ya pasó esa hora: sale con el próximo envío, si es antes del evento)`;
    const cuando = dia === D.hoy ? 'hoy' : dia === sumar(D.hoy, 1) ? 'mañana' : `el ${diaLargo(dia)}`;
    return `${texto} (${cuando} a las ${hhmm(hora)})`;
  }

  let volverA = null;
  function abrirModal(id, foco) {
    volverA = document.activeElement;
    porId(id).classList.add('active');
    setTimeout(() => porId(foco)?.focus(), 100);
  }
  function cerrarModales() {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
    if (volverA && document.contains(volverA)) volverA.focus();
  }

  function abrirNuevo(fecha, evento = null) {
    const dt = datos();
    form.evento = evento;
    form.tipo = evento?.tipo ?? 'privado';
    if (!dt.soyAdmin && form.tipo === 'laboral') form.tipo = 'privado';
    form.todos = evento?.con === 'todos';
    form.personas = new Set(Array.isArray(evento?.con) ? evento.con : []);
    form.categoria = null;
    form.otro = '';
    if (evento?.tipo === 'publico') {
      if (enLaLista(evento.publico)) form.categoria = evento.publico;
      else { form.categoria = 'otro'; form.otro = evento.publico; }
    }
    form.validado = false;
    porId('modal-evento-titulo').textContent = evento ? 'Editar evento' : 'Nuevo evento';
    porId('ev-titulo').value = evento?.titulo ?? '';
    porId('ev-fecha').value = evento?.fecha ?? fecha;
    porId('ev-desde').value = evento?.desde ?? '';
    porId('ev-hasta').value = evento?.hasta ?? '';
    porId('ev-detalle').value = evento?.detalle ?? '';
    porId('ev-otro').value = form.otro;
    const elegido = evento?.recordatorio ?? '2h';
    porId('ev-recordatorio').innerHTML = RECORDATORIOS.map((v) => `<option value="${v}"${v === elegido ? ' selected' : ''}>${TEXTO_RECORDATORIO[v]}</option>`).join('');
    porId('ev-borrar').hidden = !evento;
    limpiarErrores();
    pintarFormulario();
    abrirModal('modal-evento', 'ev-titulo');
  }

  // Todo lo que depende del tipo, de lo elegido y de lo escrito; no reemplaza los controles que no cambian (el foco se queda)
  function pintarFormulario() {
    const dt = datos();
    // Con «Las propuestas de la lista» ocultas, una propuesta ya elegida se ve como escrita en «Otro»
    const propia = enLaLista(form.categoria);
    if (propia?.propuesta && !estado.propuestas) { form.otro = form.categoria; form.categoria = 'otro'; porId('ev-otro').value = form.otro; }

    // Tipo de evento: tres para administración, dos (los personales) para un lector o un colaborador
    porId('ev-tipos').className = `me-opciones ${dt.soyAdmin ? 'tres' : 'dos'}`;
    for (const b of porId('ev-tipos').querySelectorAll('[data-tipo]')) {
      b.hidden = b.dataset.tipo === 'laboral' && !dt.soyAdmin;
      b.setAttribute('aria-pressed', String(b.dataset.tipo === form.tipo));
    }
    for (const b of porId('ev-tipos').querySelectorAll('[data-nombre-tipo]')) b.textContent = nombreDelTipo(b.dataset.nombreTipo);

    // Qué ven los demás y la vista previa (solo en un público)
    porId('ev-publico').hidden = form.tipo !== 'publico';
    porId('ev-categorias').innerHTML = [
      ...categoriasVisibles().map((c) => `<button type="button" class="sg-chip${c.propuesta ? ' ag-propuesta' : ''}" data-categoria="${esc(c.texto)}" aria-pressed="${form.categoria === c.texto}">${esc(c.texto)}${c.propuesta ? '<span class="visualmente-oculto"> (propuesta para aprobar)</span>' : ''}</button>`),
      `<button type="button" class="sg-chip" data-categoria="otro" aria-pressed="${form.categoria === 'otro'}">Otro</button>`
    ].join('');
    porId('ev-otro-grupo').hidden = form.categoria !== 'otro';
    pintarCuenta();
    pintarVistaPrevia(dt);

    // Con quién: en un público, todas las personas del RPAD (todos los roles); en un laboral, solo la administración
    const grupo = porId('ev-grupo-personas');
    grupo.hidden = form.tipo === 'privado';
    if (form.tipo !== 'privado') {
      const elegibles = D.usuarios.filter((u) => u.id !== dt.yo.id && (form.tipo === 'publico' || esAdmin(u)));
      const textoTodos = form.tipo === 'laboral' ? 'Toda la administración' : 'Todos';
      porId('ev-personas').innerHTML = `<button type="button" class="me-persona" data-persona="todos" aria-pressed="${form.todos}"><i aria-hidden="true">${TODOS}</i>${textoTodos}</button>`
        + elegibles.map((u) => `<button type="button" class="me-persona" data-persona="${u.id}" aria-pressed="${!form.todos && form.personas.has(u.id)}"${form.todos ? ' disabled' : ''}><i aria-hidden="true">${esc(iniciales(u.nombre))}</i>${esc(u.nombre)}</button>`).join('');
      porId('ev-personas-ayuda').textContent = AYUDA_PERSONAS[form.tipo];
      const cuantas = form.personas.size;
      porId('ev-personas-cuantas').textContent = form.todos || cuantas === 0 ? '' : `(${cuantas} ${cuantas === 1 ? 'persona' : 'personas'})`;
    }

    // El recordatorio: cuándo sale y a quién le llega
    pintarAviso();
    const ayuda = porId('ev-recordatorio-ayuda');
    ayuda.textContent = AYUDA_RECORDATORIO[form.tipo];
    ayuda.hidden = ayuda.textContent === '';
    if (form.validado) validar({ mostrar: true, enfocar: false });
  }

  function pintarCuenta() {
    const n = largo(form.otro.trim());
    const cuenta = porId('ev-otro-cuenta');
    cuenta.textContent = `${n} de ${LARGO_DEL_PUBLICO} caracteres`;
    cuenta.classList.toggle('pasado', n > LARGO_DEL_PUBLICO);
  }

  // «Así lo ven los demás:» la pastilla tal cual va a salir en su agenda, en el color elegido, con la hora y lo que eligió mostrar
  function pintarVistaPrevia(dt = datos()) {
    const fecha = porId('ev-fecha').value;
    const desde = porId('ev-desde').value;
    porId('ev-vista-previa-dia').textContent = esFecha(fecha) ? `${DIAS_CORTOS[lugar(fecha)]} ${Number(fecha.slice(8, 10))}` : 'Sin fecha';
    const texto = textoDelPublico();
    const pastilla = porId('ev-vista-previa-evento');
    pastilla.innerHTML = `${ICONOS.ojo}${esHora(desde) ? `<b>${esc(desde)}</b> ` : ''}${esc(dt.corto.get(dt.yo.id))}: ${texto ? esc(texto) : '<span class="ag-falta">elegí qué ven</span>'}`;
  }

  function pintarAviso() {
    const aviso = porId('ev-aviso');
    aviso.hidden = false;
    aviso.textContent = esHora(porId('ev-desde').value)
      ? textoDelAviso(porId('ev-fecha').value, porId('ev-desde').value, porId('ev-recordatorio').value)
      : 'Elegí la hora y te digo cuándo sale.';
  }

  // ---- Los errores (los de la página real, más los del público) ----
  const CAMPOS = [
    ['ev-titulo', 'ev-titulo-error'], ['ev-desde', 'ev-desde-error'], ['ev-hasta', 'ev-hasta-error'],
    ['ev-categorias', 'ev-categoria-error'], ['ev-otro', 'ev-otro-error'], ['ev-personas', 'ev-personas-error']
  ];
  function limpiarErrores() {
    for (const [campo, error] of CAMPOS) {
      porId(campo).removeAttribute('aria-invalid');
      porId(error).hidden = true;
      porId(error).textContent = '';
    }
  }
  function validar({ mostrar = true, enfocar = true } = {}) {
    const errores = [];
    const desde = porId('ev-desde').value;
    const hasta = porId('ev-hasta').value;
    if (porId('ev-titulo').value.trim() === '') errores.push(['ev-titulo', 'ev-titulo-error', MENSAJES.titulo]);
    if (!esHora(desde)) errores.push(['ev-desde', 'ev-desde-error', MENSAJES.desde]);
    else if (esHora(hasta) && hasta <= desde) errores.push(['ev-hasta', 'ev-hasta-error', MENSAJES.hasta]);
    if (form.tipo === 'publico') {
      if (form.categoria === null) errores.push(['ev-categorias', 'ev-categoria-error', MENSAJES.categoria]);
      else if (form.categoria === 'otro' && form.otro.trim() === '') errores.push(['ev-otro', 'ev-otro-error', MENSAJES.otro]);
      else if (form.categoria === 'otro' && largo(form.otro.trim()) > LARGO_DEL_PUBLICO) errores.push(['ev-otro', 'ev-otro-error', MENSAJES.otroLargo]);
    }
    if (form.tipo !== 'privado' && !form.todos && form.personas.size === 0) {
      errores.push(['ev-personas', 'ev-personas-error', form.tipo === 'laboral' ? MENSAJES.personasLaboral : MENSAJES.personasPublico]);
    }
    if (mostrar) {
      limpiarErrores();
      for (const [campo, error, mensaje] of errores) {
        porId(campo).setAttribute('aria-invalid', 'true');
        porId(error).textContent = mensaje;
        porId(error).hidden = false;
      }
      if (enfocar && errores.length > 0) {
        const campo = porId(errores[0][0]);
        (campo.matches('input, textarea, select') ? campo : campo.querySelector('button:not([disabled])'))?.focus();
      }
    }
    return errores;
  }

  // ---- El detalle de un evento de otra persona ----
  function cuandoEs(e) {
    return `${cap(diaLargo(e.fecha))}/${e.fecha.slice(0, 4)} ${e.hasta ? `de ${e.desde} a ${e.hasta}` : `a las ${e.desde}`}`;
  }
  function abrirAjeno(e) {
    const dt = datos();
    const de = dt.corto.get(e.creador);
    porId('mea-cuando').textContent = cuandoEs(e);
    if (e.tipo === 'publico') {
      porId('modal-evento-ajeno-titulo').textContent = `${de}: ${e.publico}`;
      porId('mea-detalle').hidden = true;
      porId('mea-quien').innerHTML = `<span class="me-insignia publico-otro">${ICONOS.ojo}${esc(nombreDelTipo('publico'))}</span>`
        + `<span>Es un evento personal de ${esc(de)}: se ve solo lo que eligió mostrar.</span>`;
      porId('mea-grupo-recordatorio').hidden = true;
      abrirModal('modal-evento-ajeno', 'mea-cerrar');
      return;
    }
    porId('modal-evento-ajeno-titulo').textContent = e.titulo;
    porId('mea-detalle').hidden = !e.detalle;
    porId('mea-detalle').textContent = e.detalle ?? '';
    const otros = Array.isArray(e.con) ? e.con.filter((i) => i !== dt.yo.id).map((i) => dt.corto.get(i)) : [];
    porId('mea-quien').innerHTML = `<span class="me-insignia violeta">${esc(nombreDelTipo('laboral'))}</span>`
      + `<span>Lo creó ${esc(de)}. ${e.con === 'todos' ? 'Es para toda la administración.' : `Están: ${esc(listaConY(['vos', ...otros]))}.`}</span>`;
    porId('mea-grupo-recordatorio').hidden = false;
    porId('mea-recordatorio').innerHTML = `<option value="evento">${TEXTO_RECORDATORIO[e.recordatorio]} (el que eligió ${esc(de)})</option><option value="ninguno">Sin aviso</option>`;
    porId('mea-aviso').hidden = false;
    porId('mea-aviso').textContent = textoDelAviso(e.fecha, e.desde, e.recordatorio);
    abrirModal('modal-evento-ajeno', 'mea-recordatorio');
  }

  const aviso = (texto) => {
    const el = porId('mq-aviso');
    el.textContent = texto;
    el.classList.add('visible');
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => el.classList.remove('visible'), 2600);
  };
  // Después de volver a dibujar una lista (las pastillas, las personas), el foco vuelve al mismo control
  const enfocar = (selector) => document.querySelector(selector)?.focus();

  // ---- Lo que se toca ----
  const enTelefono = () => window.matchMedia('(max-width: 640px)').matches;
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('[data-cerrar]')) { cerrarModales(); return; }
    if (t.closest('#ev-guardar')) {
      form.validado = true;
      if (validar().length > 0) return;
      cerrarModales();
      aviso('Maqueta: no se guarda');
      return;
    }
    if (t.closest('#ev-borrar')) { cerrarModales(); aviso('Maqueta: no se borra'); return; }
    const tipo = t.closest('#ev-tipos [data-tipo]');
    if (tipo) {
      form.tipo = tipo.dataset.tipo;
      // En un laboral quedan solo las personas de administración
      if (form.tipo === 'laboral') form.personas = new Set([...form.personas].filter((id) => esAdmin(usuario(id))));
      pintarFormulario();
      return;
    }
    const categoria = t.closest('[data-categoria]');
    if (categoria) {
      form.categoria = categoria.dataset.categoria;
      pintarFormulario();
      if (form.categoria === 'otro') porId('ev-otro').focus();
      else enfocar(`[data-categoria="${CSS.escape(form.categoria)}"]`);
      return;
    }
    const persona = t.closest('[data-persona]');
    if (persona) {
      const v = persona.dataset.persona;
      if (v === 'todos') { form.todos = !form.todos; form.personas.clear(); }
      else if (!form.todos) {
        const id = Number(v);
        if (form.personas.has(id)) form.personas.delete(id); else form.personas.add(id);
      }
      pintarFormulario();
      enfocar(`[data-persona="${v}"]`);
      return;
    }
    const ev2 = t.closest('[data-evento]');
    if (ev2) {
      const e = datos().eventos.find((x) => x.id === Number(ev2.dataset.evento));
      if (e.mio) abrirNuevo(e.fecha, D.eventos.find((x) => x.id === e.id)); else abrirAjeno(e);
      return;
    }
    const pestana = t.closest('[data-pestana]');
    if (pestana) {
      ev.preventDefault();
      if (['resumen', 'agenda'].includes(pestana.dataset.pestana)) mostrarPestana(pestana.dataset.pestana);
      else aviso('La maqueta muestra solo el Resumen («Hoy y mañana») y la Agenda.');
      return;
    }
    const agregar = t.closest('[data-agregar]');
    if (agregar) { abrirNuevo(agregar.dataset.agregar); return; }
    const mas = t.closest('[data-ver-mas]');
    if (mas) { estado.abiertos.add(mas.dataset.verMas); pintar(); return; }
    const dia = t.closest('#ag-mes [data-fecha]');
    if (dia) {
      if (enTelefono()) { estado.elegido = dia.dataset.fecha; pintar(); porId('ag-elegido').scrollIntoView({ behavior: reducido() ? 'auto' : 'smooth', block: 'nearest' }); }
      else abrirNuevo(dia.dataset.fecha);
      return;
    }
    if (t.closest('#ag-anterior')) cambiarMes(-1);
    else if (t.closest('#ag-siguiente')) cambiarMes(1);
    else if (t.closest('#ag-hoy')) { estado.mes = D.hoy.slice(0, 7); estado.elegido = D.hoy; pintar(); }
    else if (t.closest('#ag-nuevo-evento') || t.closest('[data-maqueta-accion="Nuevo evento"]')) abrirNuevo(D.hoy);
    else if (t.closest('#ag-finde')) { estado.finde = !estado.finde; guardarFinde(); pintar(); }
    else if (t.closest('[data-maqueta-accion]')) aviso(`En la página real abre «${t.closest('[data-maqueta-accion]').dataset.maquetaAccion}». La maqueta no lo muestra.`);
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'ev-otro') { form.otro = ev.target.value; pintarCuenta(); pintarVistaPrevia(); if (form.validado) validar({ enfocar: false }); }
    else if (ev.target.id === 'ev-desde' || ev.target.id === 'ev-fecha') { pintarVistaPrevia(); pintarAviso(); }
    else if (ev.target.id === 'ev-titulo' && form.validado) validar({ enfocar: false });
  });
  document.addEventListener('change', (ev) => {
    if (ev.target.id === 'ev-recordatorio') pintarAviso();
    if ((ev.target.id === 'ev-desde' || ev.target.id === 'ev-hasta') && form.validado) validar({ enfocar: false });
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') { cerrarModales(); return; }
    // Las pestañas, con las flechas (como en la página real)
    const tab = ev.target.closest?.('.me-pestana');
    if (tab && (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft')) {
      const tabs = [...document.querySelectorAll('.me-pestana')];
      const i = tabs.indexOf(tab) + (ev.key === 'ArrowRight' ? 1 : -1);
      tabs[(i + tabs.length) % tabs.length].focus();
      ev.preventDefault();
    }
  });
  function cambiarMes(n) {
    estado.mes = mesVecino(estado.mes, n);
    estado.elegido = estado.mes === D.hoy.slice(0, 7) ? D.hoy : `${estado.mes}-01`;
    estado.abiertos.clear();
    pintar();
    porId('me-anuncio').textContent = tituloDelMes(estado.mes);
  }

  // ---- La barra de la maqueta ----
  function barra() {
    const botones = (id, opciones, actual, alElegir) => {
      const cont = porId(id);
      cont.innerHTML = opciones.map(([v, t]) => `<button type="button" aria-pressed="${v === actual}" data-v="${v}">${t}</button>`).join('');
      cont.onclick = (ev) => {
        const b = ev.target.closest('button');
        if (!b) return;
        alElegir(b.dataset.v);
        repintar();
        pintar();
        porId(id).querySelector(`[data-v="${b.dataset.v}"]`)?.focus();
      };
    };
    const repintar = () => {
      botones('mq-quien', D.maqueta.quienes, String(estado.quien), (v) => { estado.quien = Number(v); });
      botones('mq-nombres', [['a', 'A (del usuario)'], ['b', 'B (alternativa)']], estado.nombres, (v) => { estado.nombres = v; });
      botones('mq-color', [['violeta', 'Violeta'], ['rosado', 'Rosado'], ['gris', 'Gris']], estado.color, (v) => { estado.color = v; });
      botones('mq-propuestas', [['1', 'Se ven'], ['0', 'Se ocultan']], estado.propuestas ? '1' : '0', (v) => { estado.propuestas = v === '1'; });
    };
    barra.repintar = repintar;
    repintar();
    porId('mq-nuevo').onclick = () => abrirNuevo(D.hoy);
    porId('mq-turno').onclick = () => {
      estado.quien = 6;
      repintar();
      pintar();
      abrirNuevo('2026-11-05', D.eventos.find((e) => e.id === 1));
      volverA = porId('mq-turno');
    };
    porId('mq-telefono').onclick = () => {
      porId('mq-marco-iframe').src = `index.html?marco=1&quien=${estado.quien}&nombres=${estado.nombres}&color=${estado.color}&propuestas=${estado.propuestas ? 1 : 0}&pestana=${estado.pestana}`;
      porId('mq-marco').hidden = false;
      porId('mq-marco-cerrar').focus();
    };
    porId('mq-marco-cerrar').onclick = () => { porId('mq-marco').hidden = true; porId('mq-marco-iframe').src = 'about:blank'; porId('mq-telefono').focus(); };
    porId('mq-achicar').onclick = () => {
      const achicada = porId('mq-barra').classList.toggle('achicada');
      document.documentElement.classList.toggle('mq-achicada', achicada);
      porId('mq-achicar').textContent = achicada ? 'Mostrar la barra' : 'Achicar la barra';
      porId('mq-achicar').setAttribute('aria-expanded', String(!achicada));
    };
  }

  if (EN_EL_MARCO) document.documentElement.classList.add('en-el-marco');
  barra();
  pintar({ animar: true });
})();
