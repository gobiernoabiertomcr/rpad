// Prototipo (descartable) de la cinta y de los movimientos del Seguimiento, calculados con las fechas reales.
// Fechas como texto 'AAAA-MM-DD'. Lo usan cinta-pruebas.html y pdf.html.
(function () {
  var DIA = 86400000;
  function num(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DIA; }
  function dmy(s) { return s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4); }
  function dm(s) { return s.slice(8, 10) + '/' + s.slice(5, 7); }
  var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var FALTABAN = { 'externo-60': 60, 'externo-40': 40, 'externo-5': 5, 'interno-60': 60, 'interno-30': 30 };
  var NOMBRE_EMAIL = { 'externo-60': 'redacción de notas', 'externo-40': 'distribución de notas', 'externo-5': 'vencimiento inminente', 'externo-vencido': 'resumen mensual de sin respuesta', 'interno-60': 'planificación (60 días)', 'interno-30': 'vence en 1 mes', 'interno-vencido': 'resumen mensual de atrasados' };

  function ventanaDe(hoy) {
    var y = +hoy.slice(0, 4), m = +hoy.slice(5, 7);
    var yi = y, mi = m - 11; if (mi <= 0) { mi += 12; yi -= 1; }
    var yf = y, mf = m + 1; if (mf > 12) { mf = 1; yf += 1; }
    var meses = [];
    for (var k = 0; k < 12; k++) {
      var mm = mi + k, yy = yi; if (mm > 12) { mm -= 12; yy += 1; }
      meses.push({ anio: yy, mes: mm, desde: yy + '-' + String(mm).padStart(2, '0') + '-01' });
    }
    return { ini: num(yi + '-' + String(mi).padStart(2, '0') + '-01'), fin: num(yf + '-' + String(mf).padStart(2, '0') + '-01'), meses: meses };
  }

  // Marcas de la cinta
  function eventosDe(d) {
    var ev = [];
    ev.push({ fecha: d.alta.slice(0, 10), fila: 'banda', tipo: 'alta', texto: 'Alta en el RPAD' });
    d.historial.forEach(function (h) { ev.push({ fecha: h.fecha, fila: 'banda', tipo: 'act', texto: 'Actualización registrada (antes de la doble verificación)' }); });
    d.cambios.forEach(function (c) {
      if (c.tipo === 'crear') return;
      var cambiaUltima = c.ultima_despues && c.ultima_despues !== c.ultima_antes;
      if (c.estado === 'rechazado') ev.push({ fecha: c.revisado.slice(0, 10), fila: 'abajo', tipo: 'rech', texto: 'Propuesta rechazada, cambio #' + c.id });
      else if (c.estado === 'pendiente') ev.push({ fecha: cambiaUltima ? c.ultima_despues : c.creado.slice(0, 10), fila: 'banda', tipo: cambiaUltima ? 'actp' : 'cambiop', texto: (cambiaUltima ? 'Actualización' : 'Cambio') + ' pendiente de aprobación, cambio #' + c.id });
      else if (cambiaUltima) ev.push({ fecha: c.ultima_despues, fila: 'banda', tipo: 'act', texto: 'Actualización registrada (cargado en el portal), cambio #' + c.id + (c.revisado.slice(0, 10) !== c.ultima_despues ? ', aprobada el ' + dmy(c.revisado) : '') });
      else ev.push({ fecha: c.revisado.slice(0, 10), fila: 'banda', tipo: 'cambio', texto: 'Cambio en la ficha' + (c.proxima_despues !== c.proxima_antes ? ': próxima ' + dmy(c.proxima_antes) + ' a ' + dmy(c.proxima_despues) : '') + ', cambio #' + c.id });
    });
    d.emails.forEach(function (e) {
      if (!e.success) return;
      var area = e.tipo === 'area-aviso-40';
      ev.push({ fecha: e.enviado.slice(0, 10), fila: area ? 'abajo' : 'arriba', tipo: area ? 'area' : 'email', texto: area ? 'Email al área: anticipo de la nota formal' : 'Email a DGMIT: ' + NOMBRE_EMAIL[e.tipo] });
    });
    d.notas.forEach(function (n) { ev.push({ fecha: n.fecha, fila: 'arriba', tipo: 'nota', etiqueta: 'Nota ' + n.numero + '/' + String(n.anio).slice(2), texto: 'Nota Digital N° ' + n.numero + '/' + String(n.anio).slice(2) + ' (' + n.tipo + ', ' + n.seccion + ')' }); });
    return ev.sort(function (a, b) { return a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0; });
  }

  // Ciclo = el tiempo en que rige un vencimiento. Lo cierra una actualización aprobada que mueve la próxima;
  // si solo se mueve la próxima, el vencimiento se reprograma dentro del mismo ciclo.
  function ciclosDe(d) {
    if (!d.meses) return null;
    var aprobados = d.cambios.filter(function (c) { return c.estado === 'aprobado' && c.tipo === 'editar'; })
      .sort(function (a, b) { return a.revisado < b.revisado ? -1 : a.revisado > b.revisado ? 1 : a.id - b.id; });
    var primero = aprobados.filter(function (c) { return c.proxima_antes; })[0];
    var venc = primero ? primero.proxima_antes : d.proxima;
    var inicio = d.alta.slice(0, 10), ciclos = [];
    aprobados.forEach(function (c) {
      var cambiaUltima = c.ultima_despues && c.ultima_despues !== c.ultima_antes;
      var cambiaProxima = c.proxima_despues && c.proxima_despues !== venc;
      if (cambiaUltima && cambiaProxima) { ciclos.push({ inicio: inicio, venc: venc, cierre: c.ultima_despues }); inicio = c.ultima_despues; venc = c.proxima_despues; }
      else if (cambiaProxima) venc = c.proxima_despues;
    });
    ciclos.push({ inicio: inicio, venc: venc, cierre: null });
    return ciclos;
  }

  // Movimientos de la lista, del más nuevo al más viejo
  function movimientosDe(d) {
    var m = [];
    var crear = d.cambios.filter(function (c) { return c.tipo === 'crear'; })[0];
    m.push({ fecha: d.alta.slice(0, 10), momento: d.alta, tipo: 'alta', titulo: 'Alta en el RPAD', detalle: crear ? 'Cambio #' + crear.id + '.' : 'Carga inicial del registro.', quien: crear ? 'Propuso ' + crear.propuso + '\nAprobó ' + crear.reviso : '' });
    d.historial.forEach(function (h) { m.push({ fecha: h.fecha, momento: h.creado, tipo: 'act', titulo: 'Actualización registrada', detalle: 'Cargado en el portal el ' + dmy(h.fecha) + '. Registro anterior a la doble verificación.', quien: h.usuario || '' }); });
    d.cambios.forEach(function (c) {
      if (c.tipo === 'crear') return;
      var cambiaUltima = c.ultima_despues && c.ultima_despues !== c.ultima_antes;
      var cambiaProxima = c.proxima_despues && c.proxima_despues !== c.proxima_antes;
      var partes = [];
      if (cambiaUltima) partes.push('Cargado en el portal el ' + dmy(c.ultima_despues) + '.');
      if (cambiaProxima) partes.push('Próxima: ' + (cambiaUltima ? '' : dmy(c.proxima_antes) + ' a ') + dmy(c.proxima_despues) + '.');
      if (c.campos.indexOf('frecuencia_id') >= 0) partes.push('Cambió la frecuencia.');
      if (c.campos.indexOf('area_id') >= 0) partes.push('Cambió el área.');
      if (c.estado === 'rechazado') {
        m.push({ fecha: c.revisado.slice(0, 10), momento: c.revisado, tipo: 'rech', titulo: 'Propuesta rechazada', detalle: (cambiaProxima ? 'Próxima ' + dmy(c.proxima_despues) + '. ' : '') + 'Motivo: "' + (c.motivo || 'sin motivo') + '". Cambio #' + c.id + '.', quien: 'Propuso ' + c.propuso + '\nRechazó ' + c.reviso });
      } else if (c.estado === 'pendiente') {
        m.push({ fecha: c.creado.slice(0, 10), momento: c.creado, tipo: cambiaUltima ? 'actp' : 'cambiop', titulo: (cambiaUltima ? 'Actualización' : 'Cambio') + ' pendiente de aprobación', detalle: partes.join(' ') + ' Cambio #' + c.id + '.', quien: 'Propuso ' + c.propuso });
      } else {
        m.push({ fecha: cambiaUltima ? c.ultima_despues : c.revisado.slice(0, 10), momento: c.revisado, tipo: cambiaUltima ? 'act' : 'cambio', titulo: cambiaUltima ? 'Actualización registrada' : 'Cambio en la ficha', detalle: partes.join(' ') + ' Cambio #' + c.id + '.', quien: 'Propuso ' + c.propuso + '\nAprobó ' + c.reviso });
      }
    });
    d.emails.forEach(function (e) {
      var area = e.tipo === 'area-aviso-40', otros = e.cantidad_datasets - 1;
      m.push({ fecha: e.enviado.slice(0, 10), momento: e.enviado, tipo: area ? 'area' : 'email', titulo: area ? 'Email al área: anticipo de la nota formal' : 'Email a DGMIT: ' + NOMBRE_EMAIL[e.tipo],
        detalle: !e.success ? 'No se pudo enviar.' : area ? 'A ' + (d.area.charAt(0) === 'D' ? 'la ' : '') + d.area + '.' : (FALTABAN[e.tipo] ? 'Faltaban ' + FALTABAN[e.tipo] + ' días. ' : '') + (otros > 0 ? 'Junto con otros ' + otros + ' datasets.' : 'Solo este dataset.'), quien: 'Sistema' });
    });
    d.notas.forEach(function (n) {
      var pasado = n.vencimiento < n.fecha;
      m.push({ fecha: n.fecha, momento: n.fecha + ' 08:15', tipo: 'nota', titulo: 'Nota Digital N° ' + n.numero + '/' + String(n.anio).slice(2) + ' a DGMIT',
        detalle: 'Aviso de gestión ' + n.gestion + ', ' + (n.seccion === 'vencido' ? 'sección vencidos' : 'próximos a vencer') + ': ' + (pasado ? 'vencía' : 'vence') + ' el ' + dmy(n.vencimiento) + '.' + (n.datos_solicitados ? ' Pide: ' + n.datos_solicitados + '.' : ''), quien: 'Envío automático' });
    });
    return m.sort(function (a, b) { return a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : (a.momento < b.momento ? 1 : a.momento > b.momento ? -1 : 0); });
  }

  // ===== Dibujo =====
  var MEDIDAS = {
    pantalla: { alto: 170, etiqueta: 14, arriba: 34, bandaY: 54, bandaH: 22, abajo: 92, vence: 113, vence2: 126, mes: 151, anio: 164, lineaTope: 24, lineaPie: 102, sep: 11, letra: 6.6 },
    pdf: { alto: 150, etiqueta: 15, arriba: 33, bandaY: 50, bandaH: 20, abajo: 84, vence: 104, vence2: 117, mes: 133, anio: 147, lineaTope: 22, lineaPie: 94, sep: 12, letra: 8.4 }
  };
  var PRIORIDAD = ['nota', 'email', 'act', 'actp', 'cambio', 'cambiop', 'alta', 'rech', 'area'];
  var X0 = 30, X1 = 970;

  function icono(tipo, cx, cy, k) {
    k = k || 1;
    switch (tipo) {
      case 'nota': return '<rect x="' + (cx - 6.5 * k) + '" y="' + (cy - 6.5 * k) + '" width="' + 13 * k + '" height="' + 13 * k + '" transform="rotate(45 ' + cx + ' ' + cy + ')" class="i-nota"/>';
      case 'email': return '<rect x="' + (cx - 5 * k) + '" y="' + (cy - 5 * k) + '" width="' + 10 * k + '" height="' + 10 * k + '" transform="rotate(45 ' + cx + ' ' + cy + ')" class="i-email"/>';
      case 'area': return '<circle cx="' + cx + '" cy="' + cy + '" r="' + 5.5 * k + '" class="i-area"/>';
      case 'act': return '<circle cx="' + cx + '" cy="' + cy + '" r="' + 7 * k + '" class="i-act"/>';
      case 'actp': return '<circle cx="' + cx + '" cy="' + cy + '" r="' + 6 * k + '" class="i-actp"/>';
      case 'cambio': return '<rect x="' + (cx - 5.5 * k) + '" y="' + (cy - 5.5 * k) + '" width="' + 11 * k + '" height="' + 11 * k + '" rx="2" class="i-cambio"/>';
      case 'cambiop': return '<rect x="' + (cx - 5 * k) + '" y="' + (cy - 5 * k) + '" width="' + 10 * k + '" height="' + 10 * k + '" rx="2" class="i-cambiop"/>';
      case 'alta': return '<circle cx="' + cx + '" cy="' + cy + '" r="' + 6 * k + '" class="i-alta"/>';
      case 'rech': return '<g class="i-rech"><line x1="' + (cx - 5 * k) + '" y1="' + (cy - 5 * k) + '" x2="' + (cx + 5 * k) + '" y2="' + (cy + 5 * k) + '"/><line x1="' + (cx + 5 * k) + '" y1="' + (cy - 5 * k) + '" x2="' + (cx - 5 * k) + '" y2="' + (cy + 5 * k) + '"/></g>';
    }
    return '';
  }

  function svg(d, opciones) {
    var hoy = opciones.hoy, tema = opciones.tema || 'pantalla', Y = MEDIDAS[tema], k = tema === 'pdf' ? 1.15 : 1;
    var v = ventanaDe(hoy), total = v.fin - v.ini;
    function x(fecha) { return X0 + (num(fecha) + 0.5 - v.ini) / total * (X1 - X0); }
    function xr(n) { return X0 + (n - v.ini) / total * (X1 - X0); }
    function recorte(a) { return Math.max(X0, Math.min(X1, a)); }
    function rect(a, b, clase) { return b - a > 0.2 ? '<rect x="' + a + '" y="' + Y.bandaY + '" width="' + (b - a) + '" height="' + Y.bandaH + '" class="t-' + clase + '"/>' : ''; }
    var yBanda = Y.bandaY + Y.bandaH / 2, s = [];

    v.meses.forEach(function (m, i) {
      var xa = xr(num(m.desde)), xb = i < 11 ? xr(num(v.meses[i + 1].desde)) : X1;
      s.push('<line x1="' + xa + '" y1="' + Y.lineaTope + '" x2="' + xa + '" y2="' + Y.lineaPie + '" class="l-mes"/>');
      s.push('<text x="' + ((xa + xb) / 2) + '" y="' + Y.mes + '" class="mes">' + MESES[m.mes - 1] + '</text>');
      if (i === 0 || m.mes === 1) s.push('<text x="' + ((xa + xb) / 2) + '" y="' + Y.anio + '" class="anio">' + m.anio + '</text>');
    });
    s.push('<line x1="' + X1 + '" y1="' + Y.lineaTope + '" x2="' + X1 + '" y2="' + Y.lineaPie + '" class="l-mes"/>');

    var alta = d.alta.slice(0, 10), xAlta = x(alta), xHoy = x(hoy);
    if (xAlta > X0) {
      s.push('<line x1="' + X0 + '" y1="' + yBanda + '" x2="' + (xAlta - 6) + '" y2="' + yBanda + '" class="l-antes"/>');
      if (xAlta - X0 > 260) s.push('<text x="' + ((X0 + xAlta) / 2) + '" y="' + (Y.bandaY - 5) + '" class="t-gris">Todavía no estaba en el RPAD</text>');
    }
    var ev = eventosDe(d).filter(function (e) { var n = num(e.fecha); return n >= v.ini && n < v.fin; });
    var xsBanda = ev.filter(function (e) { return e.fila === 'banda'; }).map(function (e) { return x(e.fecha); }).sort(function (a, b) { return a - b; });
    // El centro del hueco libre más grande entre a y b (cada marca ocupa 11 a cada lado), o null si el texto no entra
    function hueco(a, b, ancho) {
      var bordes = [a].concat(xsBanda.filter(function (m) { return m > a - 11 && m < b + 11; }).reduce(function (r, m) { r.push(m - 11, m + 11); return r; }, [])).concat([b]);
      var mejor = null;
      for (var i = 0; i + 1 < bordes.length; i += 2) { var l = Math.max(bordes[i], a), r = Math.min(bordes[i + 1], b); if (r - l >= ancho && (!mejor || r - l > mejor.r - mejor.l)) mejor = { l: l, r: r }; }
      return mejor ? (mejor.l + mejor.r) / 2 : null;
    }
    var ciclos = ciclosDe(d), venceEtq = [];
    if (!ciclos) {
      var a0 = recorte(Math.max(xAlta, X0));
      s.push(rect(a0, xHoy, 'eventual'));
      var lugar = hueco(a0, xHoy, 36 * Y.letra);
      if (lugar !== null) s.push('<text x="' + lugar + '" y="' + (yBanda + 4.5) + '" class="en-banda gris">Frecuencia eventual: sin vencimiento</text>');
    } else {
      ciclos.forEach(function (c, i) {
        var xi = recorte(Math.max(x(c.inicio), X0)), xv = x(c.venc), finReal = c.cierre || hoy, xf = recorte(x(finReal));
        var separa = i > 0 ? 1.5 : 0;
        var xn = Math.min(recorte(xv), xf);
        if (xn > xi) s.push(rect(xi + separa, xn, 'ciclo'));
        if (num(finReal) > num(c.venc)) {
          var xa = Math.max(recorte(xv), xi);
          if (xf > xa) {
            s.push(rect(xa, xf, 'vencido'));
            var dias = num(finReal) - num(c.venc);
            var txt = c.cierre ? dias + ' días tarde' : (num(c.venc) < v.ini ? 'Vencido desde el ' + dmy(c.venc) + ': ' + dias + ' días' : dias + ' días sin entregar');
            var lugarV = hueco(xa, xf, txt.length * Y.letra + 10);
            if (lugarV !== null) s.push('<text x="' + lugarV + '" y="' + (yBanda + 4.5) + '" class="en-banda ambar">' + txt + '</text>');
          }
        }
        if (!c.cierre && num(c.venc) > num(hoy)) {
          var xfut = Math.min(recorte(xv), X1);
          if (xfut > xHoy) s.push(rect(xHoy, xfut, 'futuro'));
        }
        if (num(c.venc) >= v.ini && num(c.venc) < v.fin && (!c.cierre || num(c.cierre) >= num(c.venc))) {
          s.push('<line x1="' + xv + '" y1="' + (Y.bandaY - 8) + '" x2="' + xv + '" y2="' + (Y.bandaY + Y.bandaH + 8) + '" class="l-vence"/>');
          venceEtq.push({ x: xv, texto: 'vence ' + dm(c.venc) });
        }
      });
    }
    ['arriba', 'banda', 'abajo'].forEach(function (fila) {
      var grupos = [];
      ev.filter(function (e) { return e.fila === fila; }).forEach(function (e) {
        var xe = x(e.fecha), g = grupos[grupos.length - 1];
        if (g && xe - g.x0 < Y.sep) { g.items.push(e); g.x1 = xe; } else grupos.push({ x0: xe, x1: xe, items: [e] });
      });
      grupos.forEach(function (g) {
        var cx = (g.x0 + g.x1) / 2, cy = fila === 'banda' ? yBanda : Y[fila];
        var rep = g.items.slice().sort(function (a, b) { return PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo); })[0];
        var titulo = g.items.map(function (e) { return dmy(e.fecha) + ': ' + e.texto; }).join('\n');
        s.push('<g class="marca"><title>' + titulo.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</title>' + icono(rep.tipo, cx, cy, k) +
          (g.items.length > 1 ? '<circle cx="' + (cx + 9 * k) + '" cy="' + (cy - 9 * k) + '" r="' + 7 * k + '" class="c-fondo"/><text x="' + (cx + 9 * k) + '" y="' + (cy - 9 * k + 3.6 * k) + '" class="cuenta">' + g.items.length + '</text>' : '') + '</g>');
        var notas = g.items.filter(function (e) { return e.etiqueta; });
        if (notas.length) s.push('<text x="' + Math.min(Math.max(cx, X0 + 30), X1 - 30) + '" y="' + Y.etiqueta + '" class="etq-nota">' + notas.map(function (e) { return e.etiqueta; }).join(' y ') + '</text>');
      });
    });
    s.push('<line x1="' + xHoy + '" y1="' + (Y.bandaY - 12) + '" x2="' + xHoy + '" y2="' + (Y.bandaY + Y.bandaH + 12) + '" class="l-hoy"/>');
    var choca = venceEtq.some(function (e) { return Math.abs(e.x - xHoy) < 62; });
    venceEtq.forEach(function (e) { s.push('<text x="' + Math.min(e.x, X1 - 30) + '" y="' + Y.vence + '" class="vence">' + e.texto + '</text>'); });
    s.push('<text x="' + Math.min(xHoy, X1 - 14) + '" y="' + (choca ? Y.vence2 : Y.vence) + '" class="hoy">hoy</text>');

    return '<svg class="cinta-' + tema + '" viewBox="0 0 1000 ' + Y.alto + '" role="img" aria-label="Cinta de los últimos 12 meses">' +
      '<defs><pattern id="rayado-' + tema + '" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" class="r-fondo"/><rect width="3" height="7" class="r-raya"/></pattern></defs>' + s.join('') + '</svg>';
  }

  window.Cinta = { svg: svg, eventosDe: eventosDe, ciclosDe: ciclosDe, movimientosDe: movimientosDe, icono: icono, dmy: dmy };
})();
