# TODO — Integrações e novas funcionalidades da Minha Biblioteca

Status: rodada de 2026-10-13 concluiu o bug do sync de citações, a Citação do dia, a exportação CSV e deixou o Cloudflare Worker pronto para deploy. Pendem: deploy do worker (ação da pessoa usuária), ISBN (última etapa) e avaliações da seção 11.

## Concluído em 2026-10-13 (rodada final do dia)

- **Sync de exclusão de citações — corrigido de verdade.** Causa raiz: `deletedCitacoes` era gravado mas nunca aplicado no merge — a citação apagada ressuscitava quando o outro lado vencia por `updatedAt`. Agora `mergeBookFields` reconcilia `citacoes` item a item (união por id, LWW por `updatedAt`/`ts`) e aplica a união dos tombstones dos dois aparelhos. 4 testes novos em `src/test/sync-dedupe.test.ts`.
- **Citação do dia implementada.** `src/core/business/quote-of-day.ts`: seleção determinística por hash da data local (mesma frase em todos os aparelhos, 100% offline, ignora tombstones). Cartão "✨ Citação do dia" no topo da Estante (clique abre o livro). Notificação diária: botão "Lembrete" no header ativa `meta.quoteReminder`; o app dispara a notificação 1x/dia ao ser aberto (`maybeNotifyQuoteOfDay`, via SW `showNotification` no Android/PWA). Limitação honesta: PWA estático não tem push agendado sem servidor — a frase chega ao abrir o app, não numa hora fixa com ele fechado.
- **Exportação CSV implementada.** `src/core/business/csv-export.ts` + botão "⬇️ Exportar CSV" na aba Importar de `/books`. Delimitador `;` (Excel pt-BR), UTF-8 com BOM, aspas escapadas, anti CSV-injection (`'=`/`'+`/`'-`/`'@`), ISBN textual, citações como "p.42 — texto" (ignorando tombstones). `parseCSVText` corrigido para campos citados multilinha — resenhas com `\n` voltam inteiras no round-trip (testado). Backup JSON segue sendo a restauração integral; confirmado que o payload não inclui `meta`/credenciais.
- **Cloudflare Worker pronto pra deploy.** `workers/reel-proxy.js` escrito (allowlist instagram/cdninstagram/fbcdn/ytimg, CORS `*`, User-Agent de browser). O app já tenta o worker antes dos proxies públicos: config via campo "Proxy do reel" na aba Scan (meta `reelProxy`, local) ou `VITE_REEL_PROXY` no `.env`. Teste cobre a prioridade na cadeia.

## Status atual — Scan de reels com IA (implementado em 2026-10-13)

**Feito e verificado:** aba "🎬 Scan de reel" é a primeira em `/books`. O fluxo por **link** funciona (ordem atualizada em 2026-10-13 noite — legenda resolve local, sem gastar IA):

```
link → r.jina.ai (legenda + capa, CORS liberado)
        ├─ legenda lista "Título — Autor"? → parser local (caption-parse.ts) → revisão ✨ zero chamada de IA
        ├─ legenda sem lista → aviso "scan mais minucioso" → LLM-texto → revisão
        └─ falhou? → proxy CORS → video_url/og:image → frames → LLM-visão
             └ falhou? → upload de vídeo/prints (alternativa na mesma aba)
```

- **Legenda resolve sozinha:** `caption-parse.ts` extrai listas numeradas/emoji ("1️⃣ Título — Autor", "2. Título - Autor", "Título by Autor", "|"). Conservador: linha sem separador não vira livro. Funciona **sem API key** quando a legenda entrega tudo — a chave só é exigida quando o scan minucioso é necessário.
- **Aviso durante o scan:** `onNote` callback mostra "Não encontrei os livros na legenda — rodando um scan mais minucioso com a IA…" enquanto a chamada acontece.

- Verificado com link real de reel: legenda com livros → 4 livros identificados, dedupe "já na biblioteca" ✓
- Reel sem livros na legenda → usa a **capa** (via `images.weserv.nl`, CORS ok) como frame; só 1 imagem, marcas `uncertain` quando a leitura é incerta
- Chave do LLM (Gemini/OpenAI/Claude) fica no campo da UI ou `VITE_LLM_API_KEY`/`VITE_GEMINI_API_KEY` no `.env`; salva só no IndexedDB `meta`, nunca no Drive
- 90 testes, build e `git diff --check` limpos. Arquivos: `src/core/business/llm/*` e `src/components/scan/ReelScanner.tsx`

### ✅ Cloudflare Worker publicado (2026-10-13)

