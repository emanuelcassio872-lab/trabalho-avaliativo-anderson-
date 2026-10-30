import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

async function loadEnvironment() {
  try {
    const contents = await readFile(new URL('.env', import.meta.url), 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const entry = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!entry || entry[1].startsWith('#')) continue;
      let value = entry[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[entry[1]] === undefined) process.env[entry[1]] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

await loadEnvironment();

const PORT = Number(process.env.PORT || 3000);
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const REDIS_URL = (process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const configured = Boolean(SUPABASE_URL && SUPABASE_KEY && REDIS_URL && REDIS_TOKEN);
const localTasks = [
  { id: 'demo-1', titulo: 'Conectar o projeto ao Supabase', descricao: 'Criar a tabela e configurar as variáveis de ambiente.', concluida: false, created_at: new Date().toISOString() },
  { id: 'demo-2', titulo: 'Demonstrar o cache Redis', descricao: 'Carregar as tarefas duas vezes e observar o contador de cache.', concluida: true, created_at: new Date().toISOString() },
];

async function redis(command) {
  const response = await fetch(REDIS_URL, {
    method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!response.ok) throw new Error(`Redis respondeu HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function db(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json',
      Prefer: 'return=representation', ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase respondeu HTTP ${response.status}: ${text.slice(0, 240)}`);
  return text ? JSON.parse(text) : null;
}

async function invalidate() {
  await redis(['DEL', 'tarefas:v1']);
}

function send(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(status === 204 ? undefined : JSON.stringify(data));
}

async function body(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (raw.length > 100_000) throw new Error('Corpo da requisição muito grande.');
  return raw ? JSON.parse(raw) : {};
}

async function api(req, res, url) {
  if (url.pathname === '/api/status') {
    if (!configured) return send(res, 200, { configured: false, modo: 'demonstração local', cache: 'não conectado', banco: 'não conectado' });
    try {
      const pong = await redis(['PING']);
      await db('tarefas?select=id&limit=1');
      return send(res, 200, { configured: true, modo: 'integrado', cache: pong, banco: 'conectado' });
    } catch (e) { return send(res, 200, { configured: true, modo: 'configuração incompleta', erro: e.message }); }
  }
  if (!configured) {
    if (req.method === 'GET' && url.pathname === '/api/tarefas') return send(res, 200, localTasks);
    return send(res, 503, { error: 'Configure o Supabase e o Redis para gravar alterações. Consulte o README.' });
  }

  try {
    if (req.method === 'GET' && url.pathname === '/api/tarefas') {
      const cached = await redis(['GET', 'tarefas:v1']);
      if (cached) {
        await redis(['INCR', 'metricas:v1:acertos']);
        return send(res, 200, JSON.parse(cached));
      }
      await redis(['INCR', 'metricas:v1:falhas']);
      const rows = await db('tarefas?select=id,titulo,descricao,concluida,created_at&order=created_at.desc');
      await redis(['SET', 'tarefas:v1', JSON.stringify(rows), 'EX', '60']);
      return send(res, 200, rows);
    }
    if (req.method === 'GET' && url.pathname === '/api/metricas') {
      const [hits, misses] = await Promise.all([redis(['GET', 'metricas:v1:acertos']), redis(['GET', 'metricas:v1:falhas'])]);
      return send(res, 200, { acertos: Number(hits || 0), falhas: Number(misses || 0), ttl_segundos: 60 });
    }
    if (req.method === 'POST' && url.pathname === '/api/tarefas') {
      const data = await body(req);
      const titulo = String(data.titulo || '').trim();
      if (!titulo) return send(res, 400, { error: 'Informe o título da tarefa.' });
      if (titulo.length > 120) return send(res, 400, { error: 'O título deve ter até 120 caracteres.' });
      const rows = await db('tarefas', { method: 'POST', body: JSON.stringify([{ titulo, descricao: String(data.descricao || '').trim().slice(0, 500), concluida: false }]) });
      await invalidate(); return send(res, 201, rows[0]);
    }
    const match = url.pathname.match(/^\/api\/tarefas\/([0-9a-f-]+)$/i);
    if (match && req.method === 'PATCH') {
      const data = await body(req);
      const rows = await db(`tarefas?id=eq.${match[1]}`, { method: 'PATCH', body: JSON.stringify({ concluida: Boolean(data.concluida) }) });
      await invalidate(); return rows.length ? send(res, 200, rows[0]) : send(res, 404, { error: 'Tarefa não encontrada.' });
    }
    if (match && req.method === 'DELETE') {
      await db(`tarefas?id=eq.${match[1]}`, { method: 'DELETE' });
      await invalidate(); return send(res, 204, null);
    }
    return send(res, 404, { error: 'Rota não encontrada.' });
  } catch (e) { return send(res, 502, { error: e.message }); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const publicDir = join(process.cwd(), 'public');
  const file = normalize(join(publicDir, requested));
  if (file !== publicDir && !file.startsWith(publicDir + sep)) return send(res, 403, { error: 'Acesso negado.' });
  try {
    const data = await readFile(file);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }); res.end(data);
  } catch { res.writeHead(404); res.end('Página não encontrada'); }
});

server.listen(PORT, () => console.log(`Painel de Tarefas disponível em http://localhost:${PORT}${configured ? '' : ' (modo demonstração local)'}`));
