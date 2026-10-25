// Pestaña Áreas de Configuración (spec 2026-10-24-configuracion, 4). MAQUETA: el prototipo de la pestaña, con las dos
// variantes de la lista (?lista=tabla | filas). Lo que arma HTML es puro; lo que toca el DOM o la API va al final.
let areasLista = null;        // null = todavía no se pidió
let filtroArea = 'todas';
let areaAbierta = null;       // el área del modal; null = alta
let areaDesplegada = null;    // variante filas: la fila abierta
let botonQueAbrio = null;

const VARIANTE_LISTA = new URLSearchParams(window.location.search).get('lista') === 'tabla' ? 'tabla' : 'filas';
const TEXTO_AMBITO = { municipal: 'Municipal', externo: 'Fuera del municipio' };

const escA = (valor) => Utils.escapeHtml(valor ?? '');
const sinTildesA = (texto) => String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pluralA = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

// Cómo se nombra el área en las notas: «la Dirección …, dependiente de la Secretaría …»
const comoSeNombra = ({ articulo, nombre, articulo_superior, area_superior }) => {
  const base = `${articulo || 'la'} ${String(nombre ?? '').trim() || '…'}`;
  const superior = String(area_superior ?? '').trim();
  return superior ? `${base}, dependiente de ${articulo_superior ? `${articulo_superior} ` : ''}${superior}` : base;
};

const sinEmail = (area) => !area.email_principal && !area.email_secundario;
// Sin email y con datasets de gestión externa que piden nota: no le llega el aviso de los 40 días
const sinAvisoDe40 = (area) => sinEmail(area) && area.externos_con_nota > 0;
const totalDeDatasets = (area) => area.cantidad_datasets + (area.datasets_dados_de_baja ?? 0);

const FILTROS_AREA = [
  { clave: 'todas', texto: 'Todas', pasa: () => true },
  { clave: 'municipal', texto: 'Municipales', pasa: a => a.ambito === 'municipal' },
  { clave: 'externo', texto: 'Fuera del municipio', pasa: a => a.ambito === 'externo' },
  { clave: 'sin-email', texto: 'Sin email', pasa: sinEmail },
  { clave: 'sin-datasets', texto: 'Sin datasets', pasa: a => totalDeDatasets(a) === 0 }
];

const coincideArea = (area, busqueda) => {
  const q = sinTildesA(busqueda).trim();
  if (!q) return true;
  return [area.nombre, area.area_superior, area.email_principal, area.email_secundario, area.nombre_contacto, area.email_contacto]
    .some(campo => sinTildesA(campo).includes(q));
};

const htmlDeFiltrosArea = (areas, elegido) => FILTROS_AREA
  .filter(f => f.clave !== 'sin-datasets' || areas.some(f.pasa))
  .map(f => `<button type="button" class="ar-chip" data-filtro-area="${f.clave}" aria-pressed="${f.clave === elegido}">${escA(f.texto)} <b>${String(areas.filter(f.pasa).length)}</b></button>`)
  .join('');

const htmlDeEtiquetasArea = (area) => [
  `<span class="ar-etq ${area.ambito}">${escA(TEXTO_AMBITO[area.ambito])}</span>`,
  sinAvisoDe40(area) ? '<span class="ar-etq sin-aviso">Sin email: no recibe el aviso de los 40 días</span>'
    : sinEmail(area) ? '<span class="ar-etq sin-email">Sin email</span>' : ''
].join('');

const textoDatasets = (area) => (area.cantidad_datasets === 0 ? 'Sin datasets' : pluralA(area.cantidad_datasets, 'dataset', 'datasets'));
const textoDependencia = (area) => (area.area_superior ? `Depende de ${area.articulo_superior ? `${area.articulo_superior} ` : ''}${area.area_superior}` : 'Sin dependencia cargada');

const lineaDe = (...partes) => partes.filter(Boolean).map(escA).join('<br>') || '<span style="color: var(--suave)">—</span>';

// Variante A: la tabla
const htmlDeTablaAreas = (areas) => `
  <div class="ar-tabla-marco"><table class="ar-tabla">
    <thead><tr><th scope="col">Área y dependencia</th><th scope="col">Ámbito</th><th scope="col">Emails del área</th><th scope="col">Persona de contacto</th><th scope="col" class="num">Datasets</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead>
    <tbody>${areas.map(a => `
      <tr>
        <td class="t"><b>${escA(a.nombre)}</b><small>${escA(textoDependencia(a))}</small></td>
        <td><span class="ar-etq ${a.ambito}">${escA(TEXTO_AMBITO[a.ambito])}</span></td>
        <td>${sinEmail(a) ? (sinAvisoDe40(a) ? '<span class="ar-etq sin-aviso">Sin email: no recibe el aviso de los 40 días</span>' : '<span class="ar-etq sin-email">Sin email</span>') : lineaDe(a.email_principal, a.email_secundario)}</td>
        <td>${a.nombre_contacto ? `${escA(a.nombre_contacto)}<small>${escA([a.telefono_contacto, a.email_contacto].filter(Boolean).join(' · ') || 'Sin teléfono ni email')}</small>` : '<span style="color: var(--suave)">—</span>'}</td>
        <td class="num">${String(a.cantidad_datasets)}</td>
        <td class="accion"><button type="button" class="ar-btn ar-btn-borde ar-btn-chico" data-editar-area="${a.id}" aria-label="Editar ${escA(a.nombre)}">Editar</button></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;

