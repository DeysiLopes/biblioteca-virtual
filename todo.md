# TODO — Integrações e novas funcionalidades da Minha Biblioteca

Status: execução iniciada em 2026-10-12 pelas correções do app. CSV, IA/vídeos e funcionalidades complementares continuam pendentes; a integração por ISBN ficará por último e exige estudo separado.

## Status atual — Scan de reels com IA (implementado em 2026-10-13)

**Feito e verificado:** aba "🎬 Scan de reel" é a primeira em `/books`. O fluxo por **link** funciona:

```
link → r.jina.ai (legenda + capa, CORS liberado) → LLM-texto → revisão → "Quero ler" → enriquece ISBN/capa
        └ falhou? → proxy CORS → video_url/og:image → frames → LLM-visão
             └ falhou? → upload de vídeo/prints (alternativa na mesma aba)
```

- Verificado com link real de reel: legenda com livros → 4 livros identificados, dedupe "já na biblioteca" ✓
- Reel sem livros na legenda → usa a **capa** (via `images.weserv.nl`, CORS ok) como frame; só 1 imagem, marcas `uncertain` quando a leitura é incerta
- Chave do LLM (Gemini/OpenAI/Claude) fica no campo da UI ou `VITE_LLM_API_KEY`/`VITE_GEMINI_API_KEY` no `.env`; salva só no IndexedDB `meta`, nunca no Drive
- 90 testes, build e `git diff --check` limpos. Arquivos: `src/core/business/llm/*` e `src/components/scan/ReelScanner.tsx`

### ⭐ Próximo passo: Cloudflare Worker próprio (a peça que falta)

**Por quê:** para reels que só mostram os livros no vídeo (sem legenda), a IA hoje lê apenas a **capa**. Os frames do mp4 precisam do `video_url`, que só vem via proxy — e os proxies públicos (allorigins/cors.lol/codetabs) estavam todos fora do ar em 2026-10-13; o `corsproxy.org` devolve conteúdo adulterado (removido da cadeia).

**O que fazer:**

- [ ] Criar conta/projeto no Cloudflare (plano free, 100k req/dia) e publicar um Worker de ~30 linhas que recebe `?url=`, busca o HTML (com `User-Agent` de browser) e devolve com `Access-Control-Allow-Origin: *`
- [ ] Reaproveitar o Worker também para baixar o `video_url` (mp4) e a capa `scontent*.cdninstagram.com` — bytes passam direto com CORS
- [ ] Salvar a URL do worker em `VITE_REEL_PROXY` (`.env`, dev) e via meta `reelProxy` (config do usuário) — `fetchViaProxy`/`fetchImage` devem tentar o worker antes dos proxies públicos (`src/core/business/llm/reel-link.ts`)
- [ ] Opcional: restringir o worker a um allowlist de hosts (`instagram.com`, `cdninstagram.com`, `fbcdn.net`, `ytimg.com`) para não virar proxy aberto
- [ ] Testar de verdade com o reel `https://www.instagram.com/reel/DeVKPZyympI/` (livros só no vídeo) — esperado: `video_url` → mp4 → ~8 frames → LLM lê os títulos

**Rascunho do worker (colar no editor do Cloudflare):**

```js
export default {
  async fetch(req) {
    const url = new URL(req.url).searchParams.get('url');
    const ok = url && /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|ytimg\.com)$/.test(new URL(url).hostname);
    const headers = { 'Access-Control-Allow-Origin': '*' };
    if (!ok) return new Response('host não permitido', { status: 403, headers });
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36' } });
    return new Response(res.body, { status: res.status, headers: { ...headers, 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' } });
  },
};
```

### ⭐ Depois do Cloudflare: Citação do dia ("frase do dia")

Próxima feature logo após o Worker. Ideia: as citações que a pessoa salvou voltam pra ela como uma "frase do dia" — no app instalado (mobile) e/ou na versão web. Aproveita o fichário existente em vez de pedir novos dados.

- [ ] Definir a experiência em cada superfície:
  - **Web/app aberto**: cartão "✨ Citação do dia" — candidatos: topo do Diário, seção da Estante ou modal discreto ao abrir o app (decidir o ponto menos intrusivo).
  - **Mobile/PWA**: notificação diária com a citação — o SW já tem mensagens `notify`/`schedule` e o botão "Lembrete" no header; avaliar `NotificationTrigger` (experimental, só Android/Chrome) vs lembrete ao abrir o app.
