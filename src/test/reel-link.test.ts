import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseReelUrl, resolveReelLink } from '../core/business/llm/reel-link';

beforeEach(() => {
  vi.restoreAllMocks();
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
  it('extrai video_url do JSON embutido no HTML', async () => {
    const html = `<html><head></head><body><script>
      {"x":{"video_url":"https:\\/\\/scontent.cdninstagram.com\\/v\\/reel.mp4?token=abc\\u0026x=1"}}
    </script></body></html>`;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (u: any) => {
        expect(String(u)).toContain('allorigins');
        return new Response(html, { status: 200 });
      })
    );

    const reel = await resolveReelLink('https://www.instagram.com/reel/ABC123/');
    expect(reel.videoUrl).toBe('https://scontent.cdninstagram.com/v/reel.mp4?token=abc&x=1');
  });

  it('usa og:video e og:image das meta tags', async () => {
    const html = `<html><head>
      <meta property="og:video" content="https://cdn.example.com/r.mp4">
      <meta property="og:image" content="https://cdn.example.com/cover.jpg">
    </head></html>`;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(html, { status: 200 })));

    const reel = await resolveReelLink('https://www.instagram.com/reel/ABC123/');
    expect(reel.videoUrl).toBe('https://cdn.example.com/r.mp4');
    expect(reel.imageUrl).toBe('https://cdn.example.com/cover.jpg');
  });

  it('falha com mensagem clara quando não acha nada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html></html>', { status: 200 })));
    await expect(
      resolveReelLink('https://www.instagram.com/reel/ABC123/')
    ).rejects.toThrow('reel é público');
  });

  it('link inválido rejeita antes de buscar', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(resolveReelLink('https://google.com/x')).rejects.toThrow('não reconhecido');
    expect(spy).not.toHaveBeenCalled();
  });
});
