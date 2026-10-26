// MAQUETA de Proyectos (25/10/2026). Dibuja las tres propuestas de la lista (A tabla, B tarjetas, C carriles), las dos del
// detalle (1 filas, 2 cinta), la línea de tiempo y los logros con los datos de maqueta-datos.js. No guarda nada.
(() => {
  const D = window.DATOS;
  const P = new URLSearchParams(window.location.search);
  const LISTA = ['tabla', 'tarjetas', 'carriles'].includes(P.get('lista')) ? P.get('lista') : 'carriles';
  const DETALLE = P.get('detalle') === 'cinta' ? 'cinta' : 'filas';
  const HOY = Utils.hoyEnArgentina();
  const esAdmin = () => Auth.isAdmin();

  const esc = (s) => Utils.escapeHtml(s ?? '');
  const fecha = (t) => (t ? `${t.slice(8, 10)}/${t.slice(5, 7)}/${t.slice(0, 4)}` : '—');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const tamano = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
  const extension = (n) => (n.split('.').pop() || '').toUpperCase().slice(0, 4);
  const colorDe = (p) => (/^#[0-9a-fA-F]{6}$/.test(p?.color || '') ? p.color : '#1A365D');
  const icono = (nombre, tam = 20) => getIconSvg(nombre, tam).replace('<svg', '<svg aria-hidden="true"');

  const ESTADOS = { en_curso: ['En curso', 'pr-en-curso'], idea: ['Idea', 'pr-idea'], completado: ['Completado', 'pr-completado'], suspendido: ['Suspendido', 'pr-suspendido'] };
  const ESTADOS_PLURAL = { en_curso: 'En curso', idea: 'Ideas', completado: 'Completados', suspendido: 'Suspendidos' };
  const ORDEN_ESTADOS = ['en_curso', 'idea', 'completado', 'suspendido'];
  const CATEGORIAS = { tecnologia: 'Tecnología', normativa: 'Normativa', difusion: 'Difusión' };
  const PRIORIDADES = { alta: 'Alta', media: 'Media', baja: 'Baja' };
  const insignia = (estado) => `<span class="pr-insignia ${ESTADOS[estado]?.[1] || ''}">${esc(ESTADOS[estado]?.[0] || estado)}</span>`;
  const tile = (p, clase = '') => `<span class="pr-tile ${clase}" style="--c:${colorDe(p)}">${clase.includes('chico') ? '' : icono(p.icono)}</span>`;
  const ICONO_ABRIR = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="abrir"><path d="m6 9 6 6 6-6"/></svg>';
  const ICONO_MAS = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
  const ICONO_SUBIR = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>';
  const ICONO_EXTERNO = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';
  const ICONO_BUSCAR = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

  const hitosDe = (id) => D.hitos.filter((h) => h.proyecto_id === id);
  const logros = () => D.hitos.filter((h) => h.proyecto_id === null);
  const proyectoDe = (id) => D.proyectos.find((p) => p.id === id);
  const conParametros = (cambios, hash = '') => {
    const p = new URLSearchParams(window.location.search);
    Object.entries(cambios).forEach(([k, v]) => (v === null ? p.delete(k) : p.set(k, v)));
    return `?${p.toString()}${hash}`;
  };
  const textoDelEnlace = (url) => {
    if (!url) return null;
    if (url.includes('github.com')) return 'Abrir en GitHub';
    if (url.includes('docs.google.com') || url.includes('drive.google.com')) return 'Abrir el borrador';
    return 'Abrir el enlace';
  };
  const ultimoHecho = (id) => hitosDe(id).find((h) => h.fecha <= HOY);

  // ---------- Filtros de la lista (comunes a las tres propuestas) ----------
  const filtro = { texto: '', estado: 'todos', categoria: 'todas', anio: 'todos' };
  const pasaFiltro = (p, sin = '') => {
    if (sin !== 'texto' && filtro.texto && !sinTildes(`${p.nombre} ${p.descripcion} ${p.responsable}`).includes(sinTildes(filtro.texto))) return false;
    if (sin !== 'estado' && filtro.estado !== 'todos' && p.estado !== filtro.estado) return false;
    if (sin !== 'categoria' && filtro.categoria !== 'todas' && p.categoria !== filtro.categoria) return false;
    return true;
  };
  const chip = (grupo, valor, texto, cantidad) =>
    `<button type="button" class="sg-chip" data-grupo="${grupo}" data-valor="${valor}" aria-pressed="${filtro[grupo] === valor}">${esc(texto)}${cantidad === null ? '' : ` <b>${cantidad}</b>`}</button>`;
  const htmlDeFiltros = () => {
    const porEstado = (e) => D.proyectos.filter((p) => pasaFiltro(p, 'estado') && (e === 'todos' || p.estado === e)).length;
    const porCat = (c) => D.proyectos.filter((p) => pasaFiltro(p, 'categoria') && (c === 'todas' || p.categoria === c)).length;
    const estados = ORDEN_ESTADOS.filter((e) => D.proyectos.some((p) => p.estado === e) || filtro.estado === e);
    const cats = Object.keys(CATEGORIAS).filter((c) => D.proyectos.some((p) => p.categoria === c) || filtro.categoria === c);
    return `
      <div class="pr-filtros">
        <div class="pr-campo">${ICONO_BUSCAR}<input type="search" id="pr-buscar" placeholder="Buscá un proyecto" aria-label="Buscar un proyecto por nombre, descripción o autor" value="${esc(filtro.texto)}" autocomplete="off"></div>
        <div class="sg-chips" role="group" aria-label="Estado">${chip('estado', 'todos', 'Todos', porEstado('todos'))}${estados.map((e) => chip('estado', e, ESTADOS_PLURAL[e], porEstado(e))).join('')}</div>
      </div>
      <div class="pr-filtros">
        <div class="pr-grupo-filtro" role="group" aria-label="Categoría"><span class="pr-filtro-rotulo" aria-hidden="true">Categoría</span>${chip('categoria', 'todas', 'Todas', porCat('todas'))}${cats.map((c) => chip('categoria', c, CATEGORIAS[c], porCat(c))).join('')}</div>
        ${LISTA === 'carriles' ? htmlDeAnios() : ''}
      </div>`;
  };
  // La ventana de los carriles: siempre 5 años; por defecto, los que terminan en el año de hoy
  // Dos variantes: 5 años con un selector (?ventana=5) o 3 años con flechas que corren la ventana de a un año (?ventana=3)
  const CON_FLECHAS = P.get('ventana') === '3';
  const ANIOS_VENTANA = CON_FLECHAS ? 3 : 5;
  const extremos = () => {
    const anios = D.hitos.map((h) => Number(h.fecha.slice(0, 4))).concat(D.proyectos.filter((p) => p.fecha_inicio).map((p) => Number(p.fecha_inicio.slice(0, 4))));
    return { min: Math.min(...anios), max: Math.max(Number(HOY.slice(0, 4)), ...anios) };
  };
  const ventanasPosibles = () => {
    const { min, max } = extremos();
    const finales = []; for (let f = max; f >= Math.max(min + ANIOS_VENTANA - 1, max - 30); f -= 1) finales.push(f);
    return finales.length ? finales : [max];
  };
  filtro.ventana = Number(HOY.slice(0, 4));
  const htmlDeAnios = () => {
    const finales = ventanasPosibles();
    const primero = filtro.ventana - ANIOS_VENTANA + 1;
    const FLECHA_IZQ = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>';
    const FLECHA_DER = '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';
    const flechas = finales.length > 1 ? `<div class="pr-flechas" role="group" aria-label="Años que se ven">
        <button type="button" class="pr-flecha" data-correr="-1" ${filtro.ventana <= Math.min(...finales) ? 'disabled' : ''} aria-label="Ver ${primero - 1} a ${filtro.ventana - 1}">${FLECHA_IZQ}</button>
        <span class="pr-flechas-texto" aria-live="polite">${primero} a ${filtro.ventana}</span>
        <button type="button" class="pr-flecha" data-correr="1" ${filtro.ventana >= Math.max(...finales) ? 'disabled' : ''} aria-label="Ver ${primero + 1} a ${filtro.ventana + 1}">${FLECHA_DER}</button></div>` : '';
    const selector = CON_FLECHAS ? flechas : finales.length > 1 ? `<div class="pr-grupo-filtro"><label class="pr-filtro-rotulo" for="pr-ventana">Años</label><select class="pr-select" id="pr-ventana">${finales.map((f) => `<option value="${f}" ${f === filtro.ventana ? 'selected' : ''}>${f - ANIOS_VENTANA + 1} a ${f}</option>`).join('')}</select></div>` : '';
    const anios = []; for (let a = filtro.ventana; a > filtro.ventana - ANIOS_VENTANA; a -= 1) anios.push(String(a));
    return `${selector}<div class="pr-grupo-filtro" role="group" aria-label="Resaltar un año"><span class="pr-filtro-rotulo" aria-hidden="true">Resaltar un año</span>${chip('anio', 'todos', 'Ninguno', null)}${anios.map((a) => chip('anio', a, a, D.hitos.filter((h) => h.fecha.startsWith(a)).length)).join('')}</div>`;
  };

  const ordenados = () => D.proyectos.filter((p) => pasaFiltro(p)).sort((a, b) =>
    ORDEN_ESTADOS.indexOf(a.estado) - ORDEN_ESTADOS.indexOf(b.estado)
    || (ultimoHecho(b.id)?.fecha || '').localeCompare(ultimoHecho(a.id)?.fecha || '')
    || a.nombre.localeCompare(b.nombre));
  const vacioDeLista = () => `<p class="pr-vacio-caja">Ningún proyecto coincide con lo que buscaste. <button type="button" class="sg-link" data-limpiar>Ver todos los proyectos</button></p>`;
  const textoDeHitos = (p) => {
    const hs = hitosDe(p.id);
    const u = ultimoHecho(p.id);
    if (!hs.length) return 'Sin hitos todavía';
    return `${plural(hs.length, 'hito', 'hitos')}${u ? `; el último, el ${fecha(u.fecha)}` : ''}`;
  };

  // A. Tabla
  const htmlDeTabla = (lista) => !lista.length ? vacioDeLista() : `
    <div class="pr-tarjeta"><div class="pr-tabla-marco"><table class="pr-tabla">
      <thead><tr><th scope="col">Proyecto</th><th scope="col">Estado</th><th scope="col">Categoría</th><th scope="col">Prioridad</th><th scope="col">Hitos</th><th scope="col">Documentos</th></tr></thead>
      <tbody>${lista.map((p) => {
        const hs = hitosDe(p.id); const u = ultimoHecho(p.id);
        return `<tr>
          <td><div class="t">${tile(p)}<div><a href="${conParametros({ id: p.id })}">${esc(p.nombre)}</a><small>${esc(p.responsable || '')}</small></div></div></td>
          <td>${insignia(p.estado)}</td>
          <td>${esc(CATEGORIAS[p.categoria] || '—')}</td>
          <td>${esc(PRIORIDADES[p.prioridad] || '—')}</td>
          <td class="num">${hs.length ? `<b>${hs.length}</b><small>${u ? `el último, ${fecha(u.fecha)}` : 'ninguno cumplido'}</small>` : '<span style="color:var(--sg-suave)">—</span>'}</td>
          <td class="num">${p.documentos.length || '<span style="color:var(--sg-suave)">—</span>'}</td>
        </tr>`; }).join('')}</tbody>
    </table></div></div>`;

  // B. Tarjetas por estado
  const htmlDeTarjetas = (lista) => !lista.length ? vacioDeLista() : ORDEN_ESTADOS.map((e) => {
    const del = lista.filter((p) => p.estado === e);
    if (!del.length) return '';
    return `<section class="pr-seccion" aria-labelledby="sec-${e}"><h2 id="sec-${e}">${insignia(e).replace(ESTADOS[e][0], ESTADOS_PLURAL[e])}<small>${plural(del.length, 'proyecto', 'proyectos')}</small></h2>
      <div class="pr-grilla">${del.map((p) => `
        <a class="pr-ficha-p" href="${conParametros({ id: p.id })}" style="--c:${colorDe(p)}">
          <div class="cab">${tile(p)}<div><h3>${esc(p.nombre)}</h3><div class="meta">${esc(CATEGORIAS[p.categoria] || '')}. Prioridad ${esc((PRIORIDADES[p.prioridad] || '').toLowerCase())}</div></div></div>
          <p>${esc(p.descripcion)}</p>
          <div class="pie"><span>${esc(textoDeHitos(p))}</span><span>${p.documentos.length ? `<b>${p.documentos.length}</b> doc.` : ''}</span></div>
        </a>`).join('')}</div></section>`;
  }).join('');

  // C. Carriles
  const rango = () => ({ desde: filtro.ventana - ANIOS_VENTANA + 1, hasta: filtro.ventana });
  const diasDesde = (desde, t) => (Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) - Date.UTC(desde, 0, 1)) / 86400000;
  const pct = (r, t) => (diasDesde(r.desde, t) / diasDesde(r.desde, `${r.hasta + 1}-01-01`)) * 100;
  const pistaDe = (r, hs, p) => {
    const anios = []; for (let a = r.desde; a <= r.hasta; a += 1) anios.push(a);
    const resalta = filtro.anio !== 'todos' ? `<span class="resalta" style="left:${pct(r, `${filtro.anio}-01-01`)}%;width:${pct(r, `${+filtro.anio + 1}-01-01`) - pct(r, `${filtro.anio}-01-01`)}%"></span>` : '';
    const lineas = anios.map((a) => `<span class="anio" style="left:${pct(r, `${a}-01-01`)}%"></span>`).join('');
    const inicio = `${r.desde}-01-01`; const fin = `${r.hasta}-12-31`;
    const antes = hs.filter((h) => h.fecha < inicio).length;
    const despues = hs.filter((h) => h.fecha > fin).length;
    const fechas = hs.map((h) => h.fecha).sort();
    const desdeT = fechas[0] < inicio ? inicio : fechas[0]; const hastaT = fechas[fechas.length - 1] > fin ? fin : fechas[fechas.length - 1];
    const tramo = p && fechas.length > 1 && desdeT < hastaT ? `<span class="tramo" style="left:${pct(r, desdeT)}%;width:${pct(r, hastaT) - pct(r, desdeT)}%"></span>` : '';
    const fuera = `${antes ? `<span class="fuera izq" title="${plural(antes, 'hito', 'hitos')} antes de ${r.desde}">${antes} antes</span>` : ''}${despues ? `<span class="fuera der" title="${plural(despues, 'hito', 'hitos')} después de ${r.hasta}">${despues} después</span>` : ''}`;
    const puntos = hs.filter((h) => h.fecha >= inicio && h.fecha <= fin).map((h) => {
      const apagado = filtro.anio !== 'todos' && !h.fecha.startsWith(filtro.anio);
      const clase = [p ? '' : 'logro', h.fecha > HOY ? 'futuro' : '', apagado ? 'apagado' : ''].join(' ');
      return `<span class="punto ${clase}" style="left:${pct(r, h.fecha)}%" title="${esc(`${fecha(h.fecha)}: ${h.titulo}`)}"></span>`;
    }).join('');
    const sin = !hs.length ? '<span class="sin">Sin hitos todavía</span>' : '';
    return `<span class="pr-pista" aria-hidden="true" style="--c:${p ? colorDe(p) : '#1A365D'}">${resalta}${lineas}${HOY >= inicio && HOY <= fin ? `<span class="linea-hoy" style="left:${pct(r, HOY)}%"></span>` : ''}${tramo}${puntos}${sin}${fuera}</span>`;
  };
  const htmlDeCarriles = (lista) => {
    const r = rango();
    const anios = []; for (let a = r.desde; a <= r.hasta; a += 1) anios.push(a);
    const resumen = filtro.anio !== 'todos' ? (() => {
      const del = D.hitos.filter((h) => h.fecha.startsWith(filtro.anio));
      const deP = del.filter((h) => h.proyecto_id !== null);
      const nP = new Set(deP.map((h) => h.proyecto_id)).size;
      const nL = del.length - deP.length;
      return `<p class="pr-resumen-anio" role="status">En ${filtro.anio}: ${plural(deP.length, 'hito', 'hitos')} de ${plural(nP, 'proyecto', 'proyectos')}${nL ? ` y ${plural(nL, 'logro del área', 'logros del área')}` : ''}. Son los que salen en el Informe anual de ${filtro.anio}.</p>`;
    })() : '';
    if (!lista.length) return resumen + vacioDeLista();
    const filas = lista.map((p) => {
      const hs = hitosDe(p.id);
      const fechas = hs.map((h) => h.fecha).sort();
      const resumenHitos = hs.length ? `${plural(hs.length, 'hito', 'hitos')}, ${fechas.length > 1 ? `del ${fecha(fechas[0])} al ${fecha(fechas[fechas.length - 1])}` : `el ${fecha(fechas[0])}`}` : 'sin hitos todavía';
      return `<a class="pr-carril" href="${conParametros({ id: p.id })}" role="listitem">
        <span class="pr-carril-nombre">${tile(p)}<span><b>${esc(p.nombre)}</b><small>${insignia(p.estado)}<span>${esc(CATEGORIAS[p.categoria] || '')}</span></small></span></span>
        ${pistaDe(r, hs, p)}<span class="visualmente-oculto">: ${esc(resumenHitos)}</span>
      </a>`;
    }).join('');
    const ls = logros();
    const filaLogros = `<a class="pr-carril logros" href="#logros" data-ir-a="logros" role="listitem">
        <span class="pr-carril-nombre"><span class="pr-tile logro">${icono('award')}</span><span><b>Logros del área</b><small><span>Hitos que no son de un proyecto</span></small></span></span>
        ${pistaDe(r, ls, null)}<span class="visualmente-oculto">: ${plural(ls.length, 'logro', 'logros')}</span></a>`;
    return `${resumen}<div class="pr-tarjeta"><div class="pr-carriles">
      <div class="pr-eje" aria-hidden="true"><span></span><span class="pr-eje-anios">${anios.map((a) => `<span style="left:${(pct(r, `${a}-01-01`) + pct(r, `${a + 1}-01-01`)) / 2}%">${a}</span>`).join('')}</span></div>
      <div role="list" aria-label="Proyectos">${filas}${filaLogros}</div>
    </div>
    <div class="pr-leyenda" aria-hidden="true"><span><i class="pr-mk"></i>Hito cumplido (con el color del proyecto)</span><span><i class="pr-mk futuro"></i>Hito previsto</span><span><i class="pr-mk logro"></i>Logro del área</span><span><i class="pr-mk hoy"></i>Hoy</span><span><b style="border:1px solid var(--sg-borde-control);border-radius:999px;padding:0 7px;font-size:.74rem;color:var(--sg-texto)">1 antes</b>Hitos fuera de los años elegidos</span>${filtro.anio !== 'todos' ? `<span><i class="pr-mk resalta"></i>${filtro.anio}</span>` : ''}</div></div>`;
  };

  const dibujarLista = () => {
    const panel = document.getElementById('panel-proyectos');
    const lista = ordenados();
    const cuerpo = LISTA === 'tabla' ? htmlDeTabla(lista) : LISTA === 'tarjetas' ? htmlDeTarjetas(lista) : htmlDeCarriles(lista);
    const foco = document.activeElement;
    const buscando = foco?.id === 'pr-buscar';
    const pos = buscando ? foco.selectionStart : null;
    const chipFoco = foco?.dataset?.grupo ? `[data-grupo="${foco.dataset.grupo}"][data-valor="${foco.dataset.valor}"]` : null;
    panel.innerHTML = htmlDeFiltros() + cuerpo;
    if (buscando) { const i = document.getElementById('pr-buscar'); i.focus(); i.setSelectionRange(pos, pos); }
    if (chipFoco) panel.querySelector(chipFoco)?.focus();
  };

  // ---------- Hitos como filas que se despliegan ----------
  const htmlDeArchivos = (archivos) => !archivos.length ? '' : `<ul class="pr-archivos">${archivos.map((a) => `
    <li class="pr-archivo"><span class="pr-ext" aria-hidden="true">${esc(extension(a.nombre_archivo))}</span>
      <span><span class="n">${esc(a.nombre_archivo)}</span><small>${tamano(a.tamano)}. Subido el ${fecha(a.created_at)}</small></span>
      <span class="acc"><button type="button" class="sg-link" data-maqueta="Abre la vista previa">Ver</button><button type="button" class="sg-link" data-maqueta="Descarga el archivo">Descargar</button>${esAdmin() ? '<button type="button" class="sg-link rojo" data-maqueta="Pide confirmación y borra el archivo">Eliminar</button>' : ''}</span></li>`).join('')}</ul>`;
  const htmlDeHitoFila = (h, { conProyecto = false, compacta = false } = {}) => {
    const p = h.proyecto_id ? proyectoDe(h.proyecto_id) : null;
    const futuro = h.fecha > HOY;
    const marca = conProyecto ? (p ? tile(p, 'chico marca') : '<span class="pr-tile chico logro marca"></span>') : `<i class="pr-mk-hito marca ${futuro ? 'futuro' : ''}" aria-hidden="true"></i>`;
    const sub = conProyecto ? (p ? p.nombre : 'Logro del área') : (h.descripcion || '');
    const evid = [h.evidencia_url ? 'Enlace' : '', h.archivos.length ? plural(h.archivos.length, 'archivo', 'archivos') : ''].filter(Boolean).join(' y ');
    const idc = `hito-${h.id}-${conProyecto ? 'l' : 'd'}`;
    return `<li class="pr-mov">
      <button type="button" class="pr-fila" aria-expanded="false" aria-controls="${idc}">
        <span class="f">${fecha(h.fecha)}</span>${marca}
        <span><span class="q">${esc(h.titulo)}</span>${futuro ? '<span class="pr-futuro-etq">Previsto</span>' : ''}<span class="d">${esc(sub)}</span></span>
        ${compacta ? '' : `<span class="p">${esc(evid)}</span>`}${ICONO_ABRIR}
      </button>
      <div class="pr-cuerpo" id="${idc}" hidden>
        ${conProyecto && p ? `<p><a class="sg-link" href="${conParametros({ id: p.id }, '')}">${esc(p.nombre)}</a></p>` : ''}
        ${h.descripcion ? `<p>${esc(h.descripcion)}</p>` : ''}
        ${h.evidencia_url && Utils.esUrlSegura(h.evidencia_url) ? `<p><a class="sg-link" href="${esc(h.evidencia_url)}" target="_blank" rel="noopener">Ver la evidencia</a> <small style="color:var(--sg-suave)">(${esc(new URL(h.evidencia_url).host)})</small></p>` : ''}
        ${htmlDeArchivos(h.archivos)}
        ${esAdmin() ? `<div class="acciones"><button type="button" class="sg-link" data-editar-hito="${h.id}">Editar el ${p ? 'hito' : 'logro'}</button>${p ? `<button type="button" class="sg-link" data-maqueta="Abre el selector de archivos">Subir archivos</button>` : ''}<button type="button" class="sg-link rojo" data-maqueta="Pide confirmación y borra el hito con sus archivos">Eliminar</button></div>` : ''}
        ${h.inventado ? '<p style="margin:10px 0 0;font-size:.8rem;color:var(--sg-ambar)">Dato inventado para la maqueta.</p>' : ''}
      </div></li>`;
  };

  // ---------- Detalle ----------
  const htmlDeFicha = (p) => {
    const hs = hitosDe(p.id);
    const enlace = p.enlace_externo && Utils.esUrlSegura(p.enlace_externo) ? p.enlace_externo : null;
    return `<a class="pr-volver" href="${conParametros({ id: null })}">Ver todos los proyectos</a>
    <div class="pr-tarjeta"><div class="pr-ficha">
      <div><div class="pr-ficha-titulo">${tile(p, 'grande')}<div><h2 class="pr-titulo">${esc(p.nombre)}</h2>
        <div class="etiquetas">${insignia(p.estado)}<span class="pr-etq">${esc(CATEGORIAS[p.categoria] || '')}</span></div></div></div>
        ${p.descripcion ? `<p class="desc">${esc(p.descripcion)}</p>` : ''}</div>
      <div class="pr-acciones">
        ${enlace ? `<a class="sg-btn sg-btn-borde" href="${esc(enlace)}" target="_blank" rel="noopener">${ICONO_EXTERNO}${esc(textoDelEnlace(enlace))}</a>` : ''}
        ${esAdmin() ? `<button type="button" class="sg-btn sg-btn-borde" data-editar-proyecto="${p.id}">Editar el proyecto</button><button type="button" class="sg-btn sg-btn-rojo-borde" data-maqueta="Pide confirmación: el proyecto se da de baja con sus hitos y documentos">Eliminar</button>` : ''}
      </div>
      <dl class="pr-datos">
        <div class="pr-dato"><dt>Prioridad</dt><dd>${esc(PRIORIDADES[p.prioridad] || '—')}</dd></div>
        <div class="pr-dato"><dt>Fecha de elevación</dt><dd>${fecha(p.fecha_inicio)}</dd></div>
        <div class="pr-dato"><dt>Autor o responsable</dt><dd>${esc(p.responsable || '—')}</dd></div>
        <div class="pr-dato"><dt>Áreas</dt><dd>${esc(p.areas.map((a) => a.nombre).join(', ') || '—')}</dd></div>
        <div class="pr-dato"><dt>Hitos</dt><dd>${hs.length}</dd></div>
        <div class="pr-dato"><dt>Documentos</dt><dd>${p.documentos.length}</dd></div>
      </dl>
    </div></div>`;
  };
  const htmlDeHitosDelProyecto = (p, compacta) => {
    const hs = hitosDe(p.id);
    return `<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Hitos</h3>${esAdmin() ? `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-nuevo-hito="${p.id}">${ICONO_MAS}Nuevo hito</button>` : `<span>${plural(hs.length, 'hito', 'hitos')}</span>`}</div>
      ${hs.length ? `<ul class="pr-movs ${compacta ? 'pr-compacta' : ''}">${hs.map((h) => htmlDeHitoFila(h, { compacta })).join('')}</ul>` : `<div class="pr-vacio-caja"><p>Este proyecto todavía no tiene hitos. Un hito es un paso cumplido o previsto: una elevación, un lanzamiento, una presentación.</p>${esAdmin() ? `<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-nuevo-hito="${p.id}">${ICONO_MAS}Cargar el primer hito</button>` : ''}</div>`}</div>`;
  };
  const htmlDeDocumentos = (p) => `<div class="pr-tarjeta"><div class="pr-cabeza"><h3 class="pr-h">Documentos</h3>${esAdmin() ? `<button type="button" class="sg-btn sg-btn-borde sg-btn-chico" data-maqueta="Abre el selector de archivos (hasta 10 documentos por proyecto)">${ICONO_SUBIR}Subir documentos</button>` : `<span>${plural(p.documentos.length, 'documento', 'documentos')}</span>`}</div>
    ${p.documentos.length ? htmlDeArchivos(p.documentos) : '<p class="pr-vacio">Este proyecto no tiene documentos.</p>'}
    ${esAdmin() ? '<p class="pr-vacio" style="margin-top:10px;font-size:.82rem">Hasta 10 documentos de 10 MB cada uno.</p>' : ''}</div>`;

  // Detalle 2: la cinta del recorrido (SVG, como la del Seguimiento)
  const svgDeCinta = (p) => {
    const hs = hitosDe(p.id).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    const eventos = hs.map((h) => ({ fecha: h.fecha, texto: h.titulo, tipo: h.fecha > HOY ? 'futuro' : 'hecho' }));
    if (p.fecha_inicio) eventos.push({ fecha: p.fecha_inicio, texto: 'Elevación', tipo: 'elev' });
    if (!eventos.length) return '<p class="pr-vacio">Sin hitos ni fecha de elevación: la cinta se dibuja cuando haya alguno.</p>';
    eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const primero = eventos[0].fecha; const ultimo = eventos[eventos.length - 1].fecha;
    let desde = Number(primero.slice(0, 4)); const hasta = Math.max(Number(HOY.slice(0, 4)), Number(ultimo.slice(0, 4)));
    if (hasta - desde < 1) desde = hasta - 1;
    const total = diasDesde(desde, `${hasta + 1}-01-01`);
    const X0 = 30; const X1 = 970; const Y = 126;
    const x = (t) => X0 + (diasDesde(desde, t) / total) * (X1 - X0);
    const anios = []; for (let a = desde; a <= hasta; a += 1) anios.push(a);
    const meses = hasta - desde <= 2;
    let marcas = '';
    anios.forEach((a) => {
      marcas += `<line class="eje" x1="${x(`${a}-01-01`)}" x2="${x(`${a}-01-01`)}" y1="${Y - 14}" y2="${Y + 14}"/>`;
      marcas += `<text class="anio" x="${(x(`${a}-01-01`) + x(`${a + 1}-01-01`)) / 2}" y="${Y + 34}">${a}</text>`;
      if (meses) for (let m = 2; m <= 12; m += 1) marcas += `<line class="eje" x1="${x(`${a}-${String(m).padStart(2, '0')}-01`)}" x2="${x(`${a}-${String(m).padStart(2, '0')}-01`)}" y1="${Y - 6}" y2="${Y + 6}"/>`;
    });
    const vida = `<rect class="vida" x="${x(primero)}" y="${Y - 7}" width="${Math.max(4, x(HOY < ultimo ? HOY : ultimo) - x(primero))}" height="14" rx="3"/>${ultimo > HOY ? `<rect class="porvenir" x="${x(HOY)}" y="${Y - 7}" width="${x(ultimo) - x(HOY)}" height="14" rx="3"/>` : ''}`;
    // Etiquetas en tres filas, sin pisarse (6,3 unidades por letra a 11,5 px)
    const filas = [[], [], []]; const FILAS_Y = [94, 61, 28];
    let etqs = '';
    eventos.forEach((ev) => {
      const corto = ev.texto.length > 34 ? `${ev.texto.slice(0, 33)}…` : ev.texto;
      const ancho = Math.max(corto.length, 10) * 6.3;
      const cx = x(ev.fecha);
      let izq = cx - 4; if (izq + ancho > X1 + 20) izq = cx - ancho + 4;
      const fila = filas.findIndex((f) => f.every(([a, b]) => izq > b + 10 || izq + ancho < a - 10));
      if (fila === -1) return;
      filas[fila].push([izq, izq + ancho]);
      const ty = FILAS_Y[fila];
      etqs += `<line class="guia" x1="${cx}" x2="${cx}" y1="${ty + 11}" y2="${Y - 9}"/><text class="etq" x="${izq}" y="${ty - 6}">${esc(corto)}</text><text class="etq-f" x="${izq}" y="${ty + 7}">${fecha(ev.fecha)}</text>`;
    });
    const puntos = eventos.map((ev) => {
      const cx = x(ev.fecha);
      if (ev.tipo === 'elev') return `<circle class="h-elev" cx="${cx}" cy="${Y}" r="6.5"><title>${fecha(ev.fecha)}: Elevación</title></circle>`;
      return `<rect class="${ev.tipo === 'futuro' ? 'h-futuro' : 'h-hecho'}" x="${cx - 7}" y="${Y - 7}" width="14" height="14" rx="2" transform="rotate(45 ${cx} ${Y})"><title>${esc(`${fecha(ev.fecha)}: ${ev.texto}`)}</title></rect>`;
    }).join('');
    const hoy = `<line class="l-hoy" x1="${x(HOY)}" x2="${x(HOY)}" y1="${Y - 22}" y2="${Y + 16}"/><text class="hoy" x="${x(HOY)}" y="${Y + 52}">Hoy</text>`;
    return `<div class="pr-cinta-marco"><svg class="pr-cinta" viewBox="0 0 1000 186" role="img" aria-label="${esc(`Recorrido de ${p.nombre}: ${plural(hs.length, 'hito', 'hitos')}`)}">${marcas}${vida}${hoy}${etqs}${puntos}</svg></div>
      <div class="pr-leyenda" aria-hidden="true"><span><i class="pr-mk-hito"></i>Hito cumplido</span><span><i class="pr-mk-hito futuro"></i>Hito previsto</span><span><i class="pr-mk futuro" style="border-color:var(--sg-tinta)"></i>Elevación</span><span><i class="pr-mk hoy"></i>Hoy</span></div>`;
  };

  const dibujarDetalle = (id) => {
    const p = proyectoDe(id);
    const caja = document.getElementById('pr-vista-detalle');
    document.getElementById('pr-vista-lista').hidden = true;
    document.getElementById('pr-bajada').hidden = true;
    caja.hidden = false;
    if (!p) { caja.innerHTML = `<div class="pr-tarjeta"><h2>Proyecto no encontrado</h2><p class="pr-vacio">No hay ningún proyecto con ese número. <a class="sg-link" href="${conParametros({ id: null })}">Ver todos los proyectos</a></p></div>`; return; }
    document.title = `${p.nombre} - Proyectos - RPAD`;
    if (DETALLE === 'filas') {
      caja.innerHTML = htmlDeFicha(p) + `<div style="margin-top:16px">${htmlDeHitosDelProyecto(p, false)}</div><div style="margin-top:16px">${htmlDeDocumentos(p)}</div>`;
    } else {
      caja.innerHTML = htmlDeFicha(p) + `<div class="pr-tarjeta" style="margin-top:16px"><div class="pr-cabeza"><h3 class="pr-h">Recorrido</h3><span>${plural(hitosDe(p.id).length, 'hito', 'hitos')}</span></div>${svgDeCinta(p)}</div>
        <div class="pr-dos">${htmlDeHitosDelProyecto(p, true)}${htmlDeDocumentos(p)}</div>`;
    }
  };

  // ---------- Línea de tiempo y logros ----------
  const filtroLinea = { de: 'todos' };
  const dibujarLinea = () => {
    const panel = document.getElementById('panel-linea');
    const todos = D.hitos;
    const cuenta = (de) => todos.filter((h) => de === 'todos' || (de === 'proyectos' ? h.proyecto_id !== null : h.proyecto_id === null)).length;
    const lista = todos.filter((h) => filtroLinea.de === 'todos' || (filtroLinea.de === 'proyectos' ? h.proyecto_id !== null : h.proyecto_id === null));
    const anios = [...new Set(lista.map((h) => h.fecha.slice(0, 4)))].sort().reverse();
    const ch = (v, t) => `<button type="button" class="sg-chip" data-linea="${v}" aria-pressed="${filtroLinea.de === v}">${t} <b>${cuenta(v)}</b></button>`;
    panel.innerHTML = `<div class="pr-filtros"><div class="sg-chips" role="group" aria-label="Qué hitos">${ch('todos', 'Todos')}${ch('proyectos', 'De los proyectos')}${ch('logros', 'Logros del área')}</div></div>
      <div class="pr-tarjeta">${anios.map((a) => {
        const del = lista.filter((h) => h.fecha.startsWith(a));
        return `<div class="pr-anio"><h3>${a}</h3><small>${plural(del.length, 'hito', 'hitos')}${a === HOY.slice(0, 4) ? ', hasta hoy y lo previsto' : ''}</small></div><ul class="pr-movs">${del.map((h) => htmlDeHitoFila(h, { conProyecto: true })).join('')}</ul>`;
      }).join('') || '<p class="pr-vacio">No hay hitos con este filtro.</p>'}</div>`;
  };
  const dibujarLogros = () => {
    const panel = document.getElementById('panel-logros');
    const ls = logros();
    panel.innerHTML = `<div class="pr-tarjeta"><div class="pr-cabeza"><div><h3 class="pr-h">Logros del área</h3><p class="pr-vacio" style="margin-top:4px;font-size:.9rem;max-width:70ch">Los logros que no son parte de un proyecto: un premio, una presentación, un convenio. Salen en el Informe anual, al final de los logros del año.</p></div>${esAdmin() ? `<button type="button" class="sg-btn sg-btn-tinta sg-btn-chico" data-nuevo-logro>${ICONO_MAS}Registrar un logro</button>` : ''}</div>
      ${ls.length ? `<ul class="pr-movs">${ls.map((h) => htmlDeHitoFila(h)).join('')}</ul>` : '<div class="pr-vacio-caja"><p>Todavía no hay logros del área.</p></div>'}</div>`;
  };

  // ---------- Pestañas ----------
  const PESTANAS = ['proyectos', 'linea', 'logros'];
  const elegirPestana = (clave, conFoco = false) => {
    PESTANAS.forEach((k) => {
      const t = document.getElementById(`tab-${k}`); const activa = k === clave;
      t.classList.toggle('activa', activa); t.setAttribute('aria-selected', String(activa)); t.tabIndex = activa ? 0 : -1;
      document.getElementById(`panel-${k}`).hidden = !activa;
      if (activa && conFoco) t.focus();
    });
    if (window.location.hash !== `#${clave}`) history.replaceState(null, '', `${window.location.search}#${clave}`);
  };

  // ---------- Modales ----------
  const PALETA = [['#1A365D', 'Azul tinta'], ['#0950C6', 'Azul oscuro'], ['#3B82F6', 'Azul'], ['#2B7AB8', 'Celeste'], ['#0E7490', 'Petróleo'], ['#2E6B4C', 'Verde'], ['#F45000', 'Naranja'], ['#CC0066', 'Magenta'], ['#6D4BA8', 'Violeta'], ['#56677F', 'Gris']];
  const ICONOS = Object.keys(ICON_SELECTOR_MAP);
  let abridor = null;
  const abrirModal = (id) => {
    abridor = document.activeElement;
    const m = document.getElementById(id);
    m.classList.add('active');
    setTimeout(() => m.querySelector('input:not([type=radio]), textarea, select')?.focus(), 80);
  };
  const cerrarModal = (m) => { m.classList.remove('active'); abridor?.focus?.(); };
  const muestra = () => {
    const color = document.querySelector('input[name="p-color"]:checked')?.value || '#1A365D';
    const ic = document.querySelector('input[name="p-icono"]:checked')?.value || 'folder';
    document.getElementById('p-muestra-tile').style.setProperty('--c', color);
    document.getElementById('p-muestra-tile').innerHTML = icono(ic, 26);
    document.getElementById('p-muestra-nombre').textContent = document.getElementById('p-nombre').value || 'Así se ve en la lista';
  };
  const prepararModalProyecto = (p = null) => {
    document.getElementById('modal-proyecto-titulo').textContent = p ? `Editar ${p.nombre}` : 'Nuevo proyecto';
    document.getElementById('p-nombre').value = p?.nombre || '';
    document.getElementById('p-desc').value = p?.descripcion || '';
    document.querySelectorAll('input[name="p-estado"]').forEach((r) => { r.checked = r.value === (p?.estado || 'idea'); });
    document.getElementById('p-cat').value = p?.categoria || 'tecnologia';
    document.getElementById('p-prio').value = p?.prioridad || 'media';
    document.getElementById('p-fecha').value = p?.fecha_inicio || '';
    document.getElementById('p-resp').value = p?.responsable || '';
    document.getElementById('p-enlace').value = p?.enlace_externo || '';
    const elegidas = new Set((p?.areas || []).map((a) => a.id));
    document.getElementById('p-areas').innerHTML = D.areas.map((a) => `<label class="pr-area"><input type="checkbox" value="${a.id}" ${elegidas.has(a.id) ? 'checked' : ''}>${esc(a.nombre)}</label>`).join('');
    const actual = p ? colorDe(p) : '#1A365D';
    const paleta = PALETA.some(([c]) => c.toLowerCase() === actual.toLowerCase()) ? PALETA : [[actual, 'Color actual'], ...PALETA];
    document.getElementById('p-colores').innerHTML = paleta.map(([c, n]) => `<label class="pr-color" style="--c:${c}" title="${n}"><input type="radio" name="p-color" value="${c}" aria-label="${n}" ${c.toLowerCase() === actual.toLowerCase() ? 'checked' : ''}></label>`).join('');
    document.getElementById('p-iconos').innerHTML = ICONOS.map((k) => `<label class="pr-icono" title="${k}"><input type="radio" name="p-icono" value="${k}" aria-label="${k}" ${k === (p?.icono || 'folder') ? 'checked' : ''}>${icono(k, 20)}</label>`).join('');
    muestra();
    abrirModal('modal-proyecto');
  };
  const prepararModalHito = ({ proyecto = null, hito = null, logro = false } = {}) => {
    const p = proyecto || (hito?.proyecto_id ? proyectoDe(hito.proyecto_id) : null);
    const esLogro = logro || (hito && hito.proyecto_id === null);
    document.getElementById('modal-hito-titulo').textContent = hito ? (esLogro ? 'Editar el logro' : 'Editar el hito') : (esLogro ? 'Registrar un logro del área' : 'Nuevo hito');
    document.getElementById('h-de').textContent = esLogro ? 'Un logro que no es parte de un proyecto. Sale en el Informe anual del año de su fecha.' : `Del proyecto ${p?.nombre || ''}. Sale en el Informe anual del año de su fecha.`;
    document.getElementById('h-titulo').value = hito?.titulo || '';
    document.getElementById('h-fecha').value = hito?.fecha || HOY;
    document.getElementById('h-desc').value = hito?.descripcion || '';
    document.getElementById('h-url').value = hito?.evidencia_url || '';
    document.getElementById('h-guardar').textContent = esLogro ? 'Guardar el logro' : 'Guardar el hito';
    abrirModal('modal-hito');
  };

  // ---------- Arranque ----------
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('cnt-proyectos').textContent = D.proyectos.length;
    document.getElementById('cnt-linea').textContent = D.hitos.length;
    document.getElementById('cnt-logros').textContent = logros().length;
    document.getElementById('pr-nuevo').hidden = !esAdmin();
    const id = Number(P.get('id'));
    if (id) dibujarDetalle(id);
    else {
      dibujarLista(); dibujarLinea(); dibujarLogros();
      const h = window.location.hash.slice(1);
      elegirPestana(PESTANAS.includes(h) ? h : 'proyectos');
    }

    const main = document.querySelector('.pr-pagina');
    main.addEventListener('input', (e) => { if (e.target.id === 'pr-buscar') { filtro.texto = e.target.value; dibujarLista(); } });
    main.addEventListener('change', (e) => {
      if (e.target.id !== 'pr-ventana') return;
      filtro.ventana = Number(e.target.value);
      if (filtro.anio !== 'todos' && (Number(filtro.anio) > filtro.ventana || Number(filtro.anio) <= filtro.ventana - ANIOS_VENTANA)) filtro.anio = 'todos';
      dibujarLista();
      document.getElementById('pr-ventana').focus();
    });
    main.addEventListener('click', (e) => {
      const t = e.target.closest('button, a');
      if (!t) return;
      if (t.dataset.grupo) { filtro[t.dataset.grupo] = t.dataset.valor; dibujarLista(); return; }
      if (t.dataset.correr) {
        filtro.ventana += Number(t.dataset.correr);
        if (filtro.anio !== 'todos' && (Number(filtro.anio) > filtro.ventana || Number(filtro.anio) <= filtro.ventana - ANIOS_VENTANA)) filtro.anio = 'todos';
        dibujarLista();
        const otra = document.querySelector(`[data-correr="${t.dataset.correr}"]`);
        (otra && !otra.disabled ? otra : document.querySelector('[data-correr]:not([disabled])'))?.focus();
        return;
      }
      if (t.dataset.linea) { filtroLinea.de = t.dataset.linea; dibujarLinea(); return; }
      if (t.hasAttribute('data-limpiar')) { Object.assign(filtro, { texto: '', estado: 'todos', categoria: 'todas', anio: 'todos' }); dibujarLista(); return; }
      if (t.dataset.irA) { e.preventDefault(); elegirPestana(t.dataset.irA, true); return; }
      if (t.classList.contains('pr-pestana')) { elegirPestana(t.dataset.hash); return; }
      if (t.classList.contains('pr-fila')) {
        const abierta = t.getAttribute('aria-expanded') === 'true';
        t.setAttribute('aria-expanded', String(!abierta));
        document.getElementById(t.getAttribute('aria-controls')).hidden = abierta;
        return;
      }
      if (t.dataset.editarProyecto) { prepararModalProyecto(proyectoDe(Number(t.dataset.editarProyecto))); return; }
      if (t.dataset.nuevoHito) { prepararModalHito({ proyecto: proyectoDe(Number(t.dataset.nuevoHito)) }); return; }
      if (t.hasAttribute('data-nuevo-logro')) { prepararModalHito({ logro: true }); return; }
      if (t.dataset.editarHito) { prepararModalHito({ hito: D.hitos.find((h) => h.id === Number(t.dataset.editarHito)) }); return; }
      if (t.id === 'pr-nuevo') { prepararModalProyecto(); return; }
      if (t.dataset.maqueta) showToast(`En la página real: ${t.dataset.maqueta.charAt(0).toLowerCase()}${t.dataset.maqueta.slice(1)}.`, 'info');
    });
    main.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('pr-pestana')) return;
      const i = PESTANAS.indexOf(e.target.dataset.hash);
      const j = { ArrowRight: (i + 1) % 3, ArrowLeft: (i + 2) % 3, Home: 0, End: 2 }[e.key];
      if (j === undefined) return;
      e.preventDefault(); elegirPestana(PESTANAS[j], true);
    });
    document.querySelectorAll('.modal-overlay').forEach((m) => {
      let desdeVelo = false;
      m.addEventListener('mousedown', (e) => { desdeVelo = e.target === m; });
      m.addEventListener('click', (e) => { if ((e.target === m && desdeVelo) || e.target.closest('[data-cerrar]')) cerrarModal(m); });
      m.addEventListener('submit', (e) => { e.preventDefault(); cerrarModal(m); showToast('En la maqueta no se guarda nada.', 'info'); });
      m.addEventListener('input', () => { if (m.id === 'modal-proyecto') muestra(); });
      m.addEventListener('change', () => { if (m.id === 'modal-proyecto') muestra(); });
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.active').forEach(cerrarModal); });
    // Para las capturas: ?modal=proyecto|hito abre el formulario
    if (P.get('modal') === 'proyecto') prepararModalProyecto(proyectoDe(Number(P.get('editar'))) || null);
    if (P.get('modal') === 'hito') prepararModalHito({ proyecto: proyectoDe(Number(P.get('editar'))) || D.proyectos[0] });
  });
})();
