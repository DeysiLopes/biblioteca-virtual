import { ExtractedFrame } from './types';

const MAX_DIM = 768;
const JPEG_QUALITY = 0.8;
/** quantos frames tentar extrair de um vídeo */
const TARGET_FRAMES = 8;
/** ignora os primeiros/últimos 8% — vinheta e tela final raramente têm capa */
const EDGE_SKIP = 0.08;

function drawToDataUrl(
  source: CanvasImageSource,
  width: number,
  height: number
): string {
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Falha ao navegar no vídeo'));
    };
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.currentTime = time;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('Não consegui ler esse vídeo'));
    video.src = url;
  });
}

/** Núcleo: extrai frames espaçados de qualquer URL de vídeo já acessível. */
async function extractFramesFromVideoSource(
  url: string,
  targetFrames: number
): Promise<ExtractedFrame[]> {
  const video = await loadVideo(url);
  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    throw new Error('Duração do vídeo indisponível');
  }
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('Vídeo sem dimensões visíveis');

  const start = duration * EDGE_SKIP;
  const end = duration * (1 - EDGE_SKIP);
  const count = Math.max(1, Math.min(targetFrames, Math.floor(duration / 2) || targetFrames));
  const frames: ExtractedFrame[] = [];

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? duration / 2 : start + ((end - start) * i) / (count - 1);
    await seekTo(video, Math.min(t, Math.max(0, duration - 0.05)));
    frames.push({ dataUrl: drawToDataUrl(video, w, h), timeSec: t });
  }
  return frames;
}

/**
 * Extrai frames espaçados de um arquivo de vídeo (reel/short). Roda 100%
 * no navegador — nada sobe a não ser as imagens resultantes.
 */
export async function extractFramesFromVideo(
  file: File,
  targetFrames = TARGET_FRAMES
): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(file);
  try {
    return await extractFramesFromVideoSource(url, targetFrames);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Mesma extração para um blob de vídeo vindo da rede (reel por link). */
export async function extractFramesFromVideoBlob(
  blob: Blob,
  targetFrames = TARGET_FRAMES
): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(blob);
  try {
    return await extractFramesFromVideoSource(url, targetFrames);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Converte imagens (prints de tela) em frames para o mesmo pipeline. */
export async function extractFramesFromImages(files: File[]): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  for (const file of files) {
    frames.push(...(await extractFramesFromImageBlob(file)));
  }
  return frames;
}

/** Mesma conversão para um blob de imagem vindo da rede (capa por link). */
export async function extractFramesFromImageBlob(blob: Blob): Promise<ExtractedFrame[]> {
  const bitmap = await createImageBitmap(blob);
  const frames = [{ dataUrl: drawToDataUrl(bitmap, bitmap.width, bitmap.height) }];
  bitmap.close();
  return frames;
}
