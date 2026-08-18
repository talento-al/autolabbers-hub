// ============================================
// Autolab — Panel de reclutamiento
// Lee y escribe directo a Supabase (datos reales)
// ============================================

// ⚠️ CONFIGURACIÓN: reemplaza con tu publishable key de Supabase
const SUPABASE_URL = 'https://vzjqkgoivomdrsmussuc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Z9X-OEvE8q2lvUVjyoHZbQ_Hac5Ek3S';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Etapas del pipeline
const STAGES = [
  { id: 'aplicado',   name: 'Aplicado',   color: 'gray' },
  { id: 'screening',  name: 'Screening',  color: 'blue' },
  { id: 'entrevista', name: 'Entrevista', color: 'purple' },
  { id: 'oferta',     name: 'Oferta',     color: 'amber' },
  { id: 'contratado', name: 'Contratado', color: 'teal' },
  { id: 'rechazado',  name: 'Rechazado',  color: 'red' }
];

const INTERVIEW_TYPES = ['Cultural', 'Técnica', 'RH', 'Final'];

// Estado global
let state = {
  view: 'pipeline',
  vacancies: [],
  candidates: [],
  interviews: [],
  filterVacancy: 'all',
  searchQuery: '',
  user: null
};

// ============================================
// AUTH
// ============================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Verificar si ya hay sesión activa
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    state.user = session.user;
    showApp();
  } else {
    showLogin();
  }

  // Escuchar cambios de auth
  db.auth.onAuthStateChange((event, session) => {
    if (session) {
      state.user = session.user;
      showApp();
    } else {
      state.user = null;
      showLoginScreen();
    }
  });

  // Handlers de login/logout — doble seguridad (submit del form + click del botón)
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  loginForm.addEventListener('submit', handleLogin);
  loginBtn.addEventListener('click', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

async function handleLogin(e) {
  if (e) e.preventDefault();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  if (!email || !password) {
    errEl.textContent = 'Escribe tu email y contraseña.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';

  try {
    const { error } = await db.auth.signInWithPassword({ email, password });

    if (error) {
      errEl.textContent = 'Email o contraseña incorrectos. Verifica tus datos.';
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Entrar';
      return;
    }
    // onAuthStateChange se encarga de mostrar el panel
  } catch (err) {
    errEl.textContent = 'Error de conexión: ' + (err.message || 'intenta de nuevo.');
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

async function handleLogout() {
  await db.auth.signOut();
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';
  const btn = document.getElementById('login-btn');
  btn.disabled = false;
  btn.textContent = 'Entrar';
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';
  document.getElementById('user-email').textContent = state.user?.email || '';
  await loadAllData();
  bindToolbar();
  render();
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('admin-app').style.display = 'none';
}

// ============================================
// CARGA DE DATOS
// ============================================

async function loadAllData() {
  const [vac, cand, intv] = await Promise.all([
    db.from('vacancies').select('*').order('created_at', { ascending: false }),
    db.from('candidates').select('*').order('created_at', { ascending: false }),
    db.from('interviews').select('*').order('datetime', { ascending: true })
  ]);

  state.vacancies = vac.data || [];
  state.candidates = cand.data || [];
  state.interviews = intv.data || [];
}

async function reloadCandidates() {
  const { data } = await db.from('candidates').select('*').order('created_at', { ascending: false });
  state.candidates = data || [];
}
async function reloadVacancies() {
  const { data } = await db.from('vacancies').select('*').order('created_at', { ascending: false });
  state.vacancies = data || [];
}
async function reloadInterviews() {
  const { data } = await db.from('interviews').select('*').order('datetime', { ascending: true });
  state.interviews = data || [];
}

// ============================================
// HELPERS
// ============================================

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
function fmtDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function vacancyTitle(id) {
  const v = state.vacancies.find(x => x.id === id);
  return v ? v.title : '— Sin vacante —';
}
function fmtSalaryFull(n) {
  if (!n || isNaN(n)) return '';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Math.round(n));
}
function fmtSalaryCompact(n) {
  if (!n || isNaN(n)) return '';
  n = Math.round(n);
  return n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : '$' + n;
}
function stageInfo(id) {
  return STAGES.find(s => s.id === id) || STAGES[0];
}
function stageStyle(color) {
  return `background: var(--stage-${color}-bg); color: var(--stage-${color}-text);`;
}

// Extrae la primera nota (la de la aplicación inicial) para mostrarla como bloque
function getApplicationNote(candidate) {
  const notes = candidate.notes || [];
  const appNote = notes.find(n => n.author === 'Form de aplicación');
  return appNote ? appNote.text : null;
}
// Notas del equipo (excluye la de la aplicación inicial)
function getTeamNotes(candidate) {
  const notes = candidate.notes || [];
  return notes.filter(n => n.author !== 'Form de aplicación');
}

function filteredCandidates() {
  let cs = state.candidates;
  if (state.filterVacancy !== 'all') {
    cs = cs.filter(c => c.vacancy_id === state.filterVacancy);
  }
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    cs = cs.filter(c => {
      const corpus = [c.name, c.email, c.phone, c.availability, fmtSalaryFull(c.salary_expectation)]
        .join(' ').toLowerCase();
      return corpus.includes(q);
    });
  }
  return cs;
}

// ============================================
// TOOLBAR
// ============================================

function bindToolbar() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => { state.view = t.dataset.view; render(); });
  });
  document.getElementById('search-input').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    if (state.view === 'pipeline' || state.view === 'candidates') render();
  });
  document.getElementById('vacancy-filter').addEventListener('change', e => {
    state.filterVacancy = e.target.value;
    render();
  });
  document.getElementById('add-btn').addEventListener('click', () => {
    if (state.view === 'vacancies') openVacancyModal(null);
    else if (state.view === 'interviews') openInterviewModal(null);
    else openCandidateModal(null);
  });
}

