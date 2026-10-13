import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseScannedBooks } from '../core/business/llm/parse';
import { callLLM } from '../core/business/llm/providers';
import { ExtractedFrame } from '../core/business/llm/types';

const frame: ExtractedFrame = { dataUrl: 'data:image/jpeg;base64,QUJD', timeSec: 3 };

function lastFetch() {
  const mock = vi.mocked(fetch);
  const [url, init] = mock.mock.calls[mock.mock.calls.length - 1] as any;
  return { url: String(url), init, body: JSON.parse(init.body) };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('parseScannedBooks', () => {
  it('extrai array JSON limpo', () => {
    const out = parseScannedBooks(
      '[{"title":"Dom Casmurro","author":"Machado de Assis"},{"title":"Coraline"}]'
    );
    expect(out).toEqual([
      { title: 'Dom Casmurro', author: 'Machado de Assis', uncertain: false },
      { title: 'Coraline', author: undefined, uncertain: false },
    ]);
  });

  it('tolera cerca de markdown e texto extra', () => {
    const out = parseScannedBooks(
      'Achei estes livros!\n```json\n[{"title":"A Hora da Estrela"}]\n```\nEspero ter ajudado.'
    );
    expect(out).toEqual([
      { title: 'A Hora da Estrela', author: undefined, uncertain: false },
    ]);
  });

  it('ignora itens malformados e títulos repetidos', () => {
    const out = parseScannedBooks(
      '[{"title":"X"},{"title":"Duna"},{"title":"duna","author":"Herbert"},42,null]'
    );
    expect(out.map((b) => b.title)).toEqual(['Duna']);
  });

  it('resposta vazia ou inválida devolve []', () => {
    expect(parseScannedBooks('')).toEqual([]);
    expect(parseScannedBooks('sem json aqui')).toEqual([]);
    expect(parseScannedBooks('{"books": []}')).toEqual([]);
  });
});

describe('providers — formato da chamada', () => {
  it('gemini envia prompt + imagens inline e lê candidates[].parts[].text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '[{"title":"Livro"}]' }] } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const raw = await callLLM('gemini', 'key-123', [frame]);
    const { url, body } = lastFetch();

    expect(url).toContain('generativelanguage.googleapis.com');
    expect(url).toContain('key=key-123');
    const parts = body.contents[0].parts;
    expect(parts[0].text).toContain('DISTINCT book');
    expect(parts[1].inline_data).toEqual({ mime_type: 'image/jpeg', data: 'QUJD' });
    expect(raw).toBe('[{"title":"Livro"}]');
  });

  it('openai envia image_url data-url e desembrulha {"books":[...]}', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"books":[{"title":"Neuromancer"}]}' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const raw = await callLLM('openai', 'sk-x', [frame]);
    const { url, init, body } = lastFetch();

    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-x');
    expect(body.messages[0].content[1].image_url.url).toBe(frame.dataUrl);
    expect(raw).toBe('[{"title":"Neuromancer"}]');
  });

  it('anthropic envia base64 com header de acesso direto do navegador', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ content: [{ type: 'text', text: '[{"title":"Kindred"}]' }] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      )
    );

    const raw = await callLLM('anthropic', 'sk-ant-x', [frame]);
    const { url, init, body } = lastFetch();

    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-x');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(body.messages[0].content[0].source.data).toBe('QUJD');
    expect(raw).toBe('[{"title":"Kindred"}]');
  });

  it('erro da API propaga mensagem com status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { message: 'invalid key' } }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      )
    );
    await expect(callLLM('gemini', 'bad', [frame])).rejects.toThrow('401');
  });
});
