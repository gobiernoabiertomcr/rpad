// Areas - Lógica de gestión de áreas responsables
let areas = [];
let deleteId = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticación
  if (!Auth.isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  // Ocultar botón Nueva Área si es lector
  if (!Auth.isAdmin()) {
    document.getElementById('btn-nueva-area').style.display = 'none';
  }

  await loadAreas();
  setupSearch();
});

async function loadAreas() {
  try {
    areas = await API.getAreas();
    renderTable(areas);
  } catch (error) {
    console.error('Error cargando áreas:', error);
    Utils.showError('Error al cargar las áreas');
  }
}

function setupSearch() {
  const searchInput = document.getElementById('search');
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const term = searchInput.value.toLowerCase();
      const filtered = areas.filter(a => 
        a.nombre.toLowerCase().includes(term) ||
        (a.area_superior && a.area_superior.toLowerCase().includes(term)) ||
        (a.email_principal && a.email_principal.toLowerCase().includes(term)) ||
        (a.nombre_contacto && a.nombre_contacto.toLowerCase().includes(term))
      );
      renderTable(filtered);
    }, 300);
  });
}

function renderTable(data) {
  const tbody = document.getElementById('areas-tbody');
  
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">No hay áreas</td></tr>';
    return;
  }

  tbody.innerHTML = data.map(a => {
    const tieneEmail = a.email_principal || a.email_secundario;
    const emailIcon = tieneEmail 
      ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
      : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f59e0b;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';
    const emailTitle = tieneEmail ? 'Email configurado' : 'Sin email configurado';

    return `
      <tr>
        <td>
          <div class="area-nombre">${Utils.escapeHtml(a.nombre)}${a.ambito === 'externo' ? ' <span class="badge badge-secondary">Fuera del municipio</span>' : ''}</div>
        </td>
        <td class="text-small text-muted">${Utils.escapeHtml(a.area_superior || '-')}</td>
        <td>
          <span class="email-status" title="${emailTitle}">
            ${emailIcon}
            ${a.email_principal ? `<span class="text-small">${Utils.escapeHtml(a.email_principal)}</span>` : '<span class="text-small text-muted">-</span>'}
          </span>
        </td>
        <td class="text-small">${Utils.escapeHtml(a.nombre_contacto || '-')}</td>
        <td class="text-center">
          <span class="badge ${a.cantidad_datasets > 0 ? 'badge-primary' : 'badge-secondary'}">${a.cantidad_datasets || 0}</span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            ${Auth.isAdmin() ? `
            <button onclick="editArea(${a.id})" class="btn btn-secondary btn-sm" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></button>
            <button onclick="openDeleteModal(${a.id}, ${Utils.jsArg(a.nombre)})" class="btn btn-danger btn-sm" title="Eliminar" ${a.cantidad_datasets > 0 ? 'disabled style="filter: grayscale(100%); opacity: 0.5; pointer-events: none;"' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button>
            ` : '<span class="text-muted text-small">Solo lectura</span>'}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// =====================================================
// MODAL ÁREA
// =====================================================

function openAreaModal(area = null) {
  const modal = document.getElementById('modal-area');
  const form = document.getElementById('area-form');
  const title = document.getElementById('modal-title');

  form.reset();
  document.getElementById('area-id').value = '';

  if (area) {
    title.textContent = 'Editar Área';
    document.getElementById('area-id').value = area.id;
    document.getElementById('nombre').value = area.nombre || '';
    document.getElementById('articulo').value = area.articulo || 'la';
    document.getElementById('area_superior').value = area.area_superior || '';
    document.getElementById('articulo_superior').value = area.articulo_superior || '';
    document.getElementById('ambito').value = area.ambito || 'municipal';
    document.getElementById('email_principal').value = area.email_principal || '';
    document.getElementById('email_secundario').value = area.email_secundario || '';
    document.getElementById('telefono_area').value = area.telefono_area || '';
    document.getElementById('celular_area').value = area.celular_area || '';
    document.getElementById('nombre_contacto').value = area.nombre_contacto || '';
    document.getElementById('telefono_contacto').value = area.telefono_contacto || '';
    document.getElementById('email_contacto').value = area.email_contacto || '';
  } else {
    title.textContent = 'Nueva Área';
  }

  modal.classList.add('active');
  setTimeout(() => document.getElementById('nombre').focus(), 100);
}

function closeAreaModal() {
  document.getElementById('modal-area').classList.remove('active');
}

async function editArea(id) {
  const area = areas.find(a => a.id === id);
  if (area) {
    openAreaModal(area);
  }
}

// Submit formulario
document.getElementById('area-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const submitBtn = document.getElementById('submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Guardando...';

  const id = document.getElementById('area-id').value;
  const data = {
    nombre: document.getElementById('nombre').value,
    articulo: document.getElementById('articulo').value,
    area_superior: document.getElementById('area_superior').value || null,
    articulo_superior: document.getElementById('articulo_superior').value || null,
    ambito: document.getElementById('ambito').value,
    email_principal: document.getElementById('email_principal').value || null,
    email_secundario: document.getElementById('email_secundario').value || null,
    telefono_area: document.getElementById('telefono_area').value || null,
    celular_area: document.getElementById('celular_area').value || null,
    nombre_contacto: document.getElementById('nombre_contacto').value || null,
    telefono_contacto: document.getElementById('telefono_contacto').value || null,
    email_contacto: document.getElementById('email_contacto').value || null
  };

  try {
    if (id) {
      await API.updateArea(id, data);
      Utils.showSuccess('Área actualizada correctamente');
    } else {
      await API.createArea(data);
      Utils.showSuccess('Área creada correctamente');
    }
    closeAreaModal();
    await loadAreas();
  } catch (error) {
    Utils.showError(error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar';
  }
});

// =====================================================
// MODAL ELIMINAR
// =====================================================

function openDeleteModal(id, nombre) {
  deleteId = id;
  document.getElementById('delete-area-name').textContent = nombre;
  document.getElementById('modal-delete').classList.add('active');
}

function closeDeleteModal() {
  deleteId = null;
  document.getElementById('modal-delete').classList.remove('active');
}

async function confirmDelete() {
  if (!deleteId) return;

  try {
    await API.deleteArea(deleteId);
    Utils.showSuccess('Área eliminada correctamente');
    closeDeleteModal();
    await loadAreas();
  } catch (error) {
    Utils.showError(error.message);
  }
}
