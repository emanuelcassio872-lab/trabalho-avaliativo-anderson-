-- Tabela usada pelo backend do projeto Fluxo.
create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 120),
  descricao text not null default '' check (char_length(descricao) <= 500),
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

create index tarefas_created_at_idx on public.tarefas (created_at desc);

alter table public.tarefas enable row level security;

-- Somente o backend, usando a chave service_role guardada no .env, pode acessar os dados.
-- Nunca exponha essa chave no navegador, no repositório ou em imagens do vídeo.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.tarefas to service_role;
revoke all on table public.tarefas from anon, authenticated;

