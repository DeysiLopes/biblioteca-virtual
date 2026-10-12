# TODO — Integrações e novas funcionalidades da Minha Biblioteca

Status: planejamento. Nenhuma integração ou funcionalidade nova implementada nesta etapa.

## Retomar esta sessão

Para continuar amanhã na mesma sessão do Devin, execute na pasta do projeto:

```bash
devin -r excellent-racer
```

Ao retomar, ler este `todo.md` e escolher a próxima prioridade antes de implementar.

## Objetivo

Permitir informar o ISBN de um livro, consultar uma API de metadados e revisar os dados encontrados antes de adicionar o livro ou completar seu cadastro na Minha Biblioteca.

Também avaliar a captura de recomendações por links de Instagram Reels/TikTok, identificação de livros em vídeos com IA e exportação de toda a biblioteca em CSV, usando o MyReelReads como referência funcional.

O app deve continuar sendo um PWA estático no GitHub Pages, com IndexedDB e sincronização opcional pelo GitHub. Não introduzir um backend sem avaliar a necessidade e obter aprovação.

## Documentação

- Google Books: https://developers.google.com/books/docs/v1/using?hl=pt-br
- Open Library — Books, ISBN e Editions: https://openlibrary.org/dev/docs/api/books
- Open Library — diretrizes e limites: https://openlibrary.org/developers/api
- Referência funcional — MyReelReads: BookTok Finder: https://play.google.com/store/apps/details?id=com.bookig.mobile

## 1. Comparar os provedores

| Ponto | Google Books | Open Library |
| --- | --- | --- |
| Consulta por ISBN | Pesquisa de volumes com `q=isbn:ISBN` | Consulta da edição em `/isbn/ISBN.json` |
| Identificação | A documentação exige chave de API ou token para identificar solicitações públicas | As consultas públicas documentadas não exigem chave de API |
| Metadados | `volumeInfo`: título, autores, editora, descrição, páginas, idioma e imagens, quando disponíveis | Dados de edição; nomes de autores e descrição podem exigir consultas adicionais |
| Cuidados | Cotas do projeto, restrições da chave e validação do ISBN retornado | Limites de uso, campos incompletos e distinção entre obra e edição |

- [ ] Comparar a cobertura com uma amostra de ISBNs da biblioteca: livros brasileiros, traduções, edições estrangeiras e diferentes formatos.
- [ ] Medir correspondência exata do ISBN, qualidade da capa, quantidade de páginas, disponibilidade de campos, latência e falhas.
- [ ] Verificar cotas e condições atuais do Google Books, sem presumir uma quantidade fixa de consultas gratuitas.
- [ ] Respeitar os limites documentados da Open Library: 1 requisição por segundo sem identificação; 3 por segundo com identificação aceita. Contabilizar também consultas adicionais a autores e obras.
- [ ] Avaliar identificação da aplicação na Open Library e as limitações de configurar `User-Agent` em chamadas feitas diretamente pelo navegador.
- [ ] Validar chamadas com `fetch`/CORS no Edge, no PWA e na origem real do GitHub Pages.
- [ ] Verificar termos de uso e atribuição de metadados e capas.
- [ ] Escolher um provedor principal e decidir se haverá fallback para o outro.

Hipótese inicial para avaliação: Open Library por ISBN/edição como primeira tentativa, pela simplicidade de consultas públicas, com Google Books como alternativa. A escolha deve depender dos resultados da amostra, não apenas dessa hipótese.

**Atenção:** a documentação da Open Library classifica `/api/books` como endpoint legado e recomenda considerar a Search API. Avaliar ISBN/Edition e Search antes de adotar o endpoint legado.

## 2. Validar o ISBN e a edição

- [ ] Aceitar ISBN-10 e ISBN-13, removendo espaços, hífens e o prefixo `ISBN`.
- [ ] Validar o dígito verificador, incluindo `X` na posição final do ISBN-10.
- [ ] Definir uma representação normalizada e reconhecer ISBN-10/13 equivalentes quando a conversão for possível.
- [ ] Exibir mensagem em pt-BR para ISBN inválido antes de consultar a API.
- [ ] Confirmar o ISBN retornado pelo provedor; não escolher cegamente o primeiro resultado.
- [ ] Conferir idioma, formato e edição: número de páginas e capa não devem vir de outra edição da mesma obra.
- [ ] Tratar ISBN inexistente, múltiplos resultados e respostas sem identificadores suficientes, permitindo revisão ou cadastro manual.

## 3. Definir os campos preenchidos

