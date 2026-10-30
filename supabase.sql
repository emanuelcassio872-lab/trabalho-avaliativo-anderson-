-- Execute este arquivo no SQL Editor do projeto Supabase.
create extension if not exists pgcrypto;

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 120),
  descricao text not null default '' check (char_length(descricao) <= 500),
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.tarefas enable row level security;

-- O servidor usa a chave service role apenas no backend. Nunca a exponha no navegador.
-- Para este projeto individual de demonstração, a chave service role é usada no servidor
-- Node. Em produção, prefira autenticação de usuários e políticas RLS por usuário.
grant all on public.tarefas to service_role;