// ============================================
// RENDER PRINCIPAL
// ============================================

function render() {
  // Tabs activos
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === state.view));

  // Filtro de vacantes
  const sel = document.getElementById('vacancy-filter');
  const curr = sel.value || 'all';
  sel.innerHTML = '<option value="all">Todas las vacantes</option>' +
    state.vacancies.map(v => `<option value="${v.id}">${escapeHtml(v.title)}</option>`).join('');
  sel.value = state.vacancies.find(v => v.id === curr) ? curr : 'all';
  state.filterVacancy = sel.value;

  // Botón agregar: texto según vista
  const addBtn = document.getElementById('add-btn');
  if (state.view === 'vacancies') addBtn.textContent = '+ Nueva vacante';
  else if (state.view === 'interviews') addBtn.textContent = '+ Nueva entrevista';
  else addBtn.textContent = '+ Nuevo candidato';

  const container = document.getElementById('view-container');
  if (state.view === 'pipeline') container.innerHTML = renderPipeline();
  else if (state.view === 'candidates') container.innerHTML = renderCandidatesTable();
  else if (state.view === 'vacancies') container.innerHTML = renderVacancies();
  else if (state.view === 'interviews') container.innerHTML = renderInterviews();

  attachHandlers();
  updateStatus();
}

function updateStatus() {
  const openVac = state.vacancies.filter(v => v.status === 'abierta').length;
  document.getElementById('status-bar').textContent =
    `${state.candidates.length} candidatos · ${openVac} vacantes abiertas · ${state.interviews.length} entrevistas`;
}

// ============================================
// VISTA: PIPELINE (kanban)
// ============================================

