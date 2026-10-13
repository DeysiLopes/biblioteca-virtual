/**
 * reel-proxy — Cloudflare Worker do Minha Biblioteca
 *
 * Resolve o CORS do scan de reels: o app não pode buscar instagram.com
 * direto do navegador, então este worker faz a ponte. Recebe ?url=, busca
 * o conteúdo com User-Agent de browser e devolve com CORS liberado.
 * Um allowlist de hosts impede que ele vire um proxy aberto.
 *
 * Deploy: automático via Workers Builds conectado ao repo (push na main).
 * A URL entra no app via VITE_REEL_PROXY (secret do GitHub no build; .env
 * local em dev) ou meta reelProxy (override por aparelho). Não é segredo —
 * é só um endereço de proxy; o allowlist abaixo impede uso aberto.
 */
const ALLOWED_HOSTS =
  /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|ytimg\.com|kkinstagram\.com)$/;

const UA_BROWSER =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36';
// kkinstagram só libera o mp4 (302 → scontent.cdninstagram.com) para UAs de
// crawler — é o mecanismo do embed de vídeo no Discord/Telegram.
const UA_CRAWLER =
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const raw = new URL(req.url).searchParams.get('url');
    if (!raw) {
      return new Response('faltou ?url=', { status: 400, headers: CORS_HEADERS });
    }
    let target;
    try {
      target = new URL(raw);
    } catch {
      return new Response('url inválida', { status: 400, headers: CORS_HEADERS });
    }
    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.test(target.hostname)) {
      return new Response('host não permitido', { status: 403, headers: CORS_HEADERS });
    }
    const res = await fetch(target.toString(), {
      headers: {
        'User-Agent': /(^|\.)kkinstagram\.com$/.test(target.hostname)
          ? UA_CRAWLER
          : UA_BROWSER,
      },
      redirect: 'follow',
    });
    return new Response(res.body, {
      status: res.status,
      headers: {
        ...CORS_HEADERS,
        'content-type':
          res.headers.get('content-type') ?? 'application/octet-stream',
      },
    });
  },
};