// Variante B: filas que se despliegan
const htmlDelCuerpoArea = (area) => {
  const total = totalDeDatasets(area);
  const borrar = total === 0
    ? `<button type="button" class="ar-boton-texto" data-borrar-area="${area.id}">Borrar el área</button>`
    : `<small>Para borrarla, primero hay que pasar sus ${pluralA(total, 'dataset', 'datasets')} a otra área.</small>`;
  return `
    <div class="ar-cuerpo" id="area-cuerpo-${area.id}">
      <dl>
        <dt>En las notas</dt><dd>«${escA(comoSeNombra(area))}»</dd>
        <dt>Ámbito</dt><dd>${escA(TEXTO_AMBITO[area.ambito])}: ${area.ambito === 'municipal' ? 'la nota de la DGMIT va por la Subsecretaría' : 'la nota de la DGMIT va directo al organismo'}</dd>
        <dt>Emails del área</dt><dd>${sinEmail(area) ? (sinAvisoDe40(area) ? '<b style="color: var(--ar-rojo)">Sin email: no le llega el aviso de los 40 días</b>' : 'Sin email') : lineaDe(area.email_principal, area.email_secundario)}</dd>
        <dt>Teléfonos del área</dt><dd>${lineaDe(area.telefono_area, area.celular_area && `${area.celular_area} (celular)`)}</dd>
        <dt>Persona de contacto</dt><dd>${area.nombre_contacto ? lineaDe(area.nombre_contacto, area.telefono_contacto, area.email_contacto) : '<span style="color: var(--suave)">—</span>'}</dd>
        <dt>Datasets</dt><dd>${escA(textoDatasets(area))}</dd>
      </dl>
      <div class="acciones">
        <button type="button" class="ar-btn ar-btn-borde ar-btn-chico" data-editar-area="${area.id}">Editar</button>
        ${borrar}
      </div>
    </div>`;
};

const htmlDeFilasAreas = (areas, desplegada) => `<ol class="ar-filas">${areas.map(a => {
  const abierta = a.id === desplegada;
  return `
    <li class="ar-item">
      <button type="button" class="ar-fila" data-desplegar-area="${a.id}" aria-expanded="${abierta}" aria-controls="area-cuerpo-${a.id}">
        <span><span class="q">${escA(a.nombre)}</span><span class="d">${escA(textoDependencia(a))}</span></span>
        <span class="etqs">${htmlDeEtiquetasArea(a)}</span>
        <span class="n">${escA(textoDatasets(a))}</span>
        <svg class="flecha-abrir" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      ${abierta ? htmlDelCuerpoArea(a) : ''}
    </li>`;
}).join('')}</ol>`;

const textoAvisoSinEmail = (areas) => {
  const n = areas.filter(sinAvisoDe40).length;
  if (n === 0) return '';
  return `${n === 1 ? '1 área con datasets de gestión externa no tiene email cargado: no le llega' : `${n} áreas con datasets de gestión externa no tienen email cargado: no les llega`} el aviso de los 40 días.`;
};

// Los datos del formulario, recortados (el servidor valida igual)
const datosDelFormularioArea = (leerCampo) => ({
  nombre: leerCampo('a-nombre').trim(),
  articulo: leerCampo('a-articulo'),
  area_superior: leerCampo('a-superior').trim() || null,
  articulo_superior: leerCampo('a-articulo-superior') || null,
  ambito: leerCampo('a-ambito'),
  email_principal: leerCampo('a-email-principal').trim() || null,
  email_secundario: leerCampo('a-email-secundario').trim() || null,
  telefono_area: leerCampo('a-telefono').trim() || null,
  celular_area: leerCampo('a-celular').trim() || null,
  nombre_contacto: leerCampo('a-contacto').trim() || null,
  telefono_contacto: leerCampo('a-contacto-telefono').trim() || null,
  email_contacto: leerCampo('a-contacto-email').trim() || null
});

const CAMPO_DEL_ERROR_AREA = { nombre: 'a-nombre', email_principal: 'a-email-principal', email_secundario: 'a-email-secundario', email_contacto: 'a-contacto-email' };

