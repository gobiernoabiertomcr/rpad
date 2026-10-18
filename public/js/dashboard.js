// Dashboard - Lógica principal con animaciones y gráficos
// Al cargarse solo declara y registra su DOMContentLoaded: lo que cuenta y arma los gráficos y las alertas es puro
// (mesesDelGrafico, vencimientosPorMes, porcionesDelEstado, alertasDe...) y tests/publico-frontend.test.js lo carga en un vm.
// Los estados, los días y la tasa son los que manda el servidor (d.estado, d.dias_para_vencer, tasaActualizacion), y las
// fechas se leen por su texto (spec 2026-10-17-fechas-datasets, 11)
let donutChart = null;
let calendarChart = null;

document.addEventListener('DOMContentLoaded', async () => {
  // updateAuthUI() ya no es necesario - está en main.js como initHeader()
  updateHeroGreeting();
  updateHeroDateTime();
  setInterval(updateHeroDateTime, 1000);
  await loadDashboard();
});

// Actualizar saludo en el hero (usa Auth de auth.js y getSaludo de main.js)
function updateHeroGreeting() {
  const heroGreeting = document.getElementById('hero-greeting');
  if (!heroGreeting) return;
  
  if (Auth.isAuthenticated()) {
    const user = Auth.getUser();
    const nombre = user?.nombre_completo?.split(' ')[0] || user?.username || 'Usuario';
    const saludo = getSaludo();
    heroGreeting.textContent = `${saludo}, ${nombre}`;
  } else {
    heroGreeting.textContent = 'Tablero de Seguimiento';
  }
}

function updateHeroDateTime() {
  const now = new Date();
  
  const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  let fechaStr = now.toLocaleDateString('es-AR', opcionesFecha);
  fechaStr = fechaStr.charAt(0).toUpperCase() + fechaStr.slice(1);
  document.getElementById('hero-date').textContent = fechaStr;
  
  const opcionesHora = { hour: '2-digit', minute: '2-digit', second: '2-digit' };
  document.getElementById('hero-time').textContent = now.toLocaleTimeString('es-AR', opcionesHora);
}

async function loadDashboard() {
  try {
    const [estadisticas, datasets] = await Promise.all([
      API.getEstadisticas(),
      API.getDatasets()
    ]);

    renderStats(estadisticas);
    renderDonutChart(estadisticas);
    renderCalendarChart(datasets);
    renderAlertas(datasets);
    
    document.getElementById('hero-rate').textContent = textoTasa(estadisticas);
    
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    if (typeof showToast === 'function') {
      showToast('Error al cargar el dashboard', 'error');
    }
  }
}

function animateCounter(element, target, duration = 1000) {
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (target - start) * easeOut);
    
    element.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target;
    }
  }
  
  requestAnimationFrame(update);
}

function renderStats(stats) {
  const container = document.getElementById('stats-grid');
  const totalVencidos = (stats.atrasados || 0) + (stats.sinRespuesta || 0);
  
  // Iconos Lucide para las stat cards
  const iconTotal = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>';
  const iconActualizado = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  const iconProximo = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const iconVencido = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
  
  container.innerHTML = `
    <div class="stat-card primary clickable animate-slide-up" style="animation-delay: 0.05s;" onclick="goToDatasets('')" title="Ver todos los datasets">
      <div class="stat-card-header">
        <span class="stat-card-label">Total Datasets</span>
        <div class="stat-card-icon primary">${iconTotal}</div>
      </div>
      <div class="stat-card-value" data-target="${stats.total || 0}">0</div>
    </div>
    <div class="stat-card success clickable animate-slide-up" style="animation-delay: 0.1s;" onclick="goToDatasets('actualizado')" title="Ver datasets actualizados">
      <div class="stat-card-header">
        <span class="stat-card-label">Actualizados</span>
        <div class="stat-card-icon success">${iconActualizado}</div>
      </div>
      <div class="stat-card-value" data-target="${stats.actualizados || 0}">0</div>
    </div>
    <div class="stat-card warning clickable animate-slide-up" style="animation-delay: 0.15s;" onclick="goToDatasets('proximo')" title="Ver próximos a vencer">
      <div class="stat-card-header">
        <span class="stat-card-label">Vencen en 60 días o menos</span>
        <div class="stat-card-icon warning">${iconProximo}</div>
      </div>
      <div class="stat-card-value" data-target="${stats.proximos || 0}">0</div>
    </div>
    <div class="stat-card danger clickable animate-slide-up" style="animation-delay: 0.2s;" onclick="goToDatasets('vencidos')" title="Ver vencidos">
      <div class="stat-card-header">
        <span class="stat-card-label">Vencidos</span>
        <div class="stat-card-icon danger">${iconVencido}</div>
      </div>
      <div class="stat-card-value" data-target="${totalVencidos}">0</div>
    </div>
  `;
  
  setTimeout(() => {
    container.querySelectorAll('.stat-card-value').forEach(el => {
      const target = parseInt(el.dataset.target) || 0;
      animateCounter(el, target, 800);
    });
  }, 300);
}

