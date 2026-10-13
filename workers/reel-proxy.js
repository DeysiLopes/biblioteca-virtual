/**
 * reel-proxy — Cloudflare Worker do Minha Biblioteca
 *
 * Resolve o CORS do scan de reels: o app não pode buscar instagram.com
 * direto do navegador, então este worker faz a ponte. Recebe ?url=, busca
 * o conteúdo com User-Agent de browser e devolve com CORS liberado.
 * Um allowlist de hosts impede que ele vire um proxy aberto.
 *
 * Deploy (uma vez, ~5 min, plano free = 100k req/dia):
 *   1. dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Cole este arquivo no editor → Deploy
 *   3. Copie a URL (https://reel-proxy.<sub>.workers.dev)
 *   4. No app: cole a URL no campo "Proxy do reel" da aba Scan
 *      (ou VITE_REEL_PROXY no .env local para desenvolvimento)
 */
const ALLOWED_HOSTS = /(^|\.)(instagram\.com|cdninstagram\.com|fbcdn\.net|ytimg\.com)$/;

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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
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
