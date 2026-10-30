const list = document.querySelector('#task-list');
const toast = document.querySelector('#toast');
let tasks = [];
let filter = 'todas';
let toastTimer;

function notify(message) {
  toast.textContent = message; toast.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

async function request(path, options) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error || 'Não foi possível concluir a operação.');
  return payload;
}

function render() {
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#done-count').textContent = tasks.filter(t => t.concluida).length;
  document.querySelector('#task-label').textContent = `${tasks.length} ${tasks.length === 1 ? 'tarefa' : 'tarefas'}`;
  const visible = tasks.filter(t => filter === 'todas' || (filter === 'pendentes' && !t.concluida) || (filter === 'concluidas' && t.concluida));
  if (!visible.length) { list.innerHTML = '<div class="empty">Nada por aqui ainda. Adicione uma tarefa para começar.</div>'; return; }
  list.innerHTML = visible.map(task => `<article class="task-row ${task.concluida ? 'done' : ''}">
    <button class="check" data-action="toggle" data-id="${task.id}" aria-label="${task.concluida ? 'Marcar como pendente' : 'Concluir tarefa'}">${task.concluida ? '✓' : ''}</button>
    <div class="task-copy"><strong>${escapeHtml(task.titulo)}</strong>${task.descricao ? `<p>${escapeHtml(task.descricao)}</p>` : ''}</div>
    <span class="task-date">${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(task.created_at))}</span>
    <button class="delete" data-action="delete" data-id="${task.id}" aria-label="Excluir tarefa">×</button>
  </article>`).join('');
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

async function load() {
  list.innerHTML = '<div class="loading">Carregando suas tarefas…</div>';
  try { tasks = await request('/api/tarefas'); render(); await loadMetrics(); }
  catch (e) { list.innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`; notify(e.message); }
}

async function loadMetrics() {
  try {
    const m = await request('/api/metricas');
    const total = m.acertos + m.falhas;
    document.querySelector('#cache-count').textContent = `${m.acertos} / ${total}`;
    document.querySelector('#cache-detail').textContent = `${m.acertos} acertos · ${m.falhas} consultas ao banco`;
  } catch { document.querySelector('#cache-count').textContent = 'Ativo'; document.querySelector('#cache-detail').textContent = 'Métricas disponíveis com a integração'; }
}

async function status() {
  const box = document.querySelector('#status'); const text = document.querySelector('#status-text');
  try {
    const data = await request('/api/status');
    if (data.configured && data.banco === 'conectado') { text.textContent = 'Supabase conectado · Redis respondeu ' + data.cache + ' · Cache de tarefas válido por 60 segundos'; }
    else if (!data.configured) { box.classList.add('warn'); text.textContent = 'Modo demonstração local · Configure as credenciais no .env para ativar Supabase e Redis'; }
    else { box.classList.add('error'); text.textContent = `Falha na conexão dos serviços: ${data.erro}`; }
  } catch { box.classList.add('error'); text.textContent = 'Não foi possível verificar os serviços.'; }
}

document.querySelector('#task-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.currentTarget;
  try { await request('/api/tarefas', { method: 'POST', body: JSON.stringify({ titulo: document.querySelector('#task-title').value, descricao: document.querySelector('#task-description').value }) }); form.reset(); await load(); notify('Tarefa adicionada.'); }
  catch (err) { notify(err.message); }
});

list.addEventListener('click', async e => {
  const button = e.target.closest('[data-action]'); if (!button) return;
  const task = tasks.find(t => t.id === button.dataset.id); if (!task) return;
  try {
    if (button.dataset.action === 'toggle') await request(`/api/tarefas/${task.id}`, { method: 'PATCH', body: JSON.stringify({ concluida: !task.concluida }) });
    else await request(`/api/tarefas/${task.id}`, { method: 'DELETE' });
    await load(); notify(button.dataset.action === 'delete' ? 'Tarefa removida.' : 'Tarefa atualizada.');
  } catch (err) { notify(err.message); }
});

document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.filter.active').classList.remove('active'); button.classList.add('active'); filter = button.dataset.filter; render();
}));
document.querySelector('#refresh').addEventListener('click', () => { load(); status(); });
document.querySelector('#today').textContent = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
status(); load();