function renderPipeline() {
  const cs = filteredCandidates();
  let html = '<div class="kanban">';
  STAGES.forEach(stage => {
    const stageCands = cs.filter(c => c.stage === stage.id);
    html += `<div class="kanban-col" data-stage="${stage.id}">
      <div class="kanban-col-header">
        <span>${stage.name}</span>
        <span class="count">${stageCands.length}</span>
      </div>`;
    if (stageCands.length === 0) {
      html += '<div class="col-empty">—</div>';
    } else {
      stageCands.forEach(c => {
        const tags = [];
        if (c.salary_expectation) tags.push(`<span class="cand-tag cand-tag-salary">${fmtSalaryCompact(c.salary_expectation)}</span>`);
        if (c.availability) tags.push(`<span class="cand-tag">${escapeHtml(c.availability)}</span>`);
        html += `<div class="cand-card" draggable="true" data-id="${c.id}">
          <div class="cand-card-name">${escapeHtml(c.name)}</div>
          <div class="cand-card-role">${escapeHtml(vacancyTitle(c.vacancy_id))}</div>
          <div class="cand-card-meta">${tags.join('')}<span class="cand-card-date">${fmtDate(c.created_at)}</span></div>
        </div>`;
      });
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ============================================
// VISTA: CANDIDATOS (tabla)
// ============================================

function renderCandidatesTable() {
  const cs = filteredCandidates();
  if (cs.length === 0) {
    return '<div class="empty-view">No hay candidatos que coincidan. Agrega uno con el botón de arriba o ajusta el filtro.</div>';
  }
  let html = `<table class="data-table">
    <thead><tr>
      <th>Nombre</th><th>Vacante</th><th>Etapa</th>
      <th>Salario</th><th>Disponibilidad</th><th>Email</th><th>Fecha</th>
    </tr></thead><tbody>`;
  cs.forEach(c => {
    const st = stageInfo(c.stage);
    html += `<tr class="clickable" data-id="${c.id}">
      <td class="td-strong">${escapeHtml(c.name)}</td>
      <td>${escapeHtml(vacancyTitle(c.vacancy_id))}</td>
      <td><span class="stage-pill" style="${stageStyle(st.color)}">${st.name}</span></td>
      <td class="tabular">${fmtSalaryFull(c.salary_expectation)}</td>
      <td>${escapeHtml(c.availability || '')}</td>
      <td class="td-muted">${escapeHtml(c.email || '')}</td>
      <td class="td-tertiary">${fmtDate(c.created_at)}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ============================================
// VISTA: VACANTES
// ============================================

function renderVacancies() {
  if (state.vacancies.length === 0) {
    return '<div class="empty-view">No hay vacantes todavía. Crea la primera con el botón de arriba.</div>';
  }
  let html = '';
  state.vacancies.forEach(v => {
    const total = state.candidates.filter(c => c.vacancy_id === v.id).length;
    const hired = state.candidates.filter(c => c.vacancy_id === v.id && c.stage === 'contratado').length;
    const statusColor = v.status === 'abierta' ? 'teal' : 'gray';
    html += `<div class="vac-card" data-id="${v.id}">
      <div>
        <div class="vac-card-title">${escapeHtml(v.title)}</div>
        <div class="vac-card-dept">${escapeHtml(v.department || 'Sin departamento')}</div>
      </div>
      <div class="vac-card-stats">
        <span><strong>${total}</strong> candidatos</span>
        <span><strong>${hired}</strong> contratados</span>
        <span class="stage-pill" style="${stageStyle(statusColor)}">${escapeHtml(v.status)}</span>
      </div>
    </div>`;
  });
  return html;
}

// ============================================
// VISTA: ENTREVISTAS
// ============================================

function renderInterviews() {
  if (state.interviews.length === 0) {
    return '<div class="empty-view">No hay entrevistas programadas. Agenda una con el botón de arriba.</div>';
  }
  const sorted = [...state.interviews].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  let html = `<table class="data-table">
    <thead><tr>
      <th>Candidato</th><th>Fecha y hora</th><th>Tipo</th><th>Entrevistador</th><th>Link</th>
    </tr></thead><tbody>`;
  sorted.forEach(i => {
    const cand = state.candidates.find(c => c.id === i.candidate_id);
    const isPast = new Date(i.datetime) < new Date();
    html += `<tr class="clickable" data-id="${i.id}" style="${isPast ? 'opacity:0.55;' : ''}">
      <td class="td-strong">${escapeHtml(cand ? cand.name : '— eliminado —')}</td>
      <td>${fmtDateTime(i.datetime)}</td>
      <td>${escapeHtml(i.type || '')}</td>
      <td>${escapeHtml(i.interviewer || '')}</td>
      <td>${i.meet_url ? `<a href="${escapeHtml(i.meet_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="color:var(--color-green-light-text);text-decoration:underline;">abrir</a>` : '—'}</td>
    </tr>`;
  });
  html += '</tbody></table>';
  return html;
}

// ============================================
// HANDLERS: drag-and-drop + clicks
// ============================================

function attachHandlers() {
  // Clicks en tarjetas de candidato (kanban) y filas de tabla
  document.querySelectorAll('.cand-card').forEach(card => {
    card.addEventListener('click', e => {
      // No abrir modal si se está arrastrando
      if (card.classList.contains('dragging')) return;
      openCandidateModal(card.dataset.id);
    });
  });

  document.querySelectorAll('.data-table tr.clickable').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.dataset.id;
      if (state.view === 'candidates') openCandidateModal(id);
      else if (state.view === 'interviews') openInterviewModal(id);
    });
  });

  document.querySelectorAll('.vac-card').forEach(card => {
    card.addEventListener('click', () => openVacancyModal(card.dataset.id));
  });

  // Drag and drop en kanban
  let draggedId = null;

  document.querySelectorAll('.cand-card[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedId = null;
    });
  });

  document.querySelectorAll('.kanban-col').forEach(col => {
    col.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.classList.add('drag-over');
    });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.classList.remove('drag-over');
      if (!draggedId) return;
      const newStage = col.dataset.stage;
      const cand = state.candidates.find(c => c.id === draggedId);
      if (!cand || cand.stage === newStage) return;

      // Optimistic update
      const oldStage = cand.stage;
      cand.stage = newStage;
      render();

      const { error } = await supabase
        .from('candidates')
        .update({ stage: newStage })
        .eq('id', draggedId);

      if (error) {
        cand.stage = oldStage;
        render();
        alert('No se pudo mover el candidato. Intenta de nuevo.');
      }
    });
  });
}

// ============================================
// MODAL HELPERS
// ============================================

function showModal(html, wide = false) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" id="modal-overlay">
    <div class="modal ${wide ? 'modal-wide' : ''}">${html}</div>
  </div>`;
  // Cerrar al hacer click fuera
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  // Cerrar con Escape
  document.addEventListener('keydown', escClose);
}

function escClose(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
  document.removeEventListener('keydown', escClose);
}

// ============================================
// MODAL: CANDIDATO
// ============================================

function openCandidateModal(id) {
  const isNew = !id;
  const c = isNew ? {
    name: '', email: '', phone: '', vacancy_id: null, stage: 'aplicado',
    cv_url: '', availability: '', salary_expectation: null, notes: []
  } : state.candidates.find(x => x.id === id);

  if (!c) return;

  const appNote = getApplicationNote(c);
  const teamNotes = getTeamNotes(c);

  const vacancyOptions = '<option value="">— Sin vacante (general) —</option>' +
    state.vacancies.map(v =>
      `<option value="${v.id}" ${v.id === c.vacancy_id ? 'selected' : ''}>${escapeHtml(v.title)}</option>`
    ).join('');

  const stageOptions = STAGES.map(s =>
    `<option value="${s.id}" ${s.id === c.stage ? 'selected' : ''}>${s.name}</option>`
  ).join('');

  // Preview del CV + botón de subida
  const uploadControl = `
    <div class="cv-upload">
      <input type="file" id="c-cvfile" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none;" onchange="handleCvUpload(this)" />
      <button class="btn btn-ghost btn-sm btn-block" onclick="document.getElementById('c-cvfile').click()">
        ${c.cv_url ? 'Reemplazar CV' : '⬆ Subir CV'}
      </button>
      <div id="cv-upload-status" class="cv-upload-status"></div>
    </div>`;

  let cvBlock;
  if (c.cv_url) {
    cvBlock = `
      <iframe class="cv-preview-frame" src="${escapeHtml(c.cv_url)}#toolbar=0" title="CV"></iframe>
      <div class="cv-actions">
        <a href="${escapeHtml(c.cv_url)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-block">Abrir CV en grande ↗</a>
      </div>
      ${uploadControl}`;
  } else {
    cvBlock = `
      <div class="cv-preview-empty">
        Sube el CV para verlo aquí y llenar automáticamente nombre, email y teléfono.
      </div>
      ${uploadControl}`;
  }

  const notesHtml = teamNotes.length === 0
    ? '<div class="note-empty">Sin notas del equipo todavía.</div>'
    : teamNotes.map(n => `<div class="note-item">
        <div class="note-meta">${escapeHtml(n.author || 'Equipo')} · ${fmtDateTime(n.createdAt)}</div>
        <div class="note-text">${escapeHtml(n.text)}</div>
      </div>`).join('');

  const html = `
    <div class="modal-header">
      <h2>${isNew ? 'Nuevo candidato' : escapeHtml(c.name)}</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>

    <div class="cand-detail-grid">
      <div class="cand-detail-info">
        <div class="field-row cols-2">
          <div class="field">
            <label>Nombre</label>
            <input id="c-name" value="${escapeHtml(c.name)}" />
          </div>
          <div class="field">
            <label>Etapa</label>
            <select id="c-stage">${stageOptions}</select>
          </div>
        </div>

        <div class="field">
          <label>Vacante</label>
          <select id="c-vacancy">${vacancyOptions}</select>
        </div>

        <div class="field-row cols-2">
          <div class="field">
            <label>Email</label>
            <input id="c-email" value="${escapeHtml(c.email)}" />
          </div>
          <div class="field">
            <label>Teléfono</label>
            <input id="c-phone" value="${escapeHtml(c.phone)}" />
          </div>
        </div>

        <div class="field-row cols-2">
          <div class="field">
            <label>Expectativa salarial (MXN)</label>
            <div class="salary-wrap"><input id="c-salary" type="number" value="${c.salary_expectation || ''}" /></div>
          </div>
          <div class="field">
            <label>Disponibilidad</label>
            <input id="c-availability" value="${escapeHtml(c.availability || '')}" />
          </div>
        </div>

        <div class="field">
          <label>CV (URL)</label>
          <input id="c-cvurl" value="${escapeHtml(c.cv_url || '')}" placeholder="https://..." />
        </div>

        ${appNote ? `
          <div class="field">
            <label>Datos de la aplicación</label>
            <div class="app-info">${escapeHtml(appNote)}</div>
          </div>` : ''}

        <div class="field">
          <label>Notas del equipo</label>
          <div class="notes-list">${notesHtml}</div>
          <div class="note-add">
            <input id="note-author" class="note-author" placeholder="Tu nombre" value="${escapeHtml(defaultAuthorName())}" />
            <input id="note-text" placeholder="Escribe una nota..." />
            <button class="btn btn-ghost btn-sm" onclick="addNote('${c.id || ''}')">Agregar</button>
          </div>
        </div>
      </div>

      <div class="cand-detail-cv">
        <label class="detail-label">Curriculum</label>
        ${cvBlock}
      </div>
    </div>

    <div class="modal-actions">
      ${!isNew ? `<button class="btn btn-danger push-left" onclick="deleteCandidate('${c.id}')">Eliminar</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="c-save" onclick="saveCandidate('${c.id || ''}')">${isNew ? 'Crear candidato' : 'Guardar cambios'}</button>
    </div>
  `;

  showModal(html, true);
}

function defaultAuthorName() {
  // Usa la parte antes del @ del email del usuario logueado
  const email = state.user?.email || '';
  const namePart = email.split('@')[0] || '';
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}

async function saveCandidate(id) {
  const isNew = !id;
  const payload = {
    name: document.getElementById('c-name').value.trim(),
    email: document.getElementById('c-email').value.trim(),
    phone: document.getElementById('c-phone').value.trim(),
    vacancy_id: document.getElementById('c-vacancy').value || null,
    stage: document.getElementById('c-stage').value,
    cv_url: document.getElementById('c-cvurl').value.trim() || null,
    availability: document.getElementById('c-availability').value.trim() || null,
    salary_expectation: parseInt(document.getElementById('c-salary').value, 10) || null
  };

  if (!payload.name) { alert('El nombre es obligatorio.'); return; }

  const btn = document.getElementById('c-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  let error;
  if (isNew) {
    payload.notes = [];
    ({ error } = await db.from('candidates').insert(payload));
  } else {
    ({ error } = await db.from('candidates').update(payload).eq('id', id));
  }

  if (error) {
    alert('Error al guardar: ' + error.message);
    btn.disabled = false;
    btn.textContent = isNew ? 'Crear candidato' : 'Guardar cambios';
    return;
  }

  await reloadCandidates();
  closeModal();
  render();
}

async function addNote(id) {
  if (!id) { alert('Guarda el candidato primero, luego agrega notas.'); return; }
  const author = document.getElementById('note-author').value.trim() || 'Equipo';
  const text = document.getElementById('note-text').value.trim();
  if (!text) return;

  const cand = state.candidates.find(c => c.id === id);
  if (!cand) return;

  const notes = Array.isArray(cand.notes) ? [...cand.notes] : [];
  notes.push({ text, author, createdAt: new Date().toISOString() });

  const { error } = await db.from('candidates').update({ notes }).eq('id', id);
  if (error) { alert('No se pudo guardar la nota: ' + error.message); return; }

  cand.notes = notes;
  openCandidateModal(id); // re-render del modal con la nota nueva
}

async function deleteCandidate(id) {
  if (!confirm('¿Eliminar este candidato? Esta acción no se puede deshacer. (El CV en storage no se borra.)')) return;
  const { error } = await db.from('candidates').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  await reloadCandidates();
  closeModal();
  render();
}

// ============================================
// MODAL: VACANTE
// ============================================

function openVacancyModal(id) {
  const isNew = !id;
  const v = isNew
    ? { title: '', department: '', status: 'abierta', description: '' }
    : state.vacancies.find(x => x.id === id);

  if (!v) return;

  const html = `
    <div class="modal-header">
      <h2>${isNew ? 'Nueva vacante' : 'Editar vacante'}</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>

    <div class="field">
      <label>Título</label>
      <input id="v-title" value="${escapeHtml(v.title)}" placeholder="Ej. Coordinador/a de Servicios" />
    </div>

    <div class="field-row cols-2">
      <div class="field">
        <label>Departamento</label>
        <input id="v-department" value="${escapeHtml(v.department || '')}" placeholder="Ej. Operaciones" />
      </div>
      <div class="field">
        <label>Estado</label>
        <select id="v-status">
          <option value="abierta" ${v.status === 'abierta' ? 'selected' : ''}>Abierta (visible en el sitio)</option>
          <option value="cerrada" ${v.status === 'cerrada' ? 'selected' : ''}>Cerrada (oculta del sitio)</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label>Descripción</label>
      <div class="field-hint">Puedes usar markdown: <strong>## Título</strong>, <strong>**negrita**</strong>, <strong>- viñetas</strong>. Se ve con formato en el sitio público.</div>
      <textarea id="v-description" rows="10" style="min-height:180px; font-family:monospace; font-size:13px;">${escapeHtml(v.description || '')}</textarea>
    </div>

    <div class="modal-actions">
      ${!isNew ? `<button class="btn btn-danger push-left" onclick="deleteVacancy('${v.id}')">Eliminar</button>` : ''}
      <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="v-save" onclick="saveVacancy('${v.id || ''}')">${isNew ? 'Crear vacante' : 'Guardar cambios'}</button>
    </div>
  `;

  showModal(html);
}

async function saveVacancy(id) {
  const isNew = !id;
  const payload = {
    title: document.getElementById('v-title').value.trim(),
    department: document.getElementById('v-department').value.trim() || null,
    status: document.getElementById('v-status').value,
    description: document.getElementById('v-description').value.trim() || null
  };

  if (!payload.title) { alert('El título es obligatorio.'); return; }

  const btn = document.getElementById('v-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  let error;
  if (isNew) {
    ({ error } = await db.from('vacancies').insert(payload));
  } else {
    ({ error } = await db.from('vacancies').update(payload).eq('id', id));
  }

  if (error) {
    alert('Error al guardar: ' + error.message);
    btn.disabled = false;
    btn.textContent = isNew ? 'Crear vacante' : 'Guardar cambios';
    return;
  }

  await reloadVacancies();
  closeModal();
  render();
}

async function deleteVacancy(id) {
  const linked = state.candidates.filter(c => c.vacancy_id === id).length;
  const warning = linked > 0
    ? `Esta vacante tiene ${linked} candidato(s) asociado(s). Si la eliminas, esos candidatos quedarán sin vacante (no se borran). ¿Continuar?`
    : '¿Eliminar esta vacante? Esta acción no se puede deshacer.';
  if (!confirm(warning)) return;

  const { error } = await db.from('vacancies').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  await Promise.all([reloadVacancies(), reloadCandidates()]);
  closeModal();
  render();
}

// ============================================
// MODAL: ENTREVISTA
// ============================================

function openInterviewModal(id) {
  const isNew = !id;
  const iv = isNew
    ? { candidate_id: '', datetime: '', type: 'Cultural', interviewer: '', meet_url: '' }
    : state.interviews.find(x => x.id === id);

  if (!iv) return;

  // Convertir datetime ISO a formato datetime-local (YYYY-MM-DDTHH:mm)
  let dtLocal = '';
  if (iv.datetime) {
    const d = new Date(iv.datetime);
    // Ajustar a hora local para el input
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    dtLocal = local.toISOString().slice(0, 16);
  }

  const candOptions = '<option value="">— Selecciona candidato —</option>' +
    state.candidates.map(c =>
      `<option value="${c.id}" ${c.id === iv.candidate_id ? 'selected' : ''}>${escapeHtml(c.name)} · ${escapeHtml(vacancyTitle(c.vacancy_id))}</option>`
    ).join('');

  const typeOptions = INTERVIEW_TYPES.map(t =>
    `<option value="${t}" ${t === iv.type ? 'selected' : ''}>${t}</option>`
  ).join('');

  const html = `
    <div class="modal-header">
      <h2>${isNew ? 'Nueva entrevista' : 'Editar entrevista'}</h2>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>

    <div class="field">
      <label>Candidato</label>
      <select id="i-candidate">${candOptions}</select>
    </div>

    <div class="field-row cols-2">
      <div class="field">
        <label>Fecha y hora</label>
        <input id="i-datetime" type="datetime-local" value="${dtLocal}" />
      </div>
      <div class="field">
        <label>Tipo</label>
        <select id="i-type">${typeOptions}</select>
      </div>
    </div>

    <div class="field">
      <label>Entrevistador</label>
      <input id="i-interviewer" value="${escapeHtml(iv.interviewer || '')}" placeholder="Ej. Sofía" />
    </div>

    <div class="field">
      <label>Link de la reunión (Meet / Zoom)</label>
      <input id="i-meeturl" value="${escapeHtml(iv.meet_url || '')}" placeholder="https://meet.google.com/..." />
    </div>

    <div class="modal-actions">
      ${!isNew ? `<button class="btn btn-danger push-left" onclick="deleteInterview('${iv.id}')">Eliminar</button>` : ''}
      <button class="btn btn-ghost" onclick="addToGoogleCalendar()">+ Google Calendar</button>
      <button class="btn btn-primary" id="i-save" onclick="saveInterview('${iv.id || ''}')">${isNew ? 'Agendar' : 'Guardar cambios'}</button>
    </div>
  `;

  showModal(html);
}

function collectInterviewForm() {
  const dtVal = document.getElementById('i-datetime').value;
  return {
    candidate_id: document.getElementById('i-candidate').value || null,
    datetime: dtVal ? new Date(dtVal).toISOString() : null,
    type: document.getElementById('i-type').value,
    interviewer: document.getElementById('i-interviewer').value.trim() || null,
    meet_url: document.getElementById('i-meeturl').value.trim() || null
  };
}

async function saveInterview(id) {
  const isNew = !id;
  const payload = collectInterviewForm();

  if (!payload.candidate_id) { alert('Selecciona un candidato.'); return; }
  if (!payload.datetime) { alert('Indica fecha y hora.'); return; }

  const btn = document.getElementById('i-save');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Guardando...';

  let error;
  if (isNew) {
    ({ error } = await db.from('interviews').insert(payload));
  } else {
    ({ error } = await db.from('interviews').update(payload).eq('id', id));
  }

  if (error) {
    alert('Error al guardar: ' + error.message);
    btn.disabled = false;
    btn.textContent = isNew ? 'Agendar' : 'Guardar cambios';
    return;
  }

  await reloadInterviews();
  closeModal();
  render();
}

async function deleteInterview(id) {
  if (!confirm('¿Eliminar esta entrevista?')) return;
  const { error } = await db.from('interviews').delete().eq('id', id);
  if (error) { alert('Error al eliminar: ' + error.message); return; }
  await reloadInterviews();
  closeModal();
  render();
}

function addToGoogleCalendar() {
  const form = collectInterviewForm();
  if (!form.candidate_id || !form.datetime) {
    alert('Selecciona candidato y fecha/hora primero.');
    return;
  }

  const cand = state.candidates.find(c => c.id === form.candidate_id);
  const candName = cand ? cand.name : 'Candidato';
  const role = cand ? vacancyTitle(cand.vacancy_id) : '';

  // Formatear fechas para Google Calendar (formato: YYYYMMDDTHHMMSSZ)
  const start = new Date(form.datetime);
  const end = new Date(start.getTime() + 45 * 60000); // 45 min por defecto
  const fmt = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const title = encodeURIComponent(`Entrevista ${form.type} — ${candName}`);
  const details = encodeURIComponent(
    `Entrevista ${form.type} con ${candName}\n` +
    `Vacante: ${role}\n` +
    (form.interviewer ? `Entrevistador: ${form.interviewer}\n` : '') +
    (cand?.email ? `Email candidato: ${cand.email}\n` : '') +
    (cand?.phone ? `Teléfono: ${cand.phone}\n` : '')
  );
  const location = encodeURIComponent(form.meet_url || '');

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${title}` +
    `&dates=${fmt(start)}/${fmt(end)}` +
    `&details=${details}` +
    `&location=${location}`;

  window.open(url, '_blank', 'noopener');
}

// ============================================
// SUBIR CV + EXTRACCIÓN AUTOMÁTICA
// ============================================
// Nota: pdf.js se carga como módulo ES en admin.html y se expone
// como window.pdfjsLib (con su worker ya configurado).

async function handleCvUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const statusEl = document.getElementById('cv-upload-status');

  // Validar tamaño (10 MB máx, igual que el form público)
  if (file.size > 10 * 1024 * 1024) {
    statusEl.innerHTML = '<span class="cv-status-error">El archivo supera 10 MB.</span>';
    return;
  }

  // 1. Subir a Supabase Storage
  statusEl.innerHTML = '<span class="spinner"></span> Subiendo CV...';
  let cvUrl;
  try {
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;
    const filePath = `applications/${fileName}`;

    const { error: upErr } = await db.storage
      .from('cvs')
      .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });

    if (upErr) throw upErr;

    const { data: urlData } = db.storage.from('cvs').getPublicUrl(filePath);
    cvUrl = urlData.publicUrl;

    // Poner la URL en el campo (para que se guarde con el candidato)
    document.getElementById('c-cvurl').value = cvUrl;
  } catch (err) {
    statusEl.innerHTML = `<span class="cv-status-error">Error al subir: ${escapeHtml(err.message || 'intenta de nuevo')}</span>`;
    return;
  }

  // 2. Extraer texto y parsear datos
  statusEl.innerHTML = '<span class="spinner"></span> Leyendo CV...';
  let text = '';
  try {
    text = await extractTextFromFile(file);
  } catch (err) {
    console.warn('No se pudo leer el CV:', err);
    statusEl.innerHTML = '<span class="cv-status-warn">✓ CV subido, pero no pudimos leer el texto (¿es un PDF escaneado?). Llena los datos a mano.</span>';
    // Aún así refrescamos el preview con el CV subido
    refreshCvPreview(cvUrl);
    return;
  }

  if (!text || text.trim().length < 20) {
    statusEl.innerHTML = '<span class="cv-status-warn">✓ CV subido, pero casi no tiene texto legible (¿escaneado?). Llena los datos a mano.</span>';
    refreshCvPreview(cvUrl);
    return;
  }

  // 3. Parsear con regex
  const parsed = parseCvText(text);

  // 4. Rellenar campos vacíos (no pisar lo que ya escribió el usuario)
  let filled = [];
  if (parsed.email && !document.getElementById('c-email').value.trim()) {
    setAutoField('c-email', parsed.email);
    filled.push('email');
  }
  if (parsed.phone && !document.getElementById('c-phone').value.trim()) {
    setAutoField('c-phone', parsed.phone);
    filled.push('teléfono');
  }
  if (parsed.name && !document.getElementById('c-name').value.trim()) {
    setAutoField('c-name', parsed.name);
    filled.push('nombre');
  }

  // 5. Mensaje de resultado
  if (filled.length > 0) {
    statusEl.innerHTML = `<span class="cv-status-ok">✓ CV subido. Detectamos: ${filled.join(', ')}. <strong>Revisa que esté correcto</strong> antes de guardar.</span>`;
  } else {
    statusEl.innerHTML = '<span class="cv-status-warn">✓ CV subido, pero no detectamos datos claros. Llena los campos a mano.</span>';
  }

  refreshCvPreview(cvUrl);
}

// Marca un campo como autocompletado (visualmente) y le pone el valor
function setAutoField(id, value) {
  const el = document.getElementById(id);
  el.value = value;
  el.classList.add('auto-filled');
  // Al editarlo manualmente, se quita la marca
  el.addEventListener('input', () => el.classList.remove('auto-filled'), { once: true });
}

// Refresca el iframe de preview tras subir un CV nuevo (sin cerrar el modal)
function refreshCvPreview(cvUrl) {
  const cvCol = document.querySelector('.cand-detail-cv');
  if (!cvCol) return;
  const existingFrame = cvCol.querySelector('.cv-preview-frame');
  const emptyBox = cvCol.querySelector('.cv-preview-empty');
  if (existingFrame) {
    existingFrame.src = cvUrl + '#toolbar=0';
  } else if (emptyBox) {
    // Reemplazar el placeholder vacío por un iframe real
    emptyBox.outerHTML = `<iframe class="cv-preview-frame" src="${escapeHtml(cvUrl)}#toolbar=0" title="CV"></iframe>
      <div class="cv-actions">
        <a href="${escapeHtml(cvUrl)}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm btn-block">Abrir CV en grande ↗</a>
      </div>`;
  }
}

// ============================================
// EXTRACCIÓN DE TEXTO (PDF / Word)
// ============================================

async function extractTextFromFile(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return await extractPdfText(file);
  }
  if (name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
    return await extractDocxText(file);
  }
  if (name.endsWith('.doc')) {
    // .doc viejo (binario) no es legible por mammoth de forma confiable
    throw new Error('Formato .doc antiguo no legible');
  }
  throw new Error('Formato no soportado para lectura');
}

async function extractPdfText(file) {
  // Esperar a que pdf.js (módulo ES) termine de cargar, si aún no está
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('pdf.js no cargó a tiempo')), 8000);
      window.addEventListener('pdfjs-ready', () => { clearTimeout(timeout); resolve(); }, { once: true });
      // Por si ya cargó entre el check y el listener
      if (window.pdfjsLib) { clearTimeout(timeout); resolve(); }
    });
  }
  if (!window.pdfjsLib) throw new Error('pdf.js no disponible');

  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = '';
  // Leer hasta las primeras 3 páginas (los datos de contacto están al inicio)
  const maxPages = Math.min(pdf.numPages, 3);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  return fullText;
}

