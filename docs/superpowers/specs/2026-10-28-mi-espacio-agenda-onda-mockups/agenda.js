/*
 * MAQUETA de la agenda con más onda (28/10/2026). Dibuja con los datos de datos.js lo que en la página real va a mandar el servidor
 * (los días hábiles, el primer nombre de los compañeros, los textos). No guarda nada.
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
  const diaCorto = (f) => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
  const diaLargo = (f) => `${DIAS_LARGOS[lugar(f)]} ${diaCorto(f)}`;
  const diaConMes = (f) => `${DIAS_LARGOS[lugar(f)]} ${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
  const tituloDelMes = (m) => `${cap(MESES[Number(m.slice(5, 7)) - 1])} ${m.slice(0, 4)}`;
  const mesVecino = (m, n) => {
    const i = Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7)) - 1 + n;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;
  };
  const listaConY = (l) => (l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} y ${l.at(-1)}`);

  // ---- Íconos (Lucide, embebidos) ----
  const svg = (cuerpo, tam = 13) => `<svg aria-hidden="true" class="ag-icono" xmlns="http://www.w3.org/2000/svg" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${cuerpo}</svg>`;
  const ICONOS = {
    feriado: svg('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>'),
    licencia: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
    ausente: svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    compartido: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    propio: ''
  };
  const MAS = svg('<path d="M5 12h14"/><path d="M12 5v14"/>', 14);

  // ---- Quién mira y qué ve ----
  const estado = {
    quien: Number(params.get('quien')) || 1,
    repetidos: params.get('repetidos') === '1',
    franja: params.get('franja') || 'fuerte',
    finde: leerFinde(),
    mes: D.hoy.slice(0, 7),
    elegido: D.hoy,
    animado: false,
    abiertos: new Set()
  };
  function leerFinde() {
    try { return localStorage.getItem('rpad-agenda-finde') === '1'; } catch { return false; }
  }
  function guardarFinde() {
    try { localStorage.setItem('rpad-agenda-finde', estado.finde ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }
  const esAdmin = (u) => ['superadmin', 'admin', 'editor'].includes(u.rol);
  const usuarios = () => (estado.repetidos ? [...D.usuarios, D.repetida] : D.usuarios);

  // El primer nombre; «Carla B.» si otra persona de administración activa tiene el mismo primer nombre
  function nombresCortos() {
    const primero = (u) => u.nombre.split(/\s+/)[0];
    const admin = usuarios().filter(esAdmin);
    const m = new Map();
    for (const u of usuarios()) {
      const partes = u.nombre.split(/\s+/);
      const repetido = admin.filter((o) => o.id !== u.id && primero(o) === primero(u)).length > 0;
      m.set(u.id, repetido ? `${partes[0]} ${partes.at(-1).charAt(0)}.` : partes[0]);
    }
    return m;
  }

  function datos() {
    const yo = usuarios().find((u) => u.id === estado.quien);
    const soyAdmin = esAdmin(yo);
    const corto = nombresCortos();
    const eventos = D.eventos
      .filter((e) => e.creador === yo.id || (e.con === 'todos' && soyAdmin) || (Array.isArray(e.con) && e.con.includes(yo.id)))
      .map((e) => {
        const mio = e.creador === yo.id;
        let quien = 'Solo vos';
        if (!mio) quien = `De ${corto.get(e.creador)}`;
        else if (e.con === 'todos') quien = 'Con todos';
        else if (Array.isArray(e.con)) quien = e.con.length === 1 ? `Con ${corto.get(e.con[0])}` : `Con ${e.con.length} personas`;
        return { ...e, mio, clase: mio && !e.con ? 'propio' : 'compartido', quien };
      })
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.desde.localeCompare(b.desde));
    const licencias = D.licencias.filter((l) => l.usuario === yo.id).map((l) => ({ ...l, dias: diasHabiles(l.desde, l.hasta) }));
    // Los compañeros que no están, por día (solo administración los ve, y solo se ven ellos; sin las de horas)
    const ausentes = new Map();
    const hastaDe = new Map();
    const iniciales = new Map(usuarios().map((u) => [corto.get(u.id), u.nombre.split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('')]));
    if (soyAdmin) {
      for (const l of D.licencias) {
        const u = usuarios().find((x) => x.id === l.usuario);
        if (!u || u.id === yo.id || l.horas || !esAdmin(u)) continue;
        for (const f of diasHabiles(l.desde, l.hasta)) {
          if (!ausentes.has(f)) ausentes.set(f, []);
          ausentes.get(f).push(corto.get(u.id));
          hastaDe.set(`${f} ${corto.get(u.id)}`, l.hasta);
        }
      }
      for (const lista of ausentes.values()) lista.sort((a, b) => a.localeCompare(b, 'es'));
    }
    return { yo, soyAdmin, corto, eventos, licencias, ausentes, hastaDe, iniciales };
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
    const cosas = (feriadosDe.get(f) ?? []).map((n) => ({ clase: 'feriado', texto: `Feriado: ${n}` }));
    for (const e of dt.eventos.filter((x) => x.fecha === f)) cosas.push({ clase: e.clase, hora: e.desde, texto: e.titulo, evento: e.id });
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
    const titulo = `${cosa.hora ? `${cosa.hora} ` : ''}${cosa.texto}`;
    const cuerpo = `${ICONOS[cosa.clase]}${hora}${esc(cosa.texto)}`;
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
    let orden = 0;
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
      const barra = (clase, fila, t, texto, titulo, sigueAntes, sigueDespues, caras = '') => {
        orden += 1;
        return `<div class="ag-barra ${clase}${sigueAntes ? ' sigue-antes' : ''}${sigueDespues ? ' sigue-despues' : ''}" style="grid-column:${t.desde + 1} / ${t.hasta + 2};grid-row:${fila};--demora:${(s * 0.16 + t.desde * 0.05).toFixed(2)}s" title="${esc(titulo)}">`
          + `${ICONOS[clase]}${caras}<span>${esc(texto)}</span></div>`;
      };
      const barrasLic = tramosLic.map((t) => {
        const l = dt.licencias[t.clave];
        const desde = dias[t.desde];
        const hasta = dias[t.hasta];
        const rango = l.desde === l.hasta ? `el ${diaLargo(l.desde)}` : `del ${diaLargo(l.desde)} al ${diaLargo(l.hasta)}`;
        return barra('licencia', filaLic, t, l.tipo, `${l.tipo}, ${rango}`, desde > l.dias[0] && t.desde === 0, hasta < l.dias.at(-1) && t.hasta === dias.length - 1);
      }).join('');
      const barrasAus = tramosAus.map((t) => {
        const nombres = t.clave.split('|');
        const anterior = dias[t.desde];
        const sigueAntes = t.desde === 0 && dt.ausentes.get(diaHabilAntes(anterior))?.join('|') === t.clave;
        const sigueDespues = t.hasta === dias.length - 1 && dt.ausentes.get(diaHabilDespues(dias[t.hasta]))?.join('|') === t.clave;
        const titulo = nombres.map((n) => `${n} no está hasta el ${diaLargo(dt.hastaDe.get(`${dias[t.hasta]} ${n}`) ?? dias[t.hasta])}`).join('. ');
        const caras = `<span class="ag-caras" aria-hidden="true">${nombres.map((n) => `<i>${esc(dt.iniciales.get(n) ?? '')}</i>`).join('')}</span>`;
        return barra('ausente', filaAus, t, textoAusentes(nombres), titulo, sigueAntes, sigueDespues, caras);
      }).join('');
      return `<div class="ag-semana carriles-${carriles}" role="row" style="--carriles:${carriles}">${celdas}${barrasLic}${barrasAus}</div>`;
    }).join('');
    return `<div class="ag-grilla" role="grid" aria-labelledby="ag-mes-titulo" style="--columnas:${columnas}"><div class="ag-cabezas" role="row">${cabeza}</div>${filas}</div>`;
  }
  const diaHabilAntes = (f) => { let d = sumar(f, -1); while (!esHabil(d)) d = sumar(d, -1); return d; };
  const diaHabilDespues = (f) => { let d = sumar(f, 1); while (!esHabil(d)) d = sumar(d, 1); return d; };

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
      const desde = l.desde < `${mes}-01` ? `${mes}-01` : l.desde;
      const ultimo = deUtc(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
      const hasta = l.hasta > ultimo ? ultimo : l.hasta;
      const nombre = l.tipo.split(',')[0].toLowerCase();
      const tu = nombre.endsWith('s') ? 'tus' : 'tu';
      partes.push(desde === hasta ? `${tu} ${nombre} el ${Number(desde.slice(8, 10))}` : `${tu} ${nombre} del ${Number(desde.slice(8, 10))} al ${Number(hasta.slice(8, 10))}`);
    }
    const nombre = MESES[Number(mes.slice(5, 7)) - 1];
    if (partes.length === 0) return `Nada cargado en ${nombre}. Tocá un día para agendar algo.`;
    return `${cap(listaConY(partes))}.`;
  }

  // Lo que queda escondido el fin de semana: los eventos y los feriados de los sábados y domingos del mes
  function cuentaDelFinde(dt) {
    const delMes = (f) => f.slice(0, 7) === estado.mes && esFinde(f);
    return dt.eventos.filter((e) => delMes(e.fecha)).length + D.feriados.filter((f) => delMes(f.fecha)).length;
  }

  // ---- Próximos ----
  function htmlDeProximos(dt) {
    const hasta = sumar(D.hoy, 30);
    const manana = sumar(D.hoy, 1);
    const domingo = sumar(D.hoy, 6 - lugar(D.hoy));
    const cosas = [];
    for (const f of D.feriados) if (f.fecha >= D.hoy && f.fecha <= hasta) cosas.push({ fecha: f.fecha, clase: 'feriado', texto: `Feriado: ${f.nombre}`, detalle: '' });
    for (const l of dt.licencias) {
      if (l.hasta < D.hoy || l.desde > hasta) continue;
      cosas.push({ fecha: l.desde > D.hoy ? l.desde : D.hoy, clase: 'licencia', texto: l.tipo, detalle: l.desde === l.hasta ? '' : `Hasta el ${diaLargo(l.hasta)}` });
    }
    if (dt.soyAdmin) {
      for (const l of D.licencias) {
        const u = usuarios().find((x) => x.id === l.usuario);
        if (!u || u.id === dt.yo.id || l.horas || !esAdmin(u) || l.hasta < D.hoy || l.desde > hasta) continue;
        cosas.push({ fecha: l.desde > D.hoy ? l.desde : D.hoy, clase: 'ausente', texto: `${dt.corto.get(u.id)} no está`, detalle: l.desde === l.hasta ? '' : `Hasta el ${diaLargo(l.hasta)}` });
      }
    }
    for (const e of dt.eventos) {
      if (e.fecha < D.hoy || e.fecha > hasta) continue;
      cosas.push({ fecha: e.fecha, clase: e.clase, hora: e.desde, texto: e.titulo, detalle: 'Aviso 2 h antes', quien: e.quien, evento: e.id });
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
      const marca = `<span class="ag-prox-marca ${c.clase}" aria-hidden="true">${ICONOS[c.clase] || '<i></i>'}</span>`;
      const titulo = c.evento != null
        ? `<button type="button" class="me-prox-titulo" data-evento="${c.evento}">${marca}${esc(texto)}</button>`
        : `<span class="me-prox-titulo">${marca}${esc(texto)}</span>`;
      const quien = c.quien ? `<span class="me-insignia ${c.clase === 'propio' ? 'azul' : 'violeta'}">${esc(c.quien)}</span>` : '';
      const detalle = quien || c.detalle ? `<span class="me-prox-detalle">${quien}${esc(c.detalle)}</span>` : '';
      return `<li class="me-prox ag-prox ${c.clase}"><span class="me-prox-hora">${esc(hora)}</span>${titulo}${detalle}</li>`;
    }).join('')}</ul>`).join('');
  }

  // ---- El día elegido (en el teléfono) ----
  function htmlDelElegido(dt) {
    const f = estado.elegido;
    const items = [];
    for (const n of feriadosDe.get(f) ?? []) items.push({ clase: 'feriado', hora: 'Todo el día', texto: `Feriado: ${n}` });
    for (const l of dt.licencias.filter((x) => x.dias.includes(f))) items.push({ clase: 'licencia', hora: 'Todo el día', texto: l.tipo });
    if (dt.ausentes.has(f)) items.push({ clase: 'ausente', hora: 'Todo el día', texto: textoAusentes(dt.ausentes.get(f)) });
    for (const e of dt.eventos.filter((x) => x.fecha === f)) items.push({ clase: e.clase, hora: e.desde, texto: e.titulo, quien: e.quien, evento: e.id });
    const lista = items.length === 0
      ? '<p class="me-vacio">No hay nada este día.</p>'
      : `<ul class="ag-elegido-lista">${items.map((c) => {
        const cuerpo = `<span class="ag-elegido-hora">${esc(c.hora)}</span><span class="ag-elegido-texto">${esc(c.texto)}${c.quien ? `<small>${esc(c.quien)}</small>` : ''}</span>`;
        const icono = `<span class="ag-fila-icono" aria-hidden="true">${ICONOS[c.clase] || '<i></i>'}</span>`;
        return `<li class="ag-ev-fila ${c.clase}">${c.evento != null ? `<button type="button" data-evento="${c.evento}">${icono}${cuerpo}</button>` : `<div>${icono}${cuerpo}</div>`}</li>`;
      }).join('')}</ul>`;
    return `<div class="ag-elegido-cabeza"><h3 id="ag-elegido-titulo">${esc(cap(diaConMes(f)))}${f === D.hoy ? ' (hoy)' : ''}</h3>`
      + `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-agregar="${f}">${MAS}Nuevo evento</button></div>${lista}`;
  }

  const htmlDeLaLeyenda = (dt) => [
    ['propio', 'Solo vos'], ['compartido', 'Compartidos'], ['licencia', 'Tus licencias y francos'], ['feriado', 'Feriados'],
    ...(dt.soyAdmin ? [['ausente', 'Compañeros que no están']] : [])
  ].map(([clase, texto]) => `<li><span class="ag-muestra ${clase}" aria-hidden="true">${ICONOS[clase]}</span>${texto}</li>`).join('');

  // ---- Dibujar ----
  const porId = (id) => document.getElementById(id);
  const reducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  function pintar({ animar = false } = {}) {
    const dt = datos();
    porId('ag-mes-titulo').textContent = tituloDelMes(estado.mes);
    porId('ag-frase').textContent = fraseDelMes(dt);
    const cuenta = cuentaDelFinde(dt);
    const boton = porId('ag-finde');
    boton.setAttribute('aria-pressed', String(estado.finde));
    const cuentaEl = porId('ag-finde-cuenta');
    cuentaEl.hidden = estado.finde || cuenta === 0;
    cuentaEl.textContent = String(cuenta);
    boton.setAttribute('aria-label', `Sábado y domingo${!estado.finde && cuenta > 0 ? `: ${cuenta} ${cuenta === 1 ? 'cosa escondida' : 'cosas escondidas'}` : ''}`);
    const vista = porId('vista-agenda');
    vista.classList.remove('franja-rayada', 'franja-caras', 'franja-fuerte', 'franja-antes');
    vista.classList.add(`franja-${estado.franja}`);
    const mes = porId('ag-mes');
    if (animar && !reducido()) mes.setAttribute('data-animar', '');
    mes.innerHTML = htmlDelMes(dt);
    if (animar && !reducido()) requestAnimationFrame(() => requestAnimationFrame(() => mes.removeAttribute('data-animar')));
    porId('ag-leyenda').innerHTML = htmlDeLaLeyenda(dt);
    porId('ag-proximos').innerHTML = htmlDeProximos(dt);
    porId('ag-elegido').innerHTML = htmlDelElegido(dt);
    porId('header-nombre').textContent = dt.yo.nombre;
    porId('header-rol').textContent = dt.yo.rolTexto;
    porId('header-iniciales').textContent = dt.yo.nombre.split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('');
    document.querySelectorAll('#sidebarAdmin, #sidebarNotas').forEach((el) => { el.hidden = !esAdmin(dt.yo); });
  }

  // ---- Modales (los reales del evento; la maqueta no guarda nada) ----
  const RECORDATORIOS = [['1h', '1 hora antes'], ['2h', '2 horas antes'], ['dia_anterior', 'El día hábil anterior'], ['ninguno', 'Sin aviso']];
  let volverA = null;
  function abrirModal(id, foco) {
    volverA = document.activeElement;
    porId(id).classList.add('active');
    setTimeout(() => porId(foco)?.focus(), 100);
  }
  function cerrarModales() {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
    volverA?.focus?.();
  }
  function abrirNuevo(fecha, evento) {
    const dt = datos();
    porId('modal-evento-titulo').textContent = evento ? 'Editar evento' : 'Nuevo evento';
    porId('ev-titulo').value = evento?.titulo ?? '';
    porId('ev-fecha').value = evento?.fecha ?? fecha;
    porId('ev-desde').value = evento?.desde ?? '';
    porId('ev-hasta').value = evento?.hasta ?? '';
    porId('ev-detalle').value = '';
    porId('ev-recordatorio').innerHTML = RECORDATORIOS.map(([v, t]) => `<option value="${v}"${v === '2h' ? ' selected' : ''}>${t}</option>`).join('');
    porId('ev-grupo-quien').hidden = !dt.soyAdmin;
    const compartido = Boolean(evento?.con);
    porId('ev-solo').setAttribute('aria-pressed', String(!compartido));
    porId('ev-compartido').setAttribute('aria-pressed', String(compartido));
    porId('ev-grupo-personas').hidden = !compartido;
    const elegidos = evento?.con === 'todos' ? 'todos' : (evento?.con ?? []);
    porId('ev-personas').innerHTML = `<button type="button" class="me-persona" aria-pressed="${elegidos === 'todos'}"><i aria-hidden="true">${ICONOS.compartido}</i>Todos</button>`
      + usuarios().filter((u) => esAdmin(u) && u.id !== dt.yo.id).map((u) => `<button type="button" class="me-persona" aria-pressed="${Array.isArray(elegidos) && elegidos.includes(u.id)}"${elegidos === 'todos' ? ' disabled' : ''}><i aria-hidden="true">${u.nombre.split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).map((p) => p[0]).join('')}</i>${esc(u.nombre)}</button>`).join('');
    porId('ev-aviso').hidden = false;
    porId('ev-aviso').textContent = porId('ev-desde').value ? 'Sale 2 horas antes.' : 'Elegí la hora y te digo cuándo sale.';
    porId('ev-borrar').hidden = !evento;
    abrirModal('modal-evento', 'ev-titulo');
  }
  function abrirAjeno(e) {
    const dt = datos();
    porId('modal-evento-ajeno-titulo').textContent = e.titulo;
    porId('mea-cuando').textContent = `${cap(diaLargo(e.fecha))}/${e.fecha.slice(0, 4)} ${e.hasta ? `de ${e.desde} a ${e.hasta}` : `a las ${e.desde}`}`;
    const creador = usuarios().find((u) => u.id === e.creador);
    porId('mea-quien').innerHTML = `<span class="me-insignia violeta">Compartido</span><span>Lo creó ${esc(creador.nombre)}. ${e.con === 'todos' ? 'Es para todos.' : `Están: vos${e.con.filter((i) => i !== dt.yo.id).map((i) => `, ${esc(dt.corto.get(i))}`).join('')}.`}</span>`;
    porId('mea-recordatorio').innerHTML = `<option value="evento">2 horas antes (el que eligió ${esc(dt.corto.get(e.creador))})</option><option value="ninguno">Sin aviso</option>`;
    abrirModal('modal-evento-ajeno', 'mea-recordatorio');
  }
  const aviso = (texto) => {
    const el = porId('mq-aviso');
    el.textContent = texto;
    el.classList.add('visible');
    clearTimeout(aviso.t);
    aviso.t = setTimeout(() => el.classList.remove('visible'), 2600);
  };

  // ---- Lo que se toca ----
  const enTelefono = () => window.matchMedia('(max-width: 640px)').matches;
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('[data-cerrar]')) { cerrarModales(); return; }
    if (t.closest('#ev-guardar')) { cerrarModales(); aviso('La maqueta no guarda nada: en la página real se guarda el evento.'); return; }
    if (t.closest('#ev-borrar')) { cerrarModales(); aviso('La maqueta no borra nada.'); return; }
    const ev2 = t.closest('[data-evento]');
    if (ev2) {
      const e = datos().eventos.find((x) => x.id === Number(ev2.dataset.evento));
      if (e.mio) abrirNuevo(e.fecha, e); else abrirAjeno(e);
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
    else if (t.closest('[data-maqueta-accion]')) aviso(`En la página real abre «${t.closest('[data-maqueta-accion]').dataset.maquetaAccion}». La maqueta muestra solo la Agenda.`);
    else if (t.closest('.me-pestana:not(#tab-agenda)')) aviso('La maqueta muestra solo la Agenda.');
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrarModales(); });
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
      cont.onclick = (ev) => { const b = ev.target.closest('button'); if (b) alElegir(b.dataset.v); };
    };
    const repintar = () => {
      botones('mq-quien', D.maqueta.quienes, String(estado.quien), (v) => { estado.quien = Number(v); repintar(); pintar(); });
      botones('mq-repetidos', [['0', 'No'], ['1', D.maqueta.repetida]], estado.repetidos ? '1' : '0', (v) => { estado.repetidos = v === '1'; repintar(); pintar(); });
      botones('mq-franja', [['fuerte', 'Pizarra (la elegida)'], ['rayada', 'Rayada'], ['caras', 'Con iniciales'], ['antes', 'Como estaba']], estado.franja, (v) => { estado.franja = v; repintar(); pintar(); });
    };
    repintar();
    porId('mq-repetir').onclick = () => pintar({ animar: true });
    porId('mq-telefono').onclick = () => {
      porId('mq-marco-iframe').src = `index.html?marco=1&quien=${estado.quien}&repetidos=${estado.repetidos ? 1 : 0}&franja=${estado.franja}`;
      porId('mq-marco').hidden = false;
    };
    porId('mq-marco-cerrar').onclick = () => { porId('mq-marco').hidden = true; porId('mq-marco-iframe').src = 'about:blank'; };
  }

  if (EN_EL_MARCO) document.documentElement.classList.add('en-el-marco');
  barra();
  pintar({ animar: true });
})();