- [ ] Regra de seleção da citação do dia: aleatória entre todas as `citacoes` da biblioteca? Ou rodízio determinístico por data (ex.: hash do dia → índice) para todos os aparelhos mostrarem a mesma frase?
- [ ] Exibir texto da citação + título/autor do livro + página; talvez link direto pro modal do livro ou pra página da citação no `CitacoesModal`.
- [ ] Respeitar a preferência de som/animação e não notificar de madrugada; escolher horário razoável (manhã/noite) ou configurável.
- [ ] Fallback sem citações salvas: esconder o cartão ou mostrar uma frase convidando a salvar a primeira citação.
- [ ] Cuidado com o sync: a "citação do dia" é derivada dos dados locais — não criar entidade persistida nem poluir o merge entre aparelhos (exceto talvez a config de horário/preferência no `meta`, que é local por aparelho).
- [ ] Testar: seleção determinística por data, biblioteca sem citações, livro apagado depois de salvar a citação, notificação com permissão negada e `prefers-reduced-motion`.
- [ ] Não depender de rede: a frase do dia deve funcionar 100% offline com o IndexedDB.

## Retomar esta sessão

Para continuar amanhã na mesma sessão do Devin, execute na pasta do projeto:

```bash
devin -r excellent-racer
```

Ao retomar, ler este `todo.md` e escolher a próxima prioridade antes de implementar.

## Correções e melhorias pendentes do app

### Filtro de gênero e dropdown

Problema relatado: o filtro de gênero deixou de funcionar. Além da correção, a seleção de gênero deve virar um dropdown com o mesmo estilo do seletor de livros do modal unificado.

- [ ] Reproduzir a falha do filtro de gênero e identificar a causa antes de corrigir.
- [ ] Conferir os valores de gênero do catálogo, dos livros importados por CSV e dos dados sincronizados.
- [ ] Substituir os botões de gênero por um dropdown (`select`), seguindo o visual do campo de escolha de livro no modal.
- [ ] Incluir “Todos os gêneros” e listar os gêneros disponíveis sem duplicados, em ordem alfabética.
- [ ] Tratar livros sem gênero e diferenças de espaços, maiúsculas/minúsculas ou representação dos valores sem alterar os dados salvos por tentativa.
- [ ] Garantir que escolher um gênero filtre corretamente os livros e que “Todos os gêneros” remova somente esse filtro.
- [ ] Manter a combinação com os filtros de status e a busca, sem perder a seleção ao atualizar a estante.
- [ ] Testar seleção, troca de gênero, limpeza do filtro e ausência de resultados.
- [ ] Validar aparência e uso por teclado no Edge, no PWA e em telas pequenas.
- [ ] Confirmar que a mudança apenas filtra a visualização, sem alterar progresso, dashboard ou informações dos livros.

### Prateleiras de livros lidos no final da página

Na aba Estante, livros com status “Lido” devem ficar em uma seção de prateleiras no final da página, separados dos demais livros, mas continuar disponíveis para consultar e abrir novamente.

- [ ] Criar a seção “Livros lidos” após as prateleiras dos demais livros, mantendo o visual de estante do app.
- [ ] Distribuir os livros concluídos em uma ou mais prateleiras, conforme a quantidade e o espaço disponível.
- [ ] Mover o livro para essa seção quando seu status passar a “Lido”, tanto por escolha no modal quanto pela conclusão da leitura.
- [ ] Se o status deixar de ser “Lido”, devolver o livro às prateleiras principais.
- [ ] Manter as capas clicáveis e o acesso ao mesmo modal unificado, às resenhas e às citações, sem mudar o status apenas por abrir um livro já lido.
- [ ] Aplicar busca e filtros de gênero/status também aos livros concluídos, sem duplicá-los nas duas seções.
- [ ] Não exibir prateleiras vazias nem reservar espaços desnecessários quando nenhum livro lido corresponder aos filtros.
- [ ] Preservar IDs, progresso, datas, comentários, notas, resenhas, citações e registros: a mudança é de organização visual, não exclusão ou novo cadastro.
- [ ] Testar mudança de status, consulta de livros já lidos, recarga/sincronização e layout em telas pequenas.

### Exclusão e sincronização das citações

Problema relatado: a resenha apagada foi atualizada, mas a exclusão de uma citação não foi refletida corretamente no fichário do app. Verificar tanto a exclusão local quanto a sincronização, especialmente ao apagar a última citação.

Atualização do relato: a sincronização geral entre web e mobile acabou concluindo após um atraso, mas as exclusões ainda parecem se perder no sync. Não confundir a demora de propagação com a falha de preservar exclusões. A investigação e a correção ficaram para a próxima sessão, amanhã.

