// MAQUETA (03/11/2026), sin servidor: una sesión de prueba y las respuestas de la API real de Mi espacio, guardadas en
// datos.js (los números del caso con un nombre inventado). Lo nuevo de la propuesta (las horas acumuladas en «Cargar
// licencia») lo responde esta maqueta, con lo que pide propuesta.js (window.MQ). Va antes que config.js. No guarda nada.
(function () {
  const D = window.MAQUETA_DATOS;
  const usuario = D.fijos['GET /auth/verify'].json.data.user;
  const payload = btoa(JSON.stringify({ userId: usuario.id, rol: usuario.rol, exp: 4102444800 })).replace(/=+$/, '');
  localStorage.setItem('rpad_token', `maqueta.${payload}.firma`);
  localStorage.setItem('rpad_user', JSON.stringify(usuario));

  const MES = 6.5;
  const ACUMULADAS = 1.5;
  const coma = (n) => String(n).replace('.', ',');
  const horasTexto = (n) => `${coma(n)} ${n === 1 ? 'hora' : 'horas'}`;
  const copia = (x) => JSON.parse(JSON.stringify(x));
  const espera = (ms) => new Promise((resolver) => { setTimeout(resolver, ms); });
  const respuesta = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'Content-Type': 'application/json' } });

  // Lo que la propuesta cambia en lo que ya manda el servidor: los nombres y lo que dice de las acumuladas
  const conLaPropuesta = (ruta, json) => {
    const r = copia(json);
    if (ruta === '/mi-espacio/resumen' && r?.data) {
      const tipo = (r.data.tipos ?? []).find((t) => t.tipo === 'horas_a_favor');
      if (tipo) tipo.queda_texto = `Quedan ${coma(MES)} h en noviembre · ${coma(ACUMULADAS)} acumuladas`;
      if (r.data.pastillas?.previo) r.data.pastillas.previo = { numero: coma(ACUMULADAS), titulo: 'Horas acumuladas', nota: 'De meses anteriores' };
    }
    if (ruta.startsWith('/mi-espacio/horas-extras') && r?.data?.no_utilizadas) {
      r.data.no_utilizadas.total_texto = horasTexto(ACUMULADAS);
      r.data.no_utilizadas.uso_autorizado.texto = 'Si te autorizan a tomarlas, sumalas en «Cargar licencia», con las horas a favor del mes o solas: se descuentan primero las más viejas.';
    }
    return r;
  };

  // El cálculo de «Horas a favor» con lo que se reparte: las del mes (lo de antes, real) o las del mes y las acumuladas (nuevo)
  const calculoDeHorasAFavor = (cuerpo) => {
    if (!/^2026-11-/.test(cuerpo.desde ?? '')) {
      return { error: { campo: 'desde', mensaje: '(Maqueta) Probá con un día de noviembre.' }, vista: null, paso: null };
    }
    const total = Number(cuerpo.horas);
    const { mes, acumuladas } = window.MQ?.reparto?.(total) ?? { mes: total, acumuladas: 0 };
    if (acumuladas <= 0) return D.calculos[String(total)]?.data ?? D.calculos[String(total)];
    const real = D.calculos[total === 7 ? 'dia_entero' : String(total)];
    const base = real?.data ?? real ?? {};
    const quedan = ACUMULADAS - acumuladas;
    if (mes > MES) return { error: { campo: 'horas', mensaje: `En noviembre de 2026 te quedan ${coma(MES)} horas a favor.` }, vista: base.vista ?? null, paso: null };
    if (acumuladas > ACUMULADAS) return { error: { campo: 'horas', mensaje: `Tenés ${horasTexto(ACUMULADAS)} acumuladas.` }, vista: base.vista ?? null, paso: null };
    const partes = mes > 0 ? `Usás ${horasTexto(mes)} a favor de noviembre y ${coma(acumuladas)} de tus horas acumuladas.`
      : `Usás ${horasTexto(acumuladas)} de tus horas acumuladas.`;
    const vista = {
      dias_habiles: 1,
      texto_dias: total === 7 ? '7 horas, el día entero' : horasTexto(total),
      texto_reparto: '',
      queda_texto: `${partes} ${quedan > 0 ? `Te ${quedan === 1 ? 'queda' : 'quedan'} ${horasTexto(quedan)} ${quedan === 1 ? 'acumulada' : 'acumuladas'}.` : 'No te quedan horas acumuladas.'}`,
      antes_del_arranque: false,
      texto_antes_del_arranque: '',
      avisos: []
    };
    return { error: null, vista, paso: base.paso ?? null };
  };

  const original = window.fetch.bind(window);
  window.fetch = async (url, opciones = {}) => {
    const u = new URL(url, location.href);
    if (!u.pathname.startsWith('/api/')) return original(url, opciones);
    u.searchParams.delete('_t');
    const ruta = u.pathname.slice(4) + u.search;
    const metodo = (opciones.method || 'GET').toUpperCase();
    const cuerpo = opciones.body ? JSON.parse(opciones.body) : null;
    await espera(metodo === 'GET' ? 100 : 220);

    if (metodo === 'GET') {
      const guardada = D.fijos[`GET ${ruta}`];
      if (guardada) return respuesta(guardada.status, conLaPropuesta(u.pathname.slice(4), guardada.json));
      if (ruta.startsWith('/mi-espacio/eventos')) {
        return respuesta(200, { success: true, data: { desde: '', hasta: '', hoy: '2026-11-03', puede_compartir: true, mi_nombre_corto: 'Micaela', eventos: [], licencias: [], feriados: [], ausentes: [], companeros_por_dia: [], frase_del_mes: null } });
      }
      if (ruta.startsWith('/mi-espacio/ausentes')) return respuesta(200, { success: true, data: { puede_ver: true, ausentes: [] } });
      if (ruta.startsWith('/mi-espacio/personas')) return respuesta(200, { success: true, data: [] });
      if (ruta.startsWith('/usuarios/licencias/sin-auditor')) return respuesta(200, { success: true, data: { periodos: [] } });
      console.warn('MAQUETA: sin respuesta guardada para', metodo, ruta);
      return respuesta(200, { success: true, data: null });
    }
    if (ruta === '/mi-espacio/licencias/calculo') {
      if (cuerpo.tipo === 'horas_a_favor') return respuesta(200, { success: true, data: calculoDeHorasAFavor(cuerpo) });
      return respuesta(200, { success: true, data: { error: { campo: 'tipo', mensaje: '(Maqueta) Esta maqueta es de «Horas a favor».' }, vista: null, paso: null } });
    }
    if (metodo === 'POST' && ruta === '/mi-espacio/licencias') {
      window.MQ?.avisar?.('En la maqueta no se guarda nada.');
      return respuesta(400, { success: false, error: '(Maqueta) No se guarda nada: es para ver cómo se elige.' });
    }
    return respuesta(400, { success: false, error: '(Maqueta) Esto no se guarda en la maqueta.' });
  };
})();
