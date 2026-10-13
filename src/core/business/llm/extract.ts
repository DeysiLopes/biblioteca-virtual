import { getMetaValue, setMetaValue } from '../../storage/idb';
import { callLLM, callLLMCaption } from './providers';
import { parseScannedBooks } from './parse';
import { parseCaptionBooks } from './caption-parse';
import { ExtractedFrame, LLMProvider, ScannedBook } from './types';
import {
  extractFramesFromReel,
  fetchImage,
  resolveReelLink,
} from './reel-link';
import { extractFramesFromImageBlob } from './frames';

const META_PROVIDER = 'llmProvider';
const META_API_KEY = 'llmApiKey';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
}

function envConfig(): Partial<LLMConfig> {
  const provider = import.meta.env.VITE_LLM_PROVIDER as LLMProvider | undefined;
  const valid = provider === 'gemini' || provider === 'openai' || provider === 'anthropic';
  const resolved = valid ? provider : undefined;
  // VITE_GEMINI_API_KEY (legado do .env) serve de fallback para o Gemini
  const apiKey =
    (import.meta.env.VITE_LLM_API_KEY as string | undefined)?.trim() ||
    (resolved !== 'openai' && resolved !== 'anthropic'
      ? (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim()
      : undefined);
  return { provider: resolved, apiKey: apiKey || undefined };
}

/**
 * Config efetiva: o que a pessoa salvou na interface (meta do IndexedDB)
 * ganha do .env — que serve só para testes locais.
 */
export async function loadLLMConfig(): Promise<LLMConfig> {
  const env = envConfig();
  const provider =
    (await getMetaValue<LLMProvider>(META_PROVIDER)) ?? env.provider ?? 'gemini';
  const apiKey = (await getMetaValue<string>(META_API_KEY)) ?? env.apiKey ?? '';
  return { provider, apiKey };
}

export async function saveLLMConfig(cfg: LLMConfig): Promise<void> {
  await setMetaValue(META_PROVIDER, cfg.provider);
  await setMetaValue(META_API_KEY, cfg.apiKey);
}

/** Pipeline completo: frames → provedor → livros parseados. */
export async function extractBooksFromFrames(
  config: LLMConfig,
  frames: ExtractedFrame[]
): Promise<ScannedBook[]> {
  if (!config.apiKey.trim()) {
    throw new Error('Configure uma API key do seu LLM para usar o scan.');
  }
  if (!frames.length) {
    throw new Error('Nenhum frame para analisar.');
  }
  const raw = await callLLM(config.provider, config.apiKey, frames);
  return parseScannedBooks(raw);
}

export interface LinkScanResult {
  books: ScannedBook[];
  /** frames efetivamente usados (para prévia na UI) */
  frames: ExtractedFrame[];
  note?: string;
}

/**
 * Pipeline do link: resolve → legenda via Jina. Se a legenda já lista os
 * livros ("Título — Autor" numerado), o parser local resolve sem chamar a
 * IA. Só cai pro LLM quando a legenda não entrega nada — texto primeiro,
 * frames do vídeo/capa como fallback. `onNote` avisa a UI quando o scan
 * minucioso com IA começa.
 */
export async function extractBooksFromLink(
  config: LLMConfig,
  url: string,
  onNote?: (note: string) => void
): Promise<LinkScanResult> {
  const reel = await resolveReelLink(url);

  // capa do post como contexto visual extra
  const frames: ExtractedFrame[] = [];
  if (reel.imageUrl) {
    try {
      const blob = await (await fetchImage(reel.imageUrl)).blob();
      frames.push(...(await extractFramesFromImageBlob(blob)));
    } catch {
      // capa é bônus — segue sem ela
    }
  }

  // 1) legenda → parser local (zero custo de IA)
  if (reel.caption?.trim()) {
    const local = parseCaptionBooks(reel.caption);
    if (local.length) {
      return {
        books: local,
        frames,
        note: 'Achei os livros na própria legenda — nem precisei chamar a IA ✨',
      };
    }
  }

  if (!config.apiKey.trim()) {
    throw new Error(
      'Não achei livros na legenda e o scan minucioso precisa de IA — configure sua API key.'
    );
  }

  // 2) vídeo real → frames espaçados do reel inteiro. É a fonte mais rica:
  //    cada livro aparece na tela e criadores costumam legendar o nome.
  //    A capa já está em `frames` e a legenda vai junto como contexto.
  let mediaNote: string | undefined;
  if (reel.videoUrl) {
    onNote?.('Baixando o vídeo do reel para a IA ler os frames…');
    try {
      const got = await extractFramesFromReel(reel);
      frames.push(...got.frames);
      mediaNote = got.note;
    } catch {
      // sem vídeo — segue com a capa/legenda abaixo
      mediaNote = 'Não consegui baixar o vídeo — a IA usou só a capa do post.';
    }
  }

  // 3) LLM de visão sobre tudo que conseguimos (frames do vídeo e/ou capa)
  if (frames.length) {
    const raw = await callLLM(config.provider, config.apiKey, frames, reel.caption);
    const books = parseScannedBooks(raw);
    if (books.length) {
      return {
        books,
        frames,
        note:
          mediaNote ??
          (reel.videoUrl
            ? 'A IA leu os frames do vídeo.'
            : reel.caption
              ? 'Legenda sem lista — a IA leu a imagem do post.'
              : 'Sem legenda — a IA leu a imagem do post.'),
      };
    }
  }

  // 4) visão não achou nada → última chance: LLM de texto sobre a legenda
  if (reel.caption?.trim()) {
    onNote?.('A IA não achou livros nas imagens — tentando extrair do texto da legenda…');
    const raw = await callLLMCaption(config.provider, config.apiKey, reel.caption, frames);
    const books = parseScannedBooks(raw);
    if (books.length) {
      return { books, frames, note: 'A IA extraiu os livros do texto da legenda.' };
    }
  }

  if (!frames.length) {
    throw new Error('Não consegui ler nada desse link. Tenta enviar o vídeo/prints.');
  }
  throw new Error('A IA não identificou livros nesse link. Tenta enviar o vídeo/prints.');
}