Ponto observado no código: `pickOV` ignora arrays vazios. Assim, `citacoes: []` é descartado na montagem do payload e na aplicação de dados remotos. Já `buildSyncPayload` inclui um valor padrão para `resenha`, mas não para uma lista de citações explicitamente vazia. Essa diferença é uma hipótese a validar com reprodução isolada, não uma confirmação completa da causa do problema relatado.

- [ ] Reproduzir a exclusão da última citação e a exclusão de uma entre várias, verificando o momento em que a interface deixa de atualizar ou o item reaparece.
- [ ] Conferir `delCitacao`, a gravação no IndexedDB, `BOOKS`, a aba selecionada, o contador do livro e o estado vazio do fichário.
- [ ] Verificar se a alteração é enviada por `markDirty`/`pushSync` e se erros, ausência de token ou operação offline são comunicados corretamente.
- [ ] Revisar `pickOV`, `buildSyncPayload`, `mergePayload`, `applyRemote` e `mergeCatalog`: diferenciar campo ausente de uma exclusão explícita representada por `citacoes: []`.
- [ ] Garantir que catálogo, cache ou pull remoto não restaurem citações que foram apagadas.
- [ ] Conferir `updatedAt`, conflitos entre aparelhos e possíveis corridas entre a confirmação da exclusão, eventos de foco do navegador, pull e push.
- [ ] Testar fechar/reabrir o fichário, recarregar o app, sincronizar manualmente e abrir no Edge/PWA ou em outro aparelho.
- [ ] Comparar o comportamento com a limpeza de resenha e preservar o funcionamento correto de campos vazios.
- [ ] Criar testes isolados para excluir uma citação, excluir a última, cancelar exclusão e receber uma lista vazia por sincronização, sem enviar dados de teste ao `data/sync.json` real.
- [ ] Não limpar ou apagar `data/sync.json` como tentativa de correção; preservar as demais citações, livros, resenhas e o histórico de leitura.

## Objetivo

Começar pelas correções de sincronização/exclusão, filtros e organização da Estante. A consulta e o cadastro automático por ISBN ficam para a última etapa, com estudo prévio detalhado em [todo-isbn.md](todo-isbn.md).

Também avaliar a captura de recomendações por links de Instagram Reels/TikTok, identificação de livros em vídeos com IA e exportação de toda a biblioteca em CSV, usando o MyReelReads como referência funcional.

O app deve continuar sendo um PWA estático no GitHub Pages, com IndexedDB e sincronização opcional pelo GitHub. Não introduzir um backend sem avaliar a necessidade e obter aprovação.

## Documentação

- Google Books: https://developers.google.com/books/docs/v1/using?hl=pt-br
- Open Library — Books, ISBN e Editions: https://openlibrary.org/dev/docs/api/books
- Open Library — diretrizes e limites: https://openlibrary.org/developers/api
- Referência funcional — MyReelReads: BookTok Finder: https://play.google.com/store/apps/details?id=com.bookig.mobile

## Integração por ISBN — última etapa

O estudo completo foi separado em [todo-isbn.md](todo-isbn.md). Essa é a última etapa do roadmap: primeiro estudar cobertura, edição, segurança, limites e custos; só depois decidir sobre a implementação. Nenhuma API ou chave será ativada nesta etapa.

## 8. Referência: MyReelReads / BookTok Finder

Segundo a pessoa usuária, o CSV dos livros que quer ler veio desse app. A descrição pública na Google Play confirma as seguintes funcionalidades anunciadas:

- Colar ou compartilhar links de Instagram Reels e TikTok.
- Usar IA para detectar capas e títulos dos livros que aparecem no vídeo e adicioná-los à TBR, a lista de livros para ler.
- Consultar uma lista pesquisável de recomendações salvas.
- Classificação automática por gênero, tags pessoais, notas por estrelas e filtros.
- Informações de séries, como “livro 2 de 5”, e acompanhamento de séries incompletas.
- Exportar a lista em CSV para Goodreads, Notion ou Excel.
- Links externos para Amazon e Goodreads.

A página descreve identificação de capas e títulos, não a leitura do conteúdo completo de um livro. Ela não documenta os modelos de IA nem a arquitetura interna; o pipeline abaixo é uma proposta a avaliar, não uma reprodução técnica confirmada do MyReelReads.

## 9. Capturar livros por links de Reels/TikTok com IA

### Experiência desejada

