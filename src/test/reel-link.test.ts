import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchViaProxy,
  parseReelUrl,
  resolveReelLink,
} from '../core/business/llm/reel-link';
import { setMetaValue, clearStore } from '../core/storage/idb';

beforeEach(async () => {
  vi.restoreAllMocks();
  await clearStore('meta');
});

describe('parseReelUrl', () => {
  it('reconhece reel e post do Instagram e normaliza a URL', () => {
    expect(parseReelUrl('https://www.instagram.com/reel/ABC123/?igsh=xyz')).toMatchObject({
      platform: 'instagram',
      pageUrl: 'https://www.instagram.com/reel/ABC123/',
    });
    expect(parseReelUrl('https://instagram.com/reels/XYZ-9')).toMatchObject({
      pageUrl: 'https://www.instagram.com/reel/XYZ-9/',
    });
    expect(parseReelUrl('https://www.instagram.com/p/PQR456/')).toMatchObject({
      pageUrl: 'https://www.instagram.com/p/PQR456/',
    });
  });

  it('reconhece shorts e watch do YouTube com thumbnail direta', () => {
    expect(parseReelUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toMatchObject({
      platform: 'youtube',
      imageUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    });
    expect(parseReelUrl('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({
      platform: 'youtube',
    });
  });

  it('rejeita lixo', () => {
    expect(parseReelUrl('nao é url')).toBeNull();
    expect(parseReelUrl('https://google.com/x')).toBeNull();
    expect(parseReelUrl('https://www.instagram.com/')).toBeNull();
  });
});

describe('resolveReelLink', () => {
  it('via Jina: devolve legenda e capa do metadata', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: any) => {
        expect(String(u)).toContain('r.jina.ai');
        return new Response(
          JSON.stringify({
            data: {
              title: 'LIVRARIA on Instagram: "4 thrillers: A, B, C, D"',
              description: '100 likes',
              metadata: { 'twitter:image': 'https://cdn.example.com/cover.jpg' },
            },
          }),
          { status: 200 }
        );
      })
    );

    const reel = await resolveReelLink('https://www.instagram.com/reel/ABC123/');
    expect(reel.caption).toContain('4 thrillers');
    expect(reel.imageUrl).toBe('https://cdn.example.com/cover.jpg');
  });

  it('fallback: extrai video_url do HTML quando o Jina falha', async () => {
    const html = `<html><head></head><body><script>
      {"x":{"video_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/reel.mp4?token=abc\\u0026x=1"}}
    </script></body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: any) => {
        const s = String(u);
        if (s.includes('r.jina.ai')) return new Response('err', { status: 500 });
        return new Response(html, { status: 200 });
      })
    );

    const reel = await resolveReelLink('https://www.instagram.com/reel/ABC123/');
    expect(reel.videoUrl).toBe('https://scontent.cdninstagram.com/v/reel.mp4?token=abc&x=1');
  });

  it('falha com mensagem clara quando não acha nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    await expect(
      resolveReelLink('https://www.instagram.com/reel/ABC123/')
    ).rejects.toThrow('público');
  });

  it('usa o worker próprio antes dos proxies públicos quando configurado', async () => {
    await setMetaValue('reelProxy', 'https://reel-proxy.eu.workers.dev');
    const html = `<html><head></head><body><script>
      {"x":{"video_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/reel.mp4"}}
    </script></body></html>`;
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: any) => {
        const s = String(u);
        calls.push(s);
        if (s.includes('r.jina.ai')) return new Response('err', { status: 500 });
        return new Response(html, { status: 200 });
      })
    );

    const reel = await resolveReelLink('https://www.instagram.com/reel/ABC123/');
    expect(reel.videoUrl).toContain('scontent.cdninstagram.com');
    // o worker foi a primeira (e única) fonte de proxy chamada
    const proxied = calls.filter((s) => !s.includes('r.jina.ai'));
    expect(proxied).toHaveLength(1);
    expect(proxied[0]).toContain('reel-proxy.eu.workers.dev');
  });

  it('link inválido rejeita antes de buscar', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(resolveReelLink('https://google.com/x')).rejects.toThrow('não reconhecido');
    expect(spy).not.toHaveBeenCalled();
  });
});
