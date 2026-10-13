import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLibrary } from '../hooks/useLibrary';
import { Book, BookStatus } from '../core/models/book';
import {
  fetchBookByISBN,
  findMetadataForBook,
  applyMetadata,
  needsMetadata,
  OpenLibraryRateLimitError,
  type OpenLibrarySearchResult,
} from '../core/business/open-library';
import { importBooksContent } from '../core/business/csv-parser';
import { downloadBooksCSV } from '../core/business/csv-export';
import { ensureCoverCached } from '../core/storage/cover-cache';
import { ReelScanner } from '../components/scan/ReelScanner';
import { ScannedBook } from '../core/business/llm/types';

export const AddBookPage: React.FC = () => {
  const navigate = useNavigate();
  const { books, saveBook, saveBatch } = useLibrary();

  const [tab, setTab] = useState<'scan' | 'isbn' | 'manual' | 'import' | 'enrich'>('scan');

  // Form states
  const [isbnInput, setIsbnInput] = useState('');
  const [isbnLoading, setIsbnLoading] = useState(false);
  const [isbnMessage, setIsbnMessage] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<BookStatus>('Quero ler');
  const [genero, setGenero] = useState('');
  const [paginas, setPaginas] = useState<number | ''>('');
  const [cover, setCover] = useState('');
  const [codigoIsbn, setCodigoIsbn] = useState('');
  const [comentarios, setComentarios] = useState('');
  const [saving, setSaving] = useState(false);

  // Enriquecimento em lote (ISBN + capa via Open Library)
  const [enriching, setEnriching] = useState(false);
  const [enrichLog, setEnrichLog] = useState<string[]>([]);
  const [importEnrich, setImportEnrich] = useState<string | null>(null);
  const booksRef = useRef(books);
  useEffect(() => {
    booksRef.current = books;
  }, [books]);

  // Import batch states
  const [importText, setImportText] = useState('');
  const [importReport, setImportReport] = useState<string | null>(null);

  // Livros vindos do scan de reels: entram como "Quero ler" e o
  // enriquecimento (ISBN/capa) roda em segundo plano como na importação
  const handleScanAdd = async (candidates: ScannedBook[]) => {
    const newBooks: Book[] = candidates.map((c) => ({
      id: crypto.randomUUID(),
      title: c.title.trim(),
      author: c.author?.trim() || '',
      status: 'Quero ler',
      genero: null,
      paginas: null,
      paginasLidas: 0,
      cover: '',
      codigo_isbn: null,
      comentarios: '',
      citacoes: [],
      deletedCitacoes: [],
      readingEpoch: 0,
      updatedAt: Date.now(),
    }));
    await saveBatch(newBooks);
    void enrichBooksInBackground(newBooks, () => {});
  };

  const handleIsbnSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isbnInput.trim()) return;

    setIsbnLoading(true);
    setIsbnMessage(null);

    const result = await fetchBookByISBN(isbnInput);
    setIsbnLoading(false);

    if (result) {
      setTitle(result.title);
      setAuthor(result.author);
      if (result.paginas) setPaginas(result.paginas);
      if (result.cover) setCover(result.cover);
      if (result.isbn) setCodigoIsbn(result.isbn);
      setIsbnMessage('Metadados encontrados com sucesso! Confira e salve abaixo.');
      setTab('manual');
    } else {
      setIsbnMessage('ISBN não encontrado na Open Library. Você pode preencher os campos manualmente.');
      setTab('manual');
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('O título do livro é obrigatório.');
      return;
    }

    setSaving(true);
    const newBook: Book = {
      id: crypto.randomUUID(),
      title: title.trim(),
      author: author.trim(),
      status,
      genero: genero.trim() || null,
      paginas: typeof paginas === 'number' ? paginas : null,
      paginasLidas: 0,
      cover: cover.trim() || '',
      codigo_isbn: codigoIsbn.replace(/[^0-9X]/gi, '').toUpperCase() || null,
      comentarios: comentarios.trim() || '',
      citacoes: [],
      deletedCitacoes: [],
      readingEpoch: 0,
      updatedAt: Date.now(),
    };

    try {
      // Busca ISBN/capa na Open Library antes de salvar (best-effort)
      let enriched = newBook;
      try {
        const meta = await findMetadataForBook(newBook);
        enriched = applyMetadata(newBook, meta) || newBook;
      } catch {
        // rede indisponível não impede o cadastro
      }
      await saveBook(enriched);
      alert(`Livro "${title}" adicionado com sucesso!`);
      navigate('/estante');
    } catch (err) {
      console.error('Erro ao adicionar livro:', err);
      alert('Erro ao salvar o livro.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setImportText(text);
      }
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (!books.length) {
      alert('A biblioteca está vazia — nada pra exportar ainda.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBooksCSV(books, `minha-biblioteca-${stamp}.csv`);
  };

  const handleImportBatch = async () => {
    if (!importText.trim()) {
      alert('Cole o conteúdo CSV/JSON ou selecione um arquivo.');
      return;
    }

    const { added, skippedCount, errors } = importBooksContent(importText, books);

    if (added.length === 0) {
      setImportReport(
        `Nenhum novo livro adicionado. ${skippedCount} já existiam na biblioteca. ${
          errors.length ? `Erros: ${errors.join(', ')}` : ''
        }`
      );
      return;
    }

    await saveBatch(added);
    setImportReport(
      `✓ Sucesso! ${added.length} livro(s) importado(s) com sucesso. (${skippedCount} ignorados por duplicidade).`
    );
    setImportText('');

    // Enriquece ISBN/capa em segundo plano — o usuário pode sair da página
    const pending = added.filter(needsMetadata);
    if (pending.length > 0) {
      setImportEnrich(`Buscando ISBN e capas em segundo plano (0/${pending.length})...`);
      void enrichBooksInBackground(pending, (done, total) =>
        setImportEnrich(
          done < total
            ? `Buscando ISBN e capas em segundo plano (${done}/${total})...`
            : `✨ ISBN/capas: busca concluída para ${total} livro(s).`
        )
      );
    }
  };

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Busca metadados com uma retentativa após 30s quando a OL limita (429)
  const findMetaWithRetry = async (
    b: Book,
    onRateLimit?: () => void
  ): Promise<OpenLibrarySearchResult | null> => {
    try {
      return await findMetadataForBook(b);
    } catch (e) {
      if (e instanceof OpenLibraryRateLimitError) {
        onRateLimit?.();
        await sleep(30000);
        return await findMetadataForBook(b);
      }
      return null;
    }
  };

  const enrichBooksInBackground = async (
    list: Book[],
    onProgress: (done: number, total: number) => void
  ) => {
    for (let i = 0; i < list.length; i++) {
      try {
        const meta = await findMetaWithRetry(list[i]);
        // Aplica sobre a versão mais recente para não sobrescrever edições
        const current =
          booksRef.current.find((x) => x.id === list[i].id) || list[i];
        const updated = applyMetadata(current, meta);
        if (updated) {
          await saveBook(updated);
          // Capa recém-encontrada: guarda em Minha Biblioteca/capas
          void ensureCoverCached(updated);
        }
      } catch {
        // limite persistente (429 mesmo após retentativa): encerra a fila
        break;
      }
      onProgress(i + 1, list.length);
      if (i < list.length - 1) await sleep(1500);
    }
  };

  const handleEnrichLibrary = async () => {
    if (enriching) return;
    const candidates = books.filter(needsMetadata);
    if (!candidates.length) {
      setEnrichLog(['Todos os livros já têm ISBN e capa. Nada a fazer. ✨']);
      return;
    }

    setEnriching(true);
    setEnrichLog([`Buscando metadados para ${candidates.length} livro(s) na Open Library...`]);
    const log = (line: string) => setEnrichLog((prev) => [...prev, line]);
    let found = 0;
    let missed = 0;

    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      try {
        const meta = await findMetaWithRetry(b, () =>
          log('⏳ Limite da Open Library atingido — aguardando 30s...')
        );
        const current =
          booksRef.current.find((x) => x.id === b.id) || b;
        const updated = applyMetadata(current, meta);
        if (updated) {
          await saveBook(updated);
          // Capa recém-encontrada: guarda em Minha Biblioteca/capas
          void ensureCoverCached(updated);
          found++;
          log(`✓ ${b.title}${meta?.isbn ? ` → ISBN ${meta.isbn}` : ' → capa encontrada'}`);
        } else {
          missed++;
          log(`— ${b.title}: sem correspondência confiável`);
        }
      } catch (e) {
        if (e instanceof OpenLibraryRateLimitError) {
          log('🚫 Open Library segue limitando — varredura pausada. Tente de novo em alguns minutos.');
          break;
        }
        missed++;
        log(`— ${b.title}: falha na consulta`);
      }
      // Open Library: ~1 req/s para uso público
      if (i < candidates.length - 1) await sleep(1500);
    }

    log(`Concluído: ${found} atualizado(s), ${missed} sem resultado.`);
    setEnriching(false);
  };

  return (
    <div className="add-book-page" style={{ maxWidth: 760, margin: '0 auto' }}>
      <h2 className="serif" style={{ fontSize: 28, margin: '0 0 16px', color: 'var(--ink)' }}>
        Adicionar Livros à Biblioteca
      </h2>

      {/* Seletor de método de entrada — o scan com IA é a forma principal */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className={`pill ${tab === 'scan' ? 'on' : ''}`}
          onClick={() => setTab('scan')}
        >
          🎬 Scan de reel
        </button>
        <button
          className={`pill ${tab === 'isbn' ? 'on' : ''}`}
          onClick={() => setTab('isbn')}
        >
          🔍 Buscar por ISBN
        </button>
        <button
          className={`pill ${tab === 'manual' ? 'on' : ''}`}
          onClick={() => setTab('manual')}
        >
          ✍️ Entrada Manual
        </button>
        <button
          className={`pill ${tab === 'import' ? 'on' : ''}`}
          onClick={() => setTab('import')}
        >
          📂 Importar CSV / JSON
        </button>
        <button
          className={`pill ${tab === 'enrich' ? 'on' : ''}`}
          onClick={() => setTab('enrich')}
        >
          ✨ Capas & ISBN
        </button>
      </div>

      {isbnMessage && (
        <div
          style={{
            background: 'oklch(0.24 0.04 40 / 0.8)',
            border: '1px solid var(--accent)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 14,
          }}
        >
          {isbnMessage}
        </div>
      )}

      {/* Tab principal: scan de reels com IA */}
      {tab === 'scan' && <ReelScanner books={books} onAdd={handleScanAdd} />}

      {/* Tab 1: ISBN */}
      {tab === 'isbn' && (
        <form
          onSubmit={handleIsbnSearch}
          style={{
            background: 'var(--paper2)',
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--line)',
          }}
        >
          <p style={{ margin: '0 0 14px', color: 'var(--ink2)', fontSize: 14 }}>
            Informe o ISBN de 10 ou 13 dígitos para buscar capa, autor e metadados na Open Library:
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              placeholder="Ex: 9788535902778"
              value={isbnInput}
              onChange={(e) => setIsbnInput(e.target.value)}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--paper)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            />
            <button
              type="submit"
              disabled={isbnLoading}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#17100f',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isbnLoading ? 'Buscando...' : 'Buscar ISBN'}
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Manual */}
      {tab === 'manual' && (
        <form
          onSubmit={handleManualSubmit}
          style={{
            background: 'var(--paper2)',
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div className="field">
            <label htmlFor="mTitle" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
              Título do livro *:
            </label>
            <input
              id="mTitle"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: 'var(--paper)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="mAuthor" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
              Autor(a):
            </label>
            <input
              id="mAuthor"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: 'var(--paper)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="mStatus" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                Status:
              </label>
              <select
                id="mStatus"
                value={status}
                onChange={(e) => setStatus(e.target.value as BookStatus)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                }}
              >
                <option value="Quero ler">Quero ler</option>
                <option value="Lendo">Lendo</option>
                <option value="Lido">Lido</option>
                <option value="Abandonado">Abandonado</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="mGenero" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                Gênero:
              </label>
              <input
                id="mGenero"
                type="text"
                placeholder="Ex: Ficção Científica"
                value={genero}
                onChange={(e) => setGenero(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="field">
              <label htmlFor="mPaginas" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                Total de páginas:
              </label>
              <input
                id="mPaginas"
                type="number"
                min={0}
                value={paginas}
                onChange={(e) =>
                  setPaginas(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                }
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="mIsbn" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                ISBN (codigo_isbn):
              </label>
              <input
                id="mIsbn"
                type="text"
                placeholder="Ex: 9788535902778"
                value={codigoIsbn}
                onChange={(e) => setCodigoIsbn(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="mCover" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
                URL da Capa:
              </label>
              <input
                id="mCover"
                type="url"
                placeholder="https://..."
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                  border: '1px solid var(--line)',
                }}
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="mComent" style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>
              Comentários / Observações:
            </label>
            <textarea
              id="mComent"
              rows={3}
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                background: 'var(--paper)',
                color: 'var(--ink)',
                border: '1px solid var(--line)',
                resize: 'vertical',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '12px 20px',
              borderRadius: 8,
              background: 'var(--green)',
              color: '#0f1a12',
              fontWeight: 800,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
              marginTop: 10,
            }}
          >
            {saving ? 'Salvando...' : 'Adicionar à Estante'}
          </button>
        </form>
      )}

      {/* Tab 3: Import em lote */}
      {tab === 'import' && (
        <div
          style={{
            background: 'var(--paper2)',
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--line)',
          }}
        >
          <p style={{ margin: '0 0 12px', color: 'var(--ink2)', fontSize: 14 }}>
            Faça upload de um arquivo CSV ou JSON de livros, ou cole o conteúdo de texto abaixo:
          </p>

          <input
            type="file"
            accept=".csv, .txt, .json"
            onChange={handleFileUpload}
            style={{ marginBottom: 14, display: 'block' }}
          />

          <textarea
            rows={8}
            placeholder="Cole aqui o conteúdo CSV (com cabeçalhos) ou JSON..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--paper)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              fontFamily: 'monospace',
              fontSize: 13,
              marginBottom: 14,
            }}
          />

          {importReport && (
            <div
              style={{
                background: 'oklch(0.25 0.05 40 / 0.8)',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 14,
                color: 'var(--ink)',
              }}
            >
              {importReport}
            </div>
          )}

          {importEnrich && (
            <div
              style={{
                background: 'oklch(0.24 0.04 40 / 0.8)',
                border: '1px solid var(--accent)',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 14,
                fontSize: 13,
                color: 'var(--ink)',
              }}
            >
              {importEnrich}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              onClick={handleImportBatch}
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                background: 'var(--accent)',
                color: '#17100f',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Processar e Importar Livros
            </button>
            <button
              type="button"
              className="pill"
              onClick={handleExportCSV}
              title="Baixa todos os livros da biblioteca em CSV (Excel/Sheets/Notion)"
            >
              ⬇️ Exportar CSV ({books.length})
            </button>
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 11, color: 'var(--ink2)' }}>
            O CSV traz todos os campos do livro; citações saem como texto legível. Para
            restauração completa (IDs, diário, timestamps), use o backup JSON no header.
          </p>
        </div>
      )}

      {/* Tab 4: Enriquecimento em lote */}
      {tab === 'enrich' && (
        <div
          style={{
            background: 'var(--paper2)',
            padding: 20,
            borderRadius: 12,
            border: '1px solid var(--line)',
          }}
        >
          <p style={{ margin: '0 0 12px', color: 'var(--ink2)', fontSize: 14 }}>
            Procura cada livro da estante na Open Library pelo título e autor, e preenche{' '}
            <code>codigo_isbn</code> e a capa quando encontra uma correspondência confiável.
            Livros que já têm ISBN e capa são ignorados — nada é sobrescrito.
          </p>

          <button
            type="button"
            onClick={handleEnrichLibrary}
            disabled={enriching}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              background: 'var(--accent)',
              color: '#17100f',
              fontWeight: 800,
              border: 'none',
              cursor: enriching ? 'wait' : 'pointer',
              opacity: enriching ? 0.7 : 1,
            }}
          >
            {enriching ? 'Buscando...' : '✨ Buscar capas e ISBN para a estante'}
          </button>

          {enrichLog.length > 0 && (
            <div
              style={{
                marginTop: 14,
                maxHeight: 260,
                overflowY: 'auto',
                background: 'oklch(0 0 0 / 0.25)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: '10px 12px',
                fontFamily: 'monospace',
                fontSize: 12.5,
                lineHeight: 1.7,
                color: 'var(--ink)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {enrichLog.join('\n')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