// =====================================================
// DOM y API
// =====================================================
async function cargarAreas(forzar = false) {
  if (areasLista && !forzar) return pintarAreas();
  try {
    areasLista = await API.pedirJson('GET', '/areas').then(r => r.data);
    pintarAreas();
  } catch (error) {
    document.getElementById('areas-lista').innerHTML = '<p class="aviso aviso-error">No se pudieron cargar las áreas. Probá de nuevo en unos minutos.</p>';
  }
}

function pintarAreas() {
  const areas = areasLista ?? [];
  const filtro = FILTROS_AREA.find(f => f.clave === filtroArea) ?? FILTROS_AREA[0];
  const busqueda = document.getElementById('buscar-area').value;
  const visibles = areas.filter(filtro.pasa).filter(a => coincideArea(a, busqueda));
  document.getElementById('areas-contador').textContent = pluralA(areas.length, 'área', 'áreas');
  document.getElementById('areas-filtros').innerHTML = htmlDeFiltrosArea(areas, filtroArea);
  const aviso = textoAvisoSinEmail(areas);
  const cajaAviso = document.getElementById('areas-aviso');
  cajaAviso.hidden = !aviso;
  cajaAviso.innerHTML = aviso ? `<span>${escA(aviso)}</span><button type="button" data-filtro-area="sin-email">Ver las áreas sin email</button>` : '';
  document.getElementById('areas-lista').innerHTML = VARIANTE_LISTA === 'tabla' ? htmlDeTablaAreas(visibles) : htmlDeFilasAreas(visibles, areaDesplegada);
  document.getElementById('areas-vacio').hidden = visibles.length > 0;
}

const leerCampoArea = (id) => (id === 'a-ambito'
  ? (document.querySelector('input[name="a-ambito"]:checked')?.value ?? 'municipal')
  : document.getElementById(id).value);

function actualizarLectura() {
  document.getElementById('a-lectura').textContent = comoSeNombra({
    articulo: leerCampoArea('a-articulo'), nombre: leerCampoArea('a-nombre'),
    articulo_superior: leerCampoArea('a-articulo-superior'), area_superior: leerCampoArea('a-superior')
  });
}

function limpiarErroresArea() {
  document.getElementById('area-error').hidden = true;
  Object.values(CAMPO_DEL_ERROR_AREA).forEach(id => {
    document.getElementById(id).removeAttribute('aria-invalid');
    document.getElementById(`${id}-error`).hidden = true;
  });
}

function mostrarErrorArea(mensaje, campo) {
  const id = CAMPO_DEL_ERROR_AREA[campo];
  if (id) {
    const error = document.getElementById(`${id}-error`);
    error.textContent = mensaje;
    error.hidden = false;
    document.getElementById(id).setAttribute('aria-invalid', 'true');
    document.getElementById(id).focus();
    return;
  }
  const caja = document.getElementById('area-error');
  caja.textContent = mensaje;
  caja.hidden = false;
}

function abrirModalArea(area, origen) {
  areaAbierta = area;
  botonQueAbrio = origen ?? document.activeElement;
  limpiarErroresArea();
  const valor = (campo, porDefecto = '') => (area ? (area[campo] ?? porDefecto) : porDefecto);
  document.getElementById('modal-area-titulo').textContent = area ? 'Editar área' : 'Nueva área';
  document.getElementById('a-nombre').value = valor('nombre');
  document.getElementById('a-articulo').value = valor('articulo', 'la');
  document.getElementById('a-superior').value = valor('area_superior');
  document.getElementById('a-articulo-superior').value = valor('articulo_superior');
  document.querySelectorAll('input[name="a-ambito"]').forEach(r => { r.checked = r.value === valor('ambito', 'municipal'); });
  document.getElementById('a-email-principal').value = valor('email_principal');
  document.getElementById('a-email-secundario').value = valor('email_secundario');
  document.getElementById('a-telefono').value = valor('telefono_area');
  document.getElementById('a-celular').value = valor('celular_area');
  document.getElementById('a-contacto').value = valor('nombre_contacto');
  document.getElementById('a-contacto-telefono').value = valor('telefono_contacto');
  document.getElementById('a-contacto-email').value = valor('email_contacto');
  const pie = document.getElementById('area-pie-izquierda');
  if (!area) pie.innerHTML = '<small>Se guarda al confirmar.</small>';
  else if (totalDeDatasets(area) === 0) pie.innerHTML = `<button type="button" class="ar-boton-texto" data-borrar-area="${area.id}">Borrar el área</button>`;
  else pie.innerHTML = `<small>${escA(`Tiene ${pluralA(totalDeDatasets(area), 'dataset', 'datasets')}: para borrarla, primero hay que pasarlos a otra área.`)}</small>`;
  actualizarLectura();
  document.getElementById('modal-area').classList.add('active');
  setTimeout(() => document.getElementById('a-nombre').focus(), 100);
}

