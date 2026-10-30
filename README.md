# Fluxo — Painel de Tarefas

Aplicação web para organizar tarefas, com persistência no Supabase e cache Redis. O projeto demonstra como uma interface, um banco relacional e uma camada de cache podem trabalhar juntos.

## Problema e objetivo

Uma lista de tarefas simples costuma ficar espalhada ou sem acompanhamento. O Fluxo reúne cadastro, conclusão e remoção em uma tela. O Supabase armazena as tarefas de forma persistente; o Redis mantém por até 60 segundos uma cópia da lista para acelerar leituras repetidas e reduzir consultas ao banco.

## Funcionalidades

- Interface responsiva em português.
- Criar tarefas com título e descrição, marcar como concluídas, filtrar e remover.
- Persistir operações no Supabase (PostgreSQL pela API REST).
- Guardar a lista em Redis por 60 segundos, contar acertos e faltas de cache e invalidar o cache quando uma tarefa muda.
- Exibir o estado da conexão com os serviços.
- Modo demonstração local para abrir a interface sem credenciais. Neste modo, a lista de exemplo é somente leitura; a integração real só fica ativa quando os quatro valores de ambiente são configurados.

## Tecnologias

- Node.js 20 ou superior (servidor HTTP e API sem dependências externas).
- HTML, CSS e JavaScript no navegador.
- Supabase Database (PostgreSQL e API REST).
- Upstash Redis REST API.

## Como executar

1. Instale Node.js 20+.
2. Na pasta do projeto, copie `.env.example` para `.env` e preencha as configurações descritas abaixo.
3. Execute o SQL de `supabase.sql` no SQL Editor do Supabase.
4. Rode `node app.mjs` e abra `http://localhost:3000`.

Sem `.env`, o servidor abre no modo demonstração local: dá para navegar na tela e filtrar exemplos, mas não gravar alterações.

## Configuração do Supabase

O projeto Supabase deste trabalho já está criado e a tabela `public.tarefas` já foi aplicada. A URL do projeto está preenchida em `.env.example`. No painel, em **Settings > API Keys**, crie uma chave secreta `sb_secret_...` e coloque-a em `SUPABASE_SECRET_KEY` no `.env` local. O servidor consulta e modifica `public.tarefas` pela API REST.

**Segurança:** a chave secreta do Supabase tem acesso privilegiado e ignora RLS. Ela só deve ficar no `.env` do servidor, nunca no JavaScript do navegador nem no GitHub. O servidor local escuta apenas em `127.0.0.1` e o `.gitignore` exclui `.env`. Para publicação pública, acrescente autenticação e políticas RLS por usuário antes de hospedar o servidor.

## Configuração do Redis

Crie uma base Redis no Upstash e copie a URL REST e o token REST para `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`. O servidor usa `GET` e `SET ... EX 60` para cachear a lista, `INCR` para registrar acertos e faltas e `DEL` para invalidar a lista depois de criar, concluir ou remover uma tarefa.

### Justificativa técnica

A lista de tarefas é consultada com frequência e muda com menos frequência do que é lida. O cache reduz leituras repetidas no PostgreSQL, com expiração curta para limitar dados desatualizados. As operações de escrita removem a chave da lista; a próxima leitura consulta o Supabase e reaquece o cache. Os contadores permitem demonstrar esse comportamento: atualize a tela duas vezes em até 60 segundos e compare os acertos do cache com as consultas ao banco.

## Teste da demonstração

1. Inicie a aplicação e confirme que o aviso mostra Supabase e Redis conectados.
2. Clique em atualizar duas vezes. O primeiro carregamento após cache vazio conta como falta e o segundo como acerto.
3. Crie uma tarefa; a chave é removida. Atualize a tela e observe uma nova consulta ao banco, seguida de acertos em leituras seguintes.
4. Marque a tarefa como concluída, use os filtros e remova uma tarefa.
5. Atualize a página para confirmar a persistência no Supabase.

## Estrutura

```text
app.mjs             servidor HTTP, API, integração Supabase e Redis
public/             interface do navegador
supabase.sql        criação da tabela
.env.example        nomes das configurações necessárias
```

## Entrega acadêmica

Publique esta pasta em um repositório GitHub e inclua o link na plataforma da disciplina. Não publique `.env`, chaves, tokens ou credenciais. Grave um vídeo mostrando os passos da seção “Teste da demonstração” e explique por que o Redis foi usado.

