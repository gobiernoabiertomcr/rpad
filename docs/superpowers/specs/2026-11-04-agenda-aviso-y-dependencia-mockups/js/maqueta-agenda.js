// MAQUETA: la API de la Agenda de Mi espacio (noviembre de 2026) y los textos de la propuesta (window.MQ).
(function () {
  const M = window.MAQUETA;
  const D = window.MAQUETA_DATOS;
  const HOY = '2026-11-04';
  const rol = M.leer('mq-rol', 'editor');
  const yo = { ...D.fijos['GET /auth/verify'].json.data.user, rol };
  D.fijos['GET /auth/verify'].json.data.user = yo;
  M.sesion(yo);
  const puedeCompartir = true;
  const variante = 'B';
  const JEFES = rol === 'editor' ? 'Federico y Graciela' : 'Graciela';

  const FRASES = {
    privado: 'Solo vos lo ves. Nadie más, ni en la agenda ni por mail.',
    ninguno: 'Elegí una opción para ver a quién le llega.',
    publico: `Lo ven en su agenda las personas que elijas, solo con el texto corto. A ${JEFES}, de quienes dependés, les llega ese texto por mail antes del evento, salvo que lo cargues para hoy.`.replace('de quienes dependés, les llega', rol === 'editor' ? 'de quienes dependés, les llega' : 'de quien dependés, le llega'),
    publico_corta: 'Lo ven en su agenda las personas que elijas, solo con el texto corto.',
    laboral: 'Lo ven las personas que elijas, con todo el detalle. A esas personas les llega un mail.'
  };
  window.MQ = {
    variante,
    frase: (tipo) => FRASES[tipo],
    iconos: window.MAQUETA.ICONOS,
    jefes: rol === 'editor' ? [1, 3] : [3],
    // La frase, y en «Yo y quienes elija», el mail y la agenda bien separados (window.MAQUETA.piezas, según la opción del panel)
    adornarFrase(nodo, tipo) {
      const legend = document.querySelector('#ev-grupo-personas legend');
      legend.childNodes[0].nodeValue = 'Con quién ';
      nodo.classList.toggle('mq-frase-apagada', !['privado', 'publico', 'laboral'].includes(tipo));
      if (!['privado', 'publico', 'laboral'].includes(tipo) || nodo.hidden) return;
      if (tipo !== 'publico') {
        nodo.innerHTML = `<span class="mq-frase-fila"><span class="mq-frase-ico" data-de="${tipo}" aria-hidden="true">${M.ICONOS[tipo]}</span><span>${Utils.escapeHtml(FRASES[tipo])}</span></span>`;
        return;
      }
      const jefes = rol === 'editor' ? [['FR', 'Federico'], ['GP', 'Graciela']] : [['GP', 'Graciela']];
      const piezas = M.piezas(jefes, M.cuandoDelAviso(document.getElementById('ev-fecha').value, HOY, M.leer('mq-hora', '10:30')));
      nodo.innerHTML = piezas.arriba;
      legend.childNodes[0].nodeValue = `${piezas.rotulo} `;
      document.getElementById('ev-personas-ayuda').innerHTML = piezas.ayuda;
    },
    opciones: variante === 'B' ? Object.freeze({
      privado: Object.freeze({ nombre: 'Solo yo', ayuda: 'Nadie más lo ve' }),
      publico: Object.freeze({ nombre: 'Yo y quienes elija', ayuda: 'Ven un texto corto' }),
      laboral: Object.freeze({ nombre: 'Laboral', ayuda: 'Con quienes elijas' })
    }) : null,
    ultimoGuardado: null
  };

  const corto = (id) => M.PERSONAS.find((p) => p.id === id)?.corto ?? '—';
  const lista = (nombres) => (nombres.length < 2 ? nombres.join('') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`);
  const quien = (e) => {
    if (e.tipo === 'privado') return 'Solo vos';
    if (e.tipo === 'publico') return e.para_todos ? 'Lo ven todos' : `Lo ven ${lista(e.personas.map(corto))}`;
    return e.para_todos ? 'Con toda la administración' : `Con ${lista(e.personas.map(corto))}`;
  };
  const inicial = [
    { id: 101, tipo: 'privado', titulo: 'Turno con la kinesióloga', detalle: 'Llevar la orden.', fecha: '2026-11-05', desde: '09:30', hasta: '10:30', recordatorio: 'ninguno', personas: [], para_todos: false, es_mio: true },
    { id: 102, tipo: 'publico', titulo: 'Trámite en el banco', detalle: '', texto_publico: 'Fuera de la oficina', fecha: '2026-11-11', desde: '08:00', hasta: '10:00', recordatorio: 'ninguno', personas: [4, 5], para_todos: false, es_mio: true },
    { id: 103, tipo: 'laboral', titulo: 'Reunión de portal de datos', detalle: 'Revisar la lista de datasets.', fecha: '2026-11-09', desde: '11:00', hasta: '12:00', recordatorio: 'ninguno', personas: [1], para_todos: false, es_mio: true },
    { id: 201, tipo: 'publico', creador: 'Lucía', texto_publico: 'Licencia', fecha: '2026-11-12', desde: '08:00', hasta: '14:00', es_mio: false }
  ];
  const leerEventos = () => { try { return JSON.parse(M.leer('mq-eventos', 'null')) ?? inicial; } catch { return inicial; } };
  const guardarEventos = (ev) => M.guardar('mq-eventos', JSON.stringify(ev));
  const item = (e) => {
    if (!e.es_mio) return { id: e.id, fecha: e.fecha, desde: e.desde, hasta: e.hasta, es_mio: false, compartido: false, publico: true, creador: e.creador, titulo: `${e.creador}: ${e.texto_publico}`, texto_publico: e.texto_publico };
    const publico = e.tipo === 'publico';
    const compartido = e.tipo === 'laboral';
    const r = { id: e.id, titulo: e.titulo, detalle: e.detalle || null, fecha: e.fecha, desde: e.desde || null, hasta: e.hasta || null, es_mio: true, compartido, para_todos: e.para_todos === true && compartido, publico };
    if (publico) Object.assign(r, { publico_todos: e.para_todos === true, texto_publico: e.texto_publico });
    return { ...r, creador: 'Micaela', personas: e.para_todos ? [] : e.personas.map(corto), personas_ids: e.para_todos ? [] : e.personas, recordatorio: e.recordatorio, recordatorio_texto: '', mi_recordatorio: e.recordatorio, aviso: '', quien_texto: quien(e) };
  };
  const delCuerpo = (c, id) => ({
    id, tipo: c.tipo, titulo: c.titulo, detalle: c.detalle, fecha: c.fecha, desde: c.desde, hasta: c.hasta, recordatorio: c.recordatorio,
    personas: c.personas ?? [], para_todos: c.para_todos === true, texto_publico: c.texto_publico, es_mio: true
  });
  const mensaje = (e, verbo) => {
    if (e.tipo === 'privado') return `Evento ${verbo}. Solo vos lo ves.`;
    if (e.tipo === 'publico') return `Evento ${verbo}. ${quien(e)} en su agenda, y a ${JEFES} les llega antes del evento.`;
    return `Evento ${verbo}. ${quien(e)}.`;
  };

  const original = window.fetch.bind(window);
  window.fetch = async (url, opciones = {}) => {
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return original(url, opciones);
    u.searchParams.delete('_t');
    const ruta = u.pathname.slice(4);
    const metodo = (opciones.method || 'GET').toUpperCase();
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    await M.espera(metodo === 'GET' ? 60 : 200);
    if (metodo === 'GET') {
      const fijo = D.fijos[`GET ${ruta}${u.search}`];
      if (fijo) return M.respuesta(fijo.status, fijo.json);
      if (ruta === '/mi-espacio/eventos') {
        const desde = u.searchParams.get('desde'); const hasta = u.searchParams.get('hasta');
        const eventos = leerEventos().filter((e) => e.fecha >= desde && e.fecha <= hasta).map(item);
        return M.respuesta(200, { success: true, data: { desde, hasta, hoy: HOY, puede_compartir: puedeCompartir, mi_nombre_corto: 'Micaela', eventos, licencias: [], feriados: [], ausentes: [], companeros_por_dia: [], frase_del_mes: null } });
      }
      if (ruta === '/mi-espacio/eventos/aviso') return M.respuesta(200, { success: true, data: { texto: '' } });
      if (ruta.startsWith('/mi-espacio/ausentes')) return M.respuesta(200, { success: true, data: { puede_ver: true, ausentes: [] } });
      if (ruta === '/mi-espacio/personas/publico') return M.respuesta(200, { success: true, data: [...M.PERSONAS.filter((p) => window.MQ.jefes.includes(p.id)), ...M.PERSONAS.filter((p) => p.id !== 2 && !window.MQ.jefes.includes(p.id))].map((p) => ({ id: p.id, nombre: p.nombre_completo })) });
      if (ruta === '/mi-espacio/personas') return M.respuesta(200, { success: true, data: M.PERSONAS.filter((p) => p.id !== 2).map((p) => ({ id: p.id, nombre: p.nombre_completo })) });
      if (ruta.startsWith('/usuarios/licencias/sin-auditor')) return M.respuesta(200, { success: true, data: { periodos: [] } });
      return M.respuesta(200, { success: true, data: null });
    }
    const eventos = leerEventos();
    if (metodo === 'POST' && ruta === '/mi-espacio/eventos') {
      const nuevo = delCuerpo(cuerpo, Math.max(300, ...eventos.map((e) => e.id)) + 1);
      guardarEventos([...eventos, nuevo]);
      window.MQ.ultimoGuardado = nuevo.id;
      return M.respuesta(201, { success: true, data: { id: nuevo.id }, message: mensaje(nuevo, 'guardado') });
    }
    const m = ruta.match(/^\/mi-espacio\/eventos\/(\d+)$/);
    if (m && metodo === 'PUT') {
      const nuevo = delCuerpo(cuerpo, Number(m[1]));
      guardarEventos(eventos.map((e) => (e.id === nuevo.id ? nuevo : e)));
      window.MQ.ultimoGuardado = nuevo.id;
      return M.respuesta(200, { success: true, data: { id: nuevo.id }, message: mensaje(nuevo, 'cambiado') });
    }
    if (m && metodo === 'DELETE') {
      guardarEventos(eventos.filter((e) => e.id !== Number(m[1])));
      return M.respuesta(200, { success: true, message: 'Evento borrado.' });
    }
    return M.respuesta(400, { success: false, error: '(Maqueta) Esto no se guarda en la maqueta.' });
  };
})();