- [ ] Mapear para o modelo atual: `title`, `author`, `cover`, `paginas`, `genero` e `idioma`, apenas quando houver dados confiáveis.
- [ ] Definir campos adicionais mínimos: ISBN normalizado, editora, data de publicação e identificador/proveniência do provedor.
- [ ] Decidir se subtítulo e sinopse serão guardados e apresentados na interface.
- [ ] Manter sinopse externa separada de `resenha`, que é o texto escrito pela pessoa usuária.
- [ ] Normalizar listas de autores e tratar campos ausentes sem substituir informações válidas por valores vazios.
- [ ] Usar URLs HTTPS válidas para capas e manter a capa de reserva quando a imagem falhar.
- [ ] Não preencher ou alterar automaticamente status, tipo, nota, comentários, resenha, citações, datas pessoais, `paginasLidas` ou `readingEpoch`.
- [ ] Pedir confirmação antes de substituir um total de páginas existente, pois ele afeta o percentual de leitura e a identificação da edição.

## 4. Planejar a experiência de uso

- [ ] Definir o ponto de entrada para “Adicionar livro por ISBN”, sem criar outro formulário para as informações pessoais de leitura.
- [ ] Prever o fluxo: informar ISBN → buscar → revisar dados/capa/edição → confirmar cadastro.
- [ ] Permitir corrigir os dados encontrados antes de salvar.
- [ ] Oferecer a busca para completar livros existentes, preenchendo campos vazios por padrão e confirmando substituições.
- [ ] Exibir carregamento, resultado não encontrado, indisponibilidade e opção de tentar o outro provedor.
- [ ] Manter o cadastro manual e o uso offline dos livros já salvos.
- [ ] Não consultar toda a biblioteca automaticamente ao abrir o app.

## 5. Integrar com a persistência e a sincronização

- [ ] Aproveitar o ISBN que `mapRow` já reconhece na importação CSV.
- [ ] Rever a busca atual de capas por título/autor em `importCSV`; priorizar ISBN válido quando disponível, sem confundir edições.
- [ ] Rever a detecção de duplicados: hoje o CSV compara títulos. Um mesmo título pode ter edições com ISBNs diferentes.
- [ ] Manter IDs de livros existentes e os vínculos de diário/citações; não migrar IDs automaticamente para ISBNs.
- [ ] Definir identificação estável para novos cadastros, sem duplicar livros ao repetir uma busca ou importar um CSV.
- [ ] Guardar os metadados confirmados no IndexedDB e avaliar cache das consultas por ISBN, inclusive resultados não encontrados com validade limitada.
- [ ] Rever `OVERRIDE`, `mergeCatalog`, `buildSyncPayload` e `applyRemote` para preservar ISBN, capa e demais campos confirmados após atualização do catálogo e sincronização entre aparelhos.
- [ ] Garantir que uma resposta de API ou recarga de `books.json` não apague correções manuais nem dados pessoais de leitura.
- [ ] Avaliar como atualizar e invalidar o cache, com atualização manual dos metadados quando necessário.

## 6. Segurança e confiabilidade

- [ ] Usar a API apenas para metadados públicos; acesso a estantes privadas do Google e login OAuth ficam fora do escopo inicial.
- [ ] Se escolher Google Books, definir a configuração da chave antes de implementar. Em um frontend estático ela é visível: restringir à API Books e às origens permitidas, e revisar cotas.
- [ ] Não incluir segredos de cliente OAuth, tokens ou chaves irrestritas no repositório, em logs ou em `data/sync.json`.
- [ ] Tratar metadados externos como conteúdo não confiável: renderizar texto com segurança e sanitizar descrições que contenham HTML.
- [ ] Implementar timeout, cancelamento de buscas antigas e proteção contra respostas que cheguem fora de ordem.
- [ ] Tratar rede indisponível, `404`, `429`, respostas incompletas e falhas do provedor sem bloquear o restante do app.
- [ ] Usar cache, fila e limites de concorrência; respeitar os limites dos provedores, sem contorná-los ou fazer coleta em massa.

## 7. Prova de conceito e critérios de aceite

- [ ] Criar uma prova de conceito isolada antes de integrar à interface principal.
- [ ] Testar ISBN-10 válido, ISBN-13 válido, `X`, formatação com hífens, ISBN inválido e edição não encontrada.
- [ ] Testar capa ausente, múltiplos autores, ausência de páginas/idioma e descrição com HTML.
- [ ] Testar duplicados, edições diferentes, falha de rede, limite de requisições e fallback.
- [ ] Testar cancelamento e buscas consecutivas, sem aplicar a resposta de um ISBN ao livro errado.
- [ ] Testar revisão manual, persistência após recarga e sincronização, usando dados isolados, sem enviar testes ao arquivo real `data/sync.json`.
- [ ] Confirmar que progresso, dashboard, resenha e citações continuam intactos após o preenchimento de metadados.
- [ ] Validar Edge, PWA e telas pequenas; incrementar a versão do service worker quando a funcionalidade for publicada.

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

1. Melhorar o ciclo CSV: compatibilidade com MyReelReads e exportação da biblioteca.
2. Implementar consulta bibliográfica por ISBN com revisão dos resultados.
3. Prototipar reconhecimento de livros em imagens/frames enviados pela pessoa usuária, medindo falsos positivos e livros não detectados.
4. Validar acesso autorizado a Reels/TikTok e processamento completo de links com IA.
5. Avaliar tags, séries, filtros e demais recursos complementares.

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