function cerrarModalArea() {
  document.getElementById('modal-area').classList.remove('active');
  botonQueAbrio?.focus?.();
}

async function guardarArea() {
  limpiarErroresArea();
  const datos = datosDelFormularioArea(leerCampoArea);
  if (!datos.nombre) return mostrarErrorArea('Escribí el nombre del área.', 'nombre');
  const boton = document.getElementById('area-guardar');
  boton.disabled = true;
  try {
    const respuesta = areaAbierta
      ? await API.pedirJson('PUT', `/areas/${areaAbierta.id}`, datos)
      : await API.pedirJson('POST', '/areas', datos);
    showToast(respuesta.message || 'Área guardada', 'success');
    cerrarModalArea();
    await cargarAreas(true);
  } catch (error) {
    mostrarErrorArea(error.message, error.campo);
  } finally {
    boton.disabled = false;
  }
}

function pedirBorradoArea(id, origen) {
  const area = areasLista.find(a => a.id === id);
  botonQueAbrio = origen;
  document.getElementById('borrar-area-texto').textContent = `¿Borrar el área «${area.nombre}»? No tiene datasets. Se borra del todo y no se puede deshacer.`;
  document.getElementById('borrar-area-error').hidden = true;
  document.getElementById('borrar-area-confirmar').dataset.id = String(id);
  document.getElementById('modal-borrar-area').classList.add('active');
  setTimeout(() => document.querySelector('#modal-borrar-area [data-cerrar-borrar].ar-btn').focus(), 100);
}

function cerrarModalBorrar() {
  document.getElementById('modal-borrar-area').classList.remove('active');
  if (!document.getElementById('modal-area').classList.contains('active')) botonQueAbrio?.focus?.();
}

async function confirmarBorradoArea() {
  const boton = document.getElementById('borrar-area-confirmar');
  boton.disabled = true;
  try {
    const respuesta = await API.pedirJson('DELETE', `/areas/${boton.dataset.id}`);
    showToast(respuesta.message || 'Área borrada', 'success');
    document.getElementById('modal-borrar-area').classList.remove('active');
    document.getElementById('modal-area').classList.remove('active');
    areaDesplegada = null;
    await cargarAreas(true);
  } catch (error) {
    const caja = document.getElementById('borrar-area-error');
    caja.textContent = error.message;
    caja.hidden = false;
  } finally {
    boton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.isAdmin()) return;
  document.getElementById('buscar-area').addEventListener('input', pintarAreas);
  document.getElementById('btn-nueva-area').addEventListener('click', (evento) => abrirModalArea(null, evento.currentTarget));
  document.getElementById('vista-areas').addEventListener('click', (evento) => {
    const filtro = evento.target.closest('[data-filtro-area]');
    if (filtro) { filtroArea = filtro.dataset.filtroArea; return pintarAreas(); }
    const fila = evento.target.closest('[data-desplegar-area]');
    if (fila) { const id = Number(fila.dataset.desplegarArea); areaDesplegada = areaDesplegada === id ? null : id; pintarAreas(); return document.querySelector(`[data-desplegar-area="${id}"]`).focus(); }
    const editar = evento.target.closest('[data-editar-area]');
    if (editar) return abrirModalArea(areasLista.find(a => a.id === Number(editar.dataset.editarArea)), editar);
    const borrar = evento.target.closest('[data-borrar-area]');
    if (borrar) return pedirBorradoArea(Number(borrar.dataset.borrarArea), borrar);
  });
  document.getElementById('modal-area').addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar-area]')) return cerrarModalArea();
    const borrar = evento.target.closest('[data-borrar-area]');
    if (borrar) pedirBorradoArea(Number(borrar.dataset.borrarArea), borrar);
  });
  document.getElementById('modal-borrar-area').addEventListener('click', (evento) => {
    if (evento.target.closest('[data-cerrar-borrar]')) cerrarModalBorrar();
  });
  ['a-nombre', 'a-articulo', 'a-superior', 'a-articulo-superior'].forEach(id => document.getElementById(id).addEventListener('input', actualizarLectura));
  document.getElementById('area-guardar').addEventListener('click', guardarArea);
  document.getElementById('borrar-area-confirmar').addEventListener('click', confirmarBorradoArea);
  // Escape cierra primero la confirmación de borrar, después el modal del área
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    if (document.getElementById('modal-borrar-area').classList.contains('active')) cerrarModalBorrar();
    else if (document.getElementById('modal-area').classList.contains('active')) cerrarModalArea();
  });
});