async function extractDocxText(file) {
  if (!window.mammoth) throw new Error('mammoth no cargó');
  const buf = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
  return result.value || '';
}

// ============================================
// PARSING CON REGEX
// ============================================

function parseCvText(text) {
  return {
    email: extractEmail(text),
    phone: extractPhone(text),
    name: extractName(text)
  };
}

function extractEmail(text) {
  // Busca el primer email válido
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : '';
}

function extractPhone(text) {
  // Buscar patrones de teléfono mexicano: 10 dígitos, con posible +52, espacios, guiones, paréntesis
  // Normalizamos quitando separadores y validamos longitud
  const candidates = text.match(/(\+?52[\s-]?)?(\(?\d{2,3}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}/g);
  if (!candidates) return '';
  for (const cand of candidates) {
    const digits = cand.replace(/\D/g, '');
    // Teléfono MX válido: 10 dígitos, o 12-13 con lada país
    if (digits.length === 10) return formatPhone(digits);
    if (digits.length === 12 && digits.startsWith('52')) return formatPhone(digits.slice(2));
    if (digits.length === 13 && digits.startsWith('521')) return formatPhone(digits.slice(3));
  }
  return '';
}

function formatPhone(d) {
  // 10 dígitos → "55 1234 5678"
  if (d.length === 10) return `${d.slice(0,2)} ${d.slice(2,6)} ${d.slice(6)}`;
  return d;
}

function extractName(text) {
  // Estrategia: el nombre suele estar en las primeras líneas del CV,
  // antes del email/teléfono, sin números ni símbolos.
  const lines = text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    const line = lines[i];
    // Saltar líneas con email, teléfono, o palabras típicas de encabezado
    if (/@|\d{4}|curriculum|vitae|resume|cv\b/i.test(line)) continue;
    // Un nombre razonable: 2-4 palabras, solo letras (con acentos), largo 5-50
    if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(\s+[A-ZÁÉÍÓÚÑa-záéíóúñ.]+){1,3}$/.test(line) &&
        line.length >= 5 && line.length <= 50) {
      return titleCase(line);
    }
    // También aceptar nombres en MAYÚSCULAS (común en CVs)
    if (/^[A-ZÁÉÍÓÚÑ]+(\s+[A-ZÁÉÍÓÚÑ]+){1,3}$/.test(line) &&
        line.length >= 5 && line.length <= 50) {
      return titleCase(line);
    }
  }
  return '';
}

function titleCase(str) {
  // Capitaliza la primera letra de cada palabra, respetando acentos.
  // Separa por espacios y procesa cada palabra individualmente.
  return str.toLowerCase().split(/\s+/).map(word => {
    if (!word) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}
