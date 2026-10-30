# Roteiro do vídeo demonstrativo

**Duração sugerida: 3 a 5 minutos.** Grave a tela com a aplicação em execução e os serviços já configurados.

1. **Apresentação (20–30 s):** “Este é o Fluxo, um painel de tarefas. Ele reúne tarefas numa interface web e usa Supabase para persistência e Redis para cachear leituras.”
2. **Telas e funcionalidades (1 min):** mostre a lista, crie uma tarefa, marque-a como concluída, use os filtros e remova uma tarefa.
3. **Supabase (40 s):** mostre que a tarefa persiste após atualizar. Se permitido, mostre a tabela `tarefas` no painel do Supabase e a linha criada.
4. **Redis (1 min):** atualize a tela duas vezes. Explique que o primeiro pedido consulta o Supabase e grava a lista no Redis por 60 segundos; o seguinte lê a chave em cache. Mostre os contadores `acertos` e `falhas` na tela.
5. **Invalidação (30 s):** crie ou altere uma tarefa e atualize. Explique que a chave é apagada para a próxima leitura buscar os dados atualizados.
6. **Fechamento (15 s):** resuma o benefício: leituras repetidas mais rápidas e menos consultas ao banco, com expiração e invalidação para manter os dados atualizados.

Não mostre as chaves do Supabase nem o token do Upstash na gravação.