- [ ] Permitir colar um link de vídeo em um campo de captura de recomendações.
- [ ] Avaliar receber links pelo compartilhamento do sistema no PWA, conforme suporte do navegador/aparelho.
- [ ] Identificar vários livros em um mesmo vídeo e agrupar aparições repetidas do mesmo livro.
- [ ] Mostrar os livros detectados, a evidência disponível e a confiança estimada, sem tratá-la como garantia de acerto.
- [ ] Permitir confirmar, corrigir ou descartar cada resultado antes da inclusão; avaliar inclusão automática apenas como opção posterior para resultados confiáveis.
- [ ] Adicionar livros novos como “Quero ler”, sem alterar o status de livros já existentes.
- [ ] Exibir etapas de processamento, falhas e resultados parciais; permitir retomar uma tentativa sem duplicar livros.
- [ ] Manter o cadastro por ISBN e o cadastro manual como alternativas quando a identificação falhar.

Fluxo proposto: link → acesso autorizado ao vídeo → amostragem de frames → detecção de capas/texto → candidatos de título/autor → consulta bibliográfica → revisão → inclusão na biblioteca.

### Identificação e enriquecimento

- [ ] Comparar modelos multimodais e OCR para reconhecer capas, títulos e autores nos frames.
- [ ] Avaliar legendas, descrição e transcrição de áudio como sinais complementares, sem presumir que o app de referência usa essas técnicas.
- [ ] Definir amostragem de frames, limites de duração/tamanho e tratamento de livros mostrados rapidamente ou parcialmente.
- [ ] Separar reconhecimento visual de busca bibliográfica: capas e vídeos frequentemente não mostram o ISBN.
- [ ] Resolver candidatos por título/autor nas APIs de livros; usar ISBN somente quando ele estiver visível ou a edição for confirmada.
- [ ] Não inventar ISBNs, autores, títulos ou edições para preencher resultados incertos.
- [ ] Tratar traduções, livros de nomes parecidos, múltiplas edições, capas alternativas e livros repetidos em vários vídeos.
- [ ] Não alterar progresso, dashboard, resenhas ou citações durante a análise ou inclusão de recomendações.

### Origem das recomendações

- [ ] Guardar o link original, plataforma e data da captura, além da identificação confirmada do livro.
- [ ] Permitir várias recomendações/vídeos associados ao mesmo livro, sem criar cópias do cadastro.
- [ ] Definir a persistência e a sincronização dessas origens, considerando que o repositório de sincronização pode ser público.
- [ ] Guardar apenas os dados necessários; evitar URLs temporárias com tokens, credenciais ou cópias desnecessárias dos vídeos.
- [ ] Permitir consultar novamente a origem da recomendação, mesmo quando os metadados do livro forem corrigidos.

### Viabilidade técnica, limites e custos

- [ ] Confirmar o acesso permitido a vídeos das plataformas e os requisitos das APIs oficiais, autorizações e termos de uso.
- [ ] Definir quais formatos de link serão suportados inicialmente. “Qualquer vídeo” não deve ser uma promessa: conteúdos privados, removidos, bloqueados ou restritos podem não ser acessíveis.
- [ ] Avaliar envio manual de vídeo, imagem ou captura de tela como alternativa autorizada quando o link não puder ser processado.
- [ ] Avaliar a necessidade de backend/worker para acesso à mídia, processamento e proteção das chaves de IA; o GitHub Pages sozinho não executa tarefas de servidor.
- [ ] Comparar processamento local e serviços de IA por qualidade, custo por análise, latência, privacidade e esforço de manutenção.
- [ ] Definir limites de uso, fila, cache, deduplicação de links e orçamento antes de ativar serviços pagos.
- [ ] Validar URLs e redirecionamentos, limitar o acesso aos provedores permitidos e proteger o eventual backend contra SSRF.
- [ ] Tratar texto extraído do vídeo como dados, não como instruções para a IA ou autorização para executar ações.
- [ ] Informar quais dados serão enviados ao provedor de IA e definir descarte/retenção de mídia temporária.
- [ ] Não criar infraestrutura, contas, assinaturas ou consumo pago nesta etapa de planejamento.

## 10. Exportação completa da biblioteca em CSV

Atualmente o app importa CSV e exporta backup JSON; ainda não possui exportação de livros em CSV.