Worker live, deploy automático via Workers Builds conectado ao repo (`wrangler.toml` na raiz, `main = workers/reel-proxy.js`). **A URL não fica no código**: vem do secret `VITE_REEL_PROXY` no GitHub Actions (injetado no build em `react-vite.yml`) ou do `.env` local em dev; meta `reelProxy` segue como override por aparelho. ⚠️ Pendente: criar o secret `VITE_REEL_PROXY` no repo (Settings → Secrets and variables → Actions) com a URL do worker publicado. Verificado: ytimg 200 + CORS `*` ✓, allowlist bloqueia hosts fora da lista ✓.

**Limitação observada:** o Instagram responde **429** pra chamadas vindas de IPs de datacenter (Cloudflare) — o HTML da página do reel ainda não vem de forma confiável por esse caminho. O worker segue útil (capas CDN, ytimg, e tentativas ocasionais que passam), mas o `video_url` do Instagram pode continuar dependendo de sorte. O caminho principal (Jina legenda → parser local → LLM) não é afetado.

### ✅ Citação do dia ("frase do dia") — implementada

Detalhes na seção "Concluído" acima. Decisões tomadas: seleção **determinística por data** (mesma frase nos aparelhos), cartão no topo da **Estante** (web e PWA), notificação **uma vez por dia ao abrir o app** via botão "Lembrete". Decisões que ficaram em aberto para futuras sessões:

- [ ] Horário configurável ou notificação agendada de verdade (precisaria de backend/push ou `NotificationTrigger` quando amadurecer)
- [ ] Cartão também no Diário? Hoje vive só na Estante
- [ ] Navegar direto para a página da citação no `CitacoesModal` em vez do modal do livro?

## Retomar esta sessão

Para continuar amanhã na mesma sessão do Devin, execute na pasta do projeto:

```bash
devin -r excellent-racer
```

Ao retomar, ler este `todo.md` e escolher a próxima prioridade antes de implementar.

## Correções e melhorias do app — histórico concluído

### ✅ Filtro de gênero e dropdown (concluído)

Implementado: busca por texto removida; filtros são dois dropdowns — Gênero e Autor (populado com os autores reais da biblioteca, ordem pt-BR). Botões de status viraram atalhos de rolagem pras seções. `ShelfPage.tsx`.

O relato original abaixo ficou como histórico:

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

### ✅ Prateleiras de livros lidos no final da página (concluído)

Implementado: a Estante virou seções por status — "Lendo agora", "Quero ler" (com fila `filaPosicao` + drag-and-drop), "Lidos" e "Abandonados" por último. Sem mais "Prateleira N".

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

### ✅ Exclusão e sincronização das citações (corrigido em 2026-10-13)

Causa raiz encontrada e corrigida: os tombstones `deletedCitacoes` eram gravados mas **nunca aplicados no merge** — citação apagada ressuscitava se o outro lado vencesse por `updatedAt`. `mergeBookFields` agora reconcilia `citacoes` item a item + união de tombstones (`sync-manager.ts`). 4 testes novos cobrem: não ressuscitar, propagação, união parcial e LWW pós-tombstone.

O relato original abaixo ficou como histórico:

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

## 10. Exportação completa da biblioteca em CSV ✅ (implementada em 2026-10-13)

Implementada: `csv-export.ts` + botão na aba Importar. Delimitador `;`, UTF-8+BOM, escape de aspas, anti CSV-injection, multilinha citado, ISBN textual, citações legíveis (sem tombstones). `parseCSVText` corrigido pra campos citados com quebras de linha; round-trip testado. O que sobrou como avaliação futura:

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

1. ~~Corrigir a exclusão/sincronização das citações~~ ✅ 2026-10-13 (tombstones aplicados no merge).
2. ~~Corrigir o filtro de gênero e convertê-lo em dropdown~~ ✅ (gênero + autor em dropdowns).
3. ~~Organizar os livros lidos em prateleiras no final da Estante~~ ✅ (seções por status, lidos/antepenúltima, abandonados últimos).
4. ~~Melhorar o ciclo CSV: compatibilidade com MyReelReads e exportação da biblioteca~~ ✅ 2026-10-13 (exportação implementada; compatibilidade com formatos externos segue como avaliação fina na seção 10).
5. Prototipar reconhecimento de livros em imagens/frames enviados pela pessoa usuária, medindo falsos positivos e livros não detectados. ✅ parcial — scan por link e upload funcionando; medições de precisão/custo pendentes.
6. Validar acesso autorizado a Reels/TikTok e processamento completo de links com IA. ✅ parcial — link + legenda + capa funcionando; frames de vídeo dependem do deploy do Cloudflare Worker (seção ⭐ acima).
7. Avaliar tags, séries, filtros e demais recursos complementares — seção 11 continua aberta.
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
