import { ExtractedFrame } from './types';
import { getMetaValue } from '../../storage/idb';
import {
  extractFramesFromImageBlob,
  extractFramesFromVideoBlob,
} from './frames';

export interface ResolvedReel {
  platform: 'instagram' | 'youtube';
  pageUrl: string;
  /** legenda/título do post — a fonte mais rica para reels literários */
  caption?: string;
  imageUrl?: string;
  videoUrl?: string;
}

const META_REEL_PROXY = 'reelProxy';

/**
 * Proxy próprio (Cloudflare Worker, workers/reel-proxy.js) — estável e
 * dedicado. A URL não fica no código: entra via `VITE_REEL_PROXY` (secret
 * do GitHub injetado no build do deploy; `.env` local em dev) ou via meta
 * `reelProxy` (override por aparelho). Configurado, é tentado antes dos
 * proxies públicos.
 */
async function workerProxyUrl(url: string): Promise<string | null> {
  const meta = (await getMetaValue<string>(META_REEL_PROXY))?.trim();
  const base =
    meta || (import.meta.env.VITE_REEL_PROXY as string | undefined)?.trim();
  if (!base) return null;
  return `${base}${base.includes('?') ? '&' : '?'}url=${encodeURIComponent(url)}`;
}

/**
 * O Instagram bloqueia fetch direto por CORS. Ordem: worker próprio (se
 * configurado) → proxies públicos genéricos — instáveis por natureza.
 */