- [ ] Adicionar exportação de todos os livros da biblioteca, não somente dos itens visíveis no filtro atual.
- [ ] Avaliar também a opção de exportar apenas a TBR ou a seleção filtrada.
- [ ] Definir colunas estáveis para título, autores, ISBN, capa, editora, páginas, idioma, gênero, status, tipo, nota, progresso, datas, comentários, resenha e origem das recomendações.
- [ ] Definir como representar tags, citações e múltiplas origens: células estruturadas ou arquivos CSV separados, sem perder os vínculos.
- [ ] Manter o backup JSON para restauração integral e definir explicitamente o que o CSV preserva ou não do diário e dos dados internos.
- [ ] Implementar escape correto de aspas, separadores e quebras de linha em campos de texto; usar UTF-8 e avaliar BOM para Excel.
- [ ] Preservar ISBNs como identificadores textuais e testar zeros à esquerda e tratamento pelo Excel.
- [ ] Neutralizar fórmulas em campos textuais exportados, evitando CSV injection ao abrir dados externos em planilhas.
- [ ] Revisar `parseCSV`: hoje ele separa linhas antes de analisar aspas, o que não suporta corretamente campos citados com quebras de linha reais.
- [ ] Verificar importação/exportação compatível com amostras do MyReelReads, sem presumir nomes de colunas ou formatos não observados.
- [ ] Avaliar compatibilidade específica com Goodreads, Notion e Excel; não prometer que um único layout atende todos sem testes.
- [ ] Testar o ciclo exportar → importar, sem duplicar livros nem modificar progresso, datas, resenhas ou citações.
- [ ] Nunca exportar tokens, chaves de API ou outras credenciais.
- [ ] Revisar também `exportBackup` antes de compartilhar arquivos: o backup JSON atual inclui `META`, que pode conter `githubToken`; definir a exclusão de credenciais sem perder os dados da biblioteca.

## 11. Outras funcionalidades de referência a avaliar

- [ ] TBR pesquisável e histórico de recomendações, com filtros úteis para escolher a próxima leitura.
- [ ] Sugestão automática de gênero, com confirmação/correção manual.
- [ ] Tags pessoais e filtros por tags, gênero e nota.
- [ ] Edição de notas por estrelas em um ponto apropriado da interface, sem recolocar campos extras no modal de leitura que foi simplificado.
- [ ] Cadastro de série, posição do livro na série e quantidade de volumes, quando os metadados forem confiáveis.
- [ ] Visualização de séries incompletas e volumes ainda não cadastrados, sem inventar informações faltantes.
- [ ] Links externos de consulta/compra em Goodreads e Amazon, como recursos opcionais, sem pagamentos dentro do app.
- [ ] Definir quais dessas funcionalidades realmente fazem sentido para a Minha Biblioteca, em vez de copiar todo o app de referência.

## 12. Provas de conceito e prioridades propostas

Ordem inicial para avaliação, sujeita à escolha da pessoa usuária:

1. Corrigir a exclusão/sincronização das citações, sem alterar os dados reais de teste por tentativa.
2. Corrigir o filtro de gênero e convertê-lo em dropdown.
3. Organizar os livros lidos em prateleiras no final da Estante.
4. Melhorar o ciclo CSV: compatibilidade com MyReelReads e exportação da biblioteca.
5. Prototipar reconhecimento de livros em imagens/frames enviados pela pessoa usuária, medindo falsos positivos e livros não detectados.
6. Validar acesso autorizado a Reels/TikTok e processamento completo de links com IA. Backend, provedor e custos precisam de decisão/aprovação antes de implementar.
7. Avaliar tags, séries, filtros e demais recursos complementares.
8. Por último, concluir o estudo de [todo-isbn.md](todo-isbn.md) e decidir se e como implementar a integração por ISBN.

- [ ] Montar uma amostra autorizada com vídeos de um livro, vários livros, capas pouco nítidas, ausência de capa, áudio apenas e títulos em diferentes idiomas.
- [ ] Medir precisão, livros não encontrados, deduplicação, confirmação da edição, custo e tempo de processamento.
- [ ] Testar links inválidos, conteúdo indisponível, limite de uso, respostas parciais e retentativas.
- [ ] Confirmar que repetir a análise do mesmo vídeo não cria duplicados e que vídeos diferentes podem apontar para o mesmo livro.
- [ ] Testar persistência, sincronização e CSV das recomendações usando dados isolados, sem enviar testes ao `data/sync.json` real.
- [ ] Validar Edge, PWA e telas pequenas e preservar o modal unificado, o dashboard e os fluxos de resenha/citações.

### Decisões pendentes

- [ ] Provedor principal de metadados e política de fallback.
- [ ] Necessidade e configuração de chave de API.
- [ ] Campos mínimos do cadastro automático e regra de substituição de dados existentes.
- [ ] Regras de duplicidade e tratamento de edições.
- [ ] Ponto de entrada na interface e alcance da integração com CSV.
- [ ] Formatos de links/mídias suportados e necessidade de backend/worker.
- [ ] Estratégia de reconhecimento com IA, limites de uso, privacidade e orçamento.
- [ ] Revisão obrigatória ou inclusão automática opcional dos resultados detectados.
- [ ] Layouts de exportação CSV e formato das origens/citações.
- [ ] Funcionalidades complementares e ordem de prioridade.