function goToDatasets(estado) {
  if (estado) {
    window.location.href = `datasets.html?estado=${estado}`;
  } else {
    window.location.href = 'datasets.html';
  }
}

function renderDonutChart(stats) {
  const ctx = document.getElementById('donut-chart').getContext('2d');
  const porciones = porcionesDelEstado(stats);

  const data = {
    labels: porciones.map(p => p.etiqueta),
    datasets: [{
      data: porciones.map(p => p.valor),
      backgroundColor: porciones.map(p => p.color),
      borderColor: '#ffffff',
      borderWidth: 3,
      hoverBorderWidth: 4,
      hoverOffset: 8
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, weight: '600' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context) {
            const porcion = porciones[context.dataIndex];
            return ` ${porcion.valor} datasets (${porcion.porcentaje}%)`;
          }
        }
      }
    },
    animation: {
      animateRotate: true,
      animateScale: true,
      duration: 1000,
      easing: 'easeOutQuart'
    }
  };
  
  if (donutChart) donutChart.destroy();
  
  donutChart = new Chart(ctx, {
    type: 'doughnut',
    data: data,
    options: options
  });
  
  document.getElementById('chart-legend').innerHTML = htmlDeLeyenda(porciones);
}

function renderAlertas(datasets) {
  const { vencidos, proximos } = alertasDe(datasets);

  const mostrarInicial = 3;

  // Renderizar vencidos
  const alertasContainer = document.getElementById('alertas-list');
  if (vencidos.length) {
    const hayMas = vencidos.length > mostrarInicial;
    
    let html = vencidos.map((d, index) => {
      const dias = Math.abs(d.dias_para_vencer ?? 0);
      const estado = Utils.estadoDe(d);
      const estadoTexto = Utils.getEstadoTexto(estado);
      const estadoClase = Utils.getEstadoClase(estado);
      const oculto = index >= mostrarInicial ? 'style="display: none;"' : '';
      const itemClass = estado === 'atrasado' ? 'atrasado' : 'sin-respuesta';
      const delay = Math.min(index, 2) * 0.1;
      
      return `
        <a href="dataset.html?id=${d.id}" class="alert-item ${itemClass} animate-fade-in-item" data-index="${index}" ${oculto} style="animation-delay: ${delay}s;">
          <div>
            <div class="alert-item-title">${Utils.escapeHtml(d.titulo)}</div>
            <div class="alert-item-meta">${dias} días de atraso</div>
          </div>
          <span class="badge ${estadoClase}">${estadoTexto}</span>
        </a>
      `;
    }).join('');
    
    if (hayMas) {
      html += `
        <button id="btn-ver-mas-atrasados" class="btn-ver-mas" onclick="toggleAtrasados()">
          Ver más (${vencidos.length - mostrarInicial} restantes)
        </button>
      `;
    }
    
    alertasContainer.innerHTML = html;
  } else {
    alertasContainer.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #22c55e; margin-bottom: 0.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <p class="text-muted">No hay datasets vencidos</p>
      </div>
    `;
  }

  // Renderizar próximos
  const proximosContainer = document.getElementById('proximos-list');
  if (proximos.length) {
    const hayMasProximos = proximos.length > mostrarInicial;
    
    let htmlProximos = proximos.map((d, index) => {
      const dias = d.dias_para_vencer ?? 0;
      const oculto = index >= mostrarInicial ? 'style="display: none;"' : '';
      const delay = Math.min(index, 2) * 0.1;
      
      return `
        <a href="dataset.html?id=${d.id}" class="alert-item proximo animate-fade-in-item" data-index="${index}" ${oculto} style="animation-delay: ${delay}s;">
          <div>
            <div class="alert-item-title">${Utils.escapeHtml(d.titulo)}</div>
            <div class="alert-item-meta">Vence en ${dias} días</div>
          </div>
          <span class="badge badge-warning">Próximo</span>
        </a>
      `;
    }).join('');
    
    if (hayMasProximos) {
      htmlProximos += `
        <button id="btn-ver-mas-proximos" class="btn-ver-mas" onclick="toggleProximos()">
          Ver más (${proximos.length - mostrarInicial} restantes)
        </button>
      `;
    }
    
    proximosContainer.innerHTML = htmlProximos;
  } else {
    proximosContainer.innerHTML = `
      <div class="empty-state" style="padding: 1.5rem;">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6; margin-bottom: 0.5rem;"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
        <p class="text-muted">No hay datasets próximos a vencer</p>
      </div>
    `;
  }
}

function toggleAtrasados() {
  const items = document.querySelectorAll('#alertas-list .alert-item');
  const btn = document.getElementById('btn-ver-mas-atrasados');
  const mostrarInicial = 3;
  
  const estanOcultos = items[mostrarInicial]?.style.display === 'none';
  
  items.forEach((item, index) => {
    if (index >= mostrarInicial) {
      item.style.display = estanOcultos ? 'flex' : 'none';
    }
  });
  
  btn.textContent = estanOcultos ? 'Ver menos' : `Ver más (${items.length - mostrarInicial} restantes)`;
}

function toggleProximos() {
  const items = document.querySelectorAll('#proximos-list .alert-item');
  const btn = document.getElementById('btn-ver-mas-proximos');
  const mostrarInicial = 3;
  
  const estanOcultos = items[mostrarInicial]?.style.display === 'none';
  
  items.forEach((item, index) => {
    if (index >= mostrarInicial) {
      item.style.display = estanOcultos ? 'flex' : 'none';
    }
  });
  
  btn.textContent = estanOcultos ? 'Ver menos' : `Ver más (${items.length - mostrarInicial} restantes)`;
}

// === CALENDARIO DE VENCIMIENTOS ===
function renderCalendarChart(datasets) {
  const canvas = document.getElementById('calendar-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  
  // Los 12 meses, desde el mes en curso (el de hoy en Argentina), y los vencimientos de cada uno (sin los eventuales)
  const meses = mesesDelGrafico(Utils.hoyEnArgentina());
  const cantidades = vencimientosPorMes(datasets, meses);

  // Colores según cantidad de vencimientos (valores fijos)
  const colores = cantidades.map(v => {
    if (v === 0) return '#faffff';       // (sin vencimientos)
    if (v === 1) return '#b9e4df';       // (1)
    if (v <= 3) return '#72c8c1';        // (2-3)
    if (v <= 7) return '#4bb0a9';        // (4-7)
    return '#329b93';                    // (8+ vencimientos)
  });
  
  const data = {
    labels: meses.map(m => m.etiqueta),
    datasets: [{
      label: 'Datasets a vencer',
      data: cantidades,
      backgroundColor: colores,
      borderColor: colores.map(c => c),
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
    }]
  };
  
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: { size: 14, weight: '600' },
        bodyFont: { size: 13 },
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: function(context) {
            return meses[context[0].dataIndex].titulo;
          },
          label: function(context) {
            const value = context.raw;
            return value === 1 ? ' 1 dataset vence' : ` ${value} datasets vencen`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
          font: { size: 11 },
          color: '#6b7280'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        ticks: {
          font: { size: 11, weight: '500' },
          color: '#374151'
        },
        grid: {
          display: false
        }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        window.location.href = urlDelMes(meses[elements[0].index]);
      }
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    }
  };
  
  if (calendarChart) calendarChart.destroy();
  
  calendarChart = new Chart(ctx, {
    type: 'bar',
    data: data,
    options: options
  });
}

// =====================================================
// LO PURO: gráfico de 12 meses, dona y alertas
// =====================================================

// "83%": la tasa del servidor (actualizados + próximos sobre el total sin los eventuales; tasaDeActualizacion)
function textoTasa(stats) {
  return `${stats?.tasaActualizacion ?? 0}%`;
}

/**
 * Los 12 meses del gráfico, desde el mes de `hoy` ('AAAA-MM-DD', la fecha de Argentina): { clave: 'AAAA-MM', etiqueta:
 * 'oct 26', titulo: 'octubre de 2026' }. Se cuentan sobre el índice año × 12 + mes, sin new Date.
 */
function mesesDelGrafico(hoy) {
  const primero = Number(hoy.slice(0, 4)) * 12 + Number(hoy.slice(5, 7)) - 1;
  return Array.from({ length: 12 }, (_, i) => {
    const anio = Math.floor((primero + i) / 12);
    const mes = ((primero + i) % 12) + 1;
    const clave = `${anio}-${String(mes).padStart(2, '0')}`;
    return { clave, etiqueta: `${Utils.nombreDeMes(mes).slice(0, 3)} ${String(anio).slice(-2)}`, titulo: Utils.mesDeAnio(`${clave}-01`) };
  });
}

// Cuántos datasets vencen en cada mes: el mismo Utils.mesDeVencimiento que usa el filtro ?mes= del listado
function vencimientosPorMes(datasets, meses) {
  return meses.map(m => datasets.filter(d => Utils.mesDeVencimiento(d) === m.clave).length);
}

function urlDelMes(mes) {
  return `datasets.html?mes=${mes.clave}`;
}

/**
 * Porcentajes enteros que suman exactamente 100 (si el total no es 0): cada uno se redondea para abajo y los puntos que
 * faltan van a los de mayor resto (método del resto mayor; en un empate, al primero). Con el redondeo común, 54, 1, 11 y
 * 14 de 80 darían 68 + 1 + 14 + 18 = 101.
 */
function porcentajesEnteros(valores) {
  const total = valores.reduce((suma, valor) => suma + valor, 0);
  if (total <= 0) return valores.map(() => 0);
  const exactos = valores.map(valor => (valor * 100) / total);
  const enteros = exactos.map(Math.floor);
  let faltan = 100 - enteros.reduce((suma, valor) => suma + valor, 0);
  const porResto = exactos.map((exacto, i) => ({ i, resto: exacto - Math.floor(exacto) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i);
  for (const { i } of porResto) {
    if (faltan <= 0) break;
    enteros[i]++;
    faltan--;
  }
  return enteros;
}

/**
 * Las porciones de la dona del estado, con los números del servidor (/datasets/estadisticas): los eventuales son una
 * porción propia (no tienen vencimiento: no son actualizados) y los sin fecha aparecen solo si hay, así los porcentajes
 * suman 100. { clave, etiqueta, valor, color, porcentaje }
 */
function porcionesDelEstado(stats = {}) {
  const porciones = [
    { clave: 'actualizados', etiqueta: 'Actualizados', valor: stats.actualizados || 0, color: '#81b3a3' },
    { clave: 'proximos', etiqueta: 'Próximos a vencer', valor: stats.proximos || 0, color: '#f8cf61' },
    { clave: 'vencidos', etiqueta: 'Vencidos', valor: (stats.atrasados || 0) + (stats.sinRespuesta || 0), color: '#fc7c7e' },
    { clave: 'eventuales', etiqueta: 'Eventuales', valor: stats.eventuales || 0, color: '#c3ccd8' }
  ];
  if (stats.sinFecha > 0) porciones.push({ clave: 'sin-fecha', etiqueta: 'Sin fecha', valor: stats.sinFecha, color: '#8a96a8' });
  const porcentajes = porcentajesEnteros(porciones.map(p => p.valor));
  return porciones.map((p, i) => ({ ...p, porcentaje: porcentajes[i] }));
}

function htmlDeLeyenda(porciones) {
  return porciones.map(p => `
      <div class="legend-item">
        <span class="legend-color" style="background: ${p.color};"></span>
        <span class="legend-label">${Utils.escapeHtml(p.etiqueta)}</span>
        <span class="legend-value">${p.valor} (${p.porcentaje}%)</span>
      </div>
    `).join('');
}

// Los vencidos (atrasados y sin respuesta) y los próximos a vencer, con el estado y los días del servidor: primero los que
// vencieron hace más y los que vencen antes
function alertasDe(datasets) {
  const porDias = (a, b) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0);
  return {
    vencidos: datasets.filter(d => ['atrasado', 'sin-respuesta'].includes(Utils.estadoDe(d))).sort(porDias),
    proximos: datasets.filter(d => Utils.estadoDe(d) === 'proximo').sort(porDias)
  };
}
