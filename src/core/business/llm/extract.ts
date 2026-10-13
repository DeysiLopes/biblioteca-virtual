import { getMetaValue, setMetaValue } from '../../storage/idb';
import { callLLM, callLLMCaption } from './providers';
import { parseScannedBooks } from './parse';
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
 * Pipeline do link: resolve → legenda via Jina → LLM de texto (com a capa
 * como frame extra). Sem legenda, cai pro pipeline de frames/vídeo.
 */
export async function extractBooksFromLink(
  config: LLMConfig,
  url: string
): Promise<LinkScanResult> {
  if (!config.apiKey.trim()) {
    throw new Error('Configure uma API key do seu LLM para usar o scan.');
  }
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

  // 1) legenda → LLM de texto (caminho principal — reels literários
  //    costumam listar "Título — Autor" na própria legenda)
  if (reel.caption?.trim()) {
    const raw = await callLLMCaption(config.provider, config.apiKey, reel.caption, frames);
    const books = parseScannedBooks(raw);
    if (books.length) return { books, frames };
    // legenda sem livros identificáveis → tenta a imagem/vídeo abaixo
  }

  // 2) sem legenda útil → frames da capa ou do vídeo
  if (!frames.length) {
    const { frames: extracted, note } = await extractFramesFromReel(reel);
    frames.push(...extracted);
    if (note) return { books: parseScannedBooks(await callLLM(config.provider, config.apiKey, frames)), frames, note };
  }
  if (!frames.length) {
    throw new Error('Não consegui ler nada desse link. Tenta enviar o vídeo/prints.');
  }
  const books = parseScannedBooks(await callLLM(config.provider, config.apiKey, frames));
  return { books, frames, note: reel.caption ? undefined : 'Sem legenda — usei a imagem do reel.' };
}