const PROXIES: Array<(url: string) => string> = [
  (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

export async function fetchViaProxy(url: string): Promise<Response> {
  const worker = await workerProxyUrl(url);
  let lastError: unknown;

  if (worker) {
    try {
      const res = await fetch(worker, { signal: AbortSignal.timeout(25000) });
      if (res.ok) return res;
      lastError = new Error(`worker HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }

  for (const wrap of PROXIES) {
    try {
      const res = await fetch(wrap(url), { signal: AbortSignal.timeout(25000) });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(
    'Não consegui acessar o link (os proxies falharam). Tenta de novo ou envia o vídeo/prints direto.'
  );
}

/** Reader do Jina AI — devolve title/description/metadata da página em JSON. */
async function fetchViaJina(
  pageUrl: string
): Promise<Pick<ResolvedReel, 'caption' | 'imageUrl'> | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${pageUrl}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = (await res.json())?.data;
    if (!data) return null;
    const caption = [data.title, data.description]
      .filter((s): s is string => typeof s === 'string' && !!s.trim())
      .join('\n\n')
      .slice(0, 6000);
    const imageUrl: string | undefined =
      data.metadata?.['twitter:image'] ?? data.metadata?.['og:image'];
    return { caption: caption || undefined, imageUrl };
  } catch {
    return null;
  }
}

/**
 * Baixa uma imagem externa respeitando CORS: weserv (especializado em imagem)
 * primeiro, proxies genéricos como plano B.
 */
export async function fetchImage(url: string): Promise<Response> {
  const bare = url.replace(/^https?:\/\//, '');
  try {
    const res = await fetch(`https://images.weserv.nl/?url=${encodeURIComponent(bare)}`, {
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) return res;
  } catch {
    // tenta os proxies abaixo
  }
  return fetchViaProxy(url);
}

/** Reconhece links de Instagram reel/post e YouTube shorts/vídeos. */
export function parseReelUrl(input: string): ResolvedReel | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');

  if (host === 'instagram.com' || host.endsWith('.instagram.com')) {
    const m = url.pathname.match(/\/(reel|reels|p)\/([\w-]+)/);
    if (!m) return null;
    return {
      platform: 'instagram',
      pageUrl: `https://www.instagram.com/${m[1] === 'p' ? 'p' : 'reel'}/${m[2]}/`,
    };
  }

  let ytId: string | null = null;
  if (host === 'youtu.be') {
    ytId = url.pathname.slice(1).split('/')[0] || null;
  } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
    const shorts = url.pathname.match(/\/shorts\/([\w-]+)/);
    ytId = shorts?.[1] ?? url.searchParams.get('v');
  }
  if (ytId) {
    return {
      platform: 'youtube',
      pageUrl: url.toString(),
      imageUrl: `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
    };
  }
  return null;
}

/** Desescapa sequências \uXXXX e \/ de strings embutidas em JSON. */
function unescapeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
  } catch {
    return raw.replace(/\\\//g, '/');
  }
}

/**
 * Endpoint oembed do próprio Instagram — é o que o embed do WhatsApp/Discord
 * usa, então passa por IPs de datacenter que tomariam 429 na página normal.
 * Devolve legenda (title) + thumbnail_url + media_id.
 */
async function fetchInstagramOembed(
  pageUrl: string
): Promise<Pick<ResolvedReel, 'caption' | 'imageUrl'> | null> {
  try {
    const res = await fetchViaProxy(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(pageUrl)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const caption = typeof data?.title === 'string' ? data.title : undefined;
    const imageUrl =
      typeof data?.thumbnail_url === 'string' ? data.thumbnail_url : undefined;
    return caption || imageUrl ? { caption, imageUrl } : null;
  } catch {
    return null;
  }
}

/** Plano C pro Instagram: HTML da página normal via proxy → video_url embutido. */
async function scrapeInstagramHtml(pageUrl: string): Promise<Partial<ResolvedReel>> {
  const res = await fetchViaProxy(pageUrl);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const meta = (prop: string) =>
    doc.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? undefined;

  let videoUrl = meta('og:video') ?? meta('og:video:url') ?? meta('og:video:secure_url');
  if (!videoUrl) {
    // o mp4 real fica embutido no JSON da página como "video_url":"https:\/\/..."
    const m = html.match(/"video_url":"((?:\\.|[^"\\])*)"/);
    if (m) videoUrl = unescapeJsonString(m[1]);
  }
  return { videoUrl, imageUrl: meta('og:image') };
}

function instagramShortcode(pageUrl: string): string | undefined {
  return pageUrl.match(/\/(?:reel|reels|p)\/([\w-]+)/)?.[1];
}

/**
 * Resolve o link para o que conseguimos ler: legenda (Jina → oembed), capa
 * e URL do vídeo. Para Instagram, o videoUrl vem do kkinstagram (serviço de
 * fixup que devolve 302 → mp4 do CDN quando requisitado com UA de crawler —
 * o worker faz isso). Quando nem legenda nem capa existem, ainda devolve o
 * videoUrl: o download dos frames é quem decide se deu certo.
 */
export async function resolveReelLink(input: string): Promise<ResolvedReel> {
  const reel = parseReelUrl(input);
  if (!reel) {
    throw new Error(
      'Link não reconhecido — cole a URL de um reel do Instagram ou short do YouTube.'
    );
  }
  if (reel.platform === 'youtube' && reel.imageUrl) return reel;

  const code = instagramShortcode(reel.pageUrl);
  const kkVideoUrl = code ? `https://www.kkinstagram.com/reel/${code}/` : undefined;

  const jina = await fetchViaJina(reel.pageUrl);
  let data = jina;
  if (!data?.caption && !data?.imageUrl) {
    const oe = await fetchInstagramOembed(reel.pageUrl);
    if (oe) {
      data = {
        caption: data?.caption ?? oe.caption,
        imageUrl: data?.imageUrl ?? oe.imageUrl,
      };
    }
  }
  if (data?.caption || data?.imageUrl) {
    return { ...reel, ...data, videoUrl: kkVideoUrl };
  }

  // oembed/jina falharam: página normal como última fonte de metadados
  // (o IG responde 429 para IPs de datacenter na maioria das vezes — por isso
  // é a última tentativa, não a primeira)
  const scraped = await scrapeInstagramHtml(reel.pageUrl).catch(() => null);
  if (scraped && (scraped.videoUrl || scraped.imageUrl)) {
    return { ...reel, ...scraped, videoUrl: scraped.videoUrl ?? kkVideoUrl };
  }

  // sem legenda nem capa, mas o vídeo pode existir — extractFrames decide
  if (kkVideoUrl) return { ...reel, videoUrl: kkVideoUrl };

  throw new Error(
    'Não achei legenda, vídeo nem capa nesse link — confere se o post é público.'
  );
}

/**
 * Fallback final: quando só há vídeo/imagem (sem legenda), extrai frames como
 * no caminho de upload.
 */
export async function extractFramesFromReel(
  reel: ResolvedReel
): Promise<{ frames: ExtractedFrame[]; note?: string }> {
  if (reel.videoUrl) {
    try {
      const blob = await (await fetchViaProxy(reel.videoUrl)).blob();
      if (blob.size > 0) {
        // o kkinstagram devolve a foto do post quando o link não é vídeo
        if (blob.type.startsWith('image/')) {
          return {
            frames: await extractFramesFromImageBlob(blob),
            note: 'O post é uma foto — o scan vai usar a imagem.',
          };
        }
        const frames = await extractFramesFromVideoBlob(blob);
        if (frames.length) return { frames };
      }
    } catch {
      // cai para a capa abaixo
    }
  }
  if (reel.imageUrl) {
    const blob = await (await fetchImage(reel.imageUrl)).blob();
    return {
      frames: await extractFramesFromImageBlob(blob),
      note: 'Só consegui a capa do reel — o scan vai usar esse 1 frame.',
    };
  }
  throw new Error('Não consegui baixar o vídeo nem a capa desse link.');
}
