# TODO — Estudo da integração por ISBN

Prioridade: última etapa do roadmap em `todo.md`. Fazer o estudo e confirmar as decisões antes de implementar. Nenhuma API, chave, conta ou infraestrutura deve ser ativada nesta etapa sem aprovação.

## Objetivo e arquitetura

Informar ISBN, consultar metadados e revisar o resultado antes de adicionar ou completar um livro. Preservar o PWA estático, IndexedDB e a sincronização atual. Não introduzir backend sem avaliar sua necessidade.

## Documentação

- Google Books: https://developers.google.com/books/docs/v1/using?hl=pt-br
- Open Library — ISBN, Editions e Books: https://openlibrary.org/dev/docs/api/books
- Open Library — diretrizes e limites: https://openlibrary.org/developers/api

## 1. Comparar os provedores

| Ponto | Google Books | Open Library |
| --- | --- | --- |
| Consulta por ISBN | Pesquisa de volumes com `q=isbn:ISBN` | Edição em `/isbn/ISBN.json` |
| Identificação | A documentação exige chave de API ou token para identificar solicitações públicas | As consultas públicas documentadas não exigem chave de API |
| Metadados | Título, autores, editora, descrição, páginas, idioma e imagens, quando disponíveis | Dados da edição; autores e descrição podem exigir consultas adicionais |
| Cuidados | Cotas, restrições da chave e correspondência do ISBN | Limites, campos incompletos e distinção entre obra e edição |

- [ ] Comparar cobertura com livros brasileiros, traduções, edições estrangeiras e diferentes formatos da biblioteca.
- [ ] Medir correspondência exata do ISBN, capa, páginas, campos disponíveis, latência e falhas.
- [ ] Conferir cotas atuais do Google Books sem presumir uma quantidade fixa de consultas gratuitas.
- [ ] Revalidar os limites documentados da Open Library: 1 requisição por segundo sem identificação; 3 por segundo com identificação aceita. Contar chamadas adicionais a autores e obras.
- [ ] Avaliar identificação da aplicação e limitações de configurar `User-Agent` no navegador.
- [ ] Testar `fetch`/CORS no Edge, PWA e na origem do GitHub Pages.
- [ ] Verificar termos de uso e atribuição de dados e capas.
- [ ] Decidir provedor principal e eventual fallback com base na amostra.

Hipótese, não decisão: Open Library por ISBN/Edition primeiro e Google Books como alternativa. A documentação da Open Library classifica `/api/books` como legado; avaliar ISBN/Edition e Search antes de adotar esse endpoint.

## 2. Validar ISBN e edição

- [ ] Aceitar ISBN-10 e ISBN-13, removendo espaços, hífens e o prefixo `ISBN`.
- [ ] Validar dígito verificador, incluindo `X` no final do ISBN-10.
- [ ] Definir representação normalizada e reconhecer ISBN-10/13 equivalentes quando a conversão for possível.
- [ ] Rejeitar ISBN inválido em pt-BR antes da consulta.
- [ ] Conferir o ISBN retornado, sem escolher cegamente o primeiro resultado.
- [ ] Validar idioma, formato e edição para não usar capa/paginação de outra edição.
- [ ] Tratar edição inexistente, vários candidatos e respostas sem identificadores suficientes, mantendo revisão/cadastro manual.

## 3. Campos e proteção dos dados

- [ ] Mapear `title`, `author`, `cover`, `paginas`, `genero` e `idioma` quando confiáveis.
- [ ] Definir campos mínimos adicionais: ISBN normalizado, editora, publicação e proveniência/ID do provedor.
- [ ] Decidir uso de subtítulo e sinopse; sinopse externa não deve substituir `resenha` pessoal.
- [ ] Normalizar múltiplos autores e não substituir dados válidos por campos vazios.
- [ ] Usar capas HTTPS válidas e preservar a capa de reserva.
- [ ] Não alterar automaticamente status, tipo, nota, comentários, resenha, citações, datas pessoais, `paginasLidas` ou `readingEpoch`.
- [ ] Confirmar qualquer substituição de páginas totais, porque afeta percentual e edição.

## 4. Experiência e persistência

- [ ] Definir entrada “Adicionar livro por ISBN” sem outro formulário de informações pessoais de leitura.
- [ ] Fluxo: informar ISBN → buscar → revisar metadados/capa/edição → confirmar.
- [ ] Permitir corrigir os resultados e completar cadastros existentes, priorizando campos vazios e confirmando substituições.
- [ ] Mostrar carregamento, resultado ausente, indisponibilidade e tentativa do outro provedor.
- [ ] Manter cadastro manual, livros salvos offline e evitar consultar toda a biblioteca ao iniciar.
- [ ] Aproveitar o ISBN já reconhecido por `mapRow` no CSV.
- [ ] Rever a busca de capas por título/autor em `importCSV`; priorizar ISBN válido quando essa integração for autorizada.
- [ ] Rever duplicidade por título: edições diferentes podem ter o mesmo título.
- [ ] Preservar IDs existentes e vínculos de diário/citações; não migrar IDs automaticamente para ISBN.
- [ ] Definir IDs estáveis dos novos livros e evitar duplicados em buscas ou CSV repetidos.
- [ ] Salvar metadados confirmados no IndexedDB e avaliar cache por ISBN, inclusive resultados ausentes com validade limitada.
- [ ] Rever `OVERRIDE`, `mergeCatalog`, `buildSyncPayload` e `applyRemote` para preservar ISBN, capa e campos confirmados após recarga/sync.
- [ ] Não apagar correções manuais ao receber API ou `books.json`; definir atualização manual e invalidação de cache.

## 5. Segurança, confiabilidade e prova de conceito

- [ ] Usar somente metadados públicos; login OAuth e estantes privadas do Google estão fora do escopo inicial.
- [ ] Definir configuração da chave, caso necessário. No frontend ela é visível: restringir API/origens/cotas e nunca publicar segredos ou chaves irrestritas.
- [ ] Não incluir credenciais em logs, repositório ou `data/sync.json`.
- [ ] Renderizar conteúdo externo como texto seguro e sanitizar descrições HTML.
- [ ] Implementar timeout, cancelamento e proteção contra respostas fora de ordem.
- [ ] Tratar rede indisponível, `404`, `429` e respostas incompletas sem bloquear o app.
- [ ] Respeitar limites com cache/fila/concorrência controlada, sem coleta em massa ou contornos.
- [ ] Fazer prova de conceito isolada antes da interface principal.
- [ ] Testar ISBN-10/13, `X`, hífens, ISBN inválido, edição ausente, múltiplos resultados e duplicados.
- [ ] Testar ausência de capa/páginas/idioma, múltiplos autores e descrição HTML.
- [ ] Testar rede, limites, fallback, buscas consecutivas e resposta aplicada ao livro correto.
- [ ] Testar revisão manual, recarga e sync com dados isolados, sem enviar testes ao `data/sync.json` real.
- [ ] Confirmar integridade de progresso, dashboard, resenha e citações; validar Edge, PWA e telas pequenas.
- [ ] Incrementar o service worker apenas quando a funcionalidade for implementada/publicada.

## Decisões antes da implementação

- [ ] Provedor principal/fallback e resultado da amostra de cobertura.
- [ ] Chave, cotas, custos e viabilidade do frontend sem backend.
- [ ] Campos mínimos e política de substituição de dados existentes.
- [ ] Regras de duplicidade/edições, ponto de entrada e alcance da integração CSV.
- [ ] Aprovação da implementação após concluir o estudo, como última etapa.
