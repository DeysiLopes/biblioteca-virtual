import { BOOK_EXTRACTION_PROMPT } from './prompt';
import { ExtractedFrame, LLMProvider, LLM_PROVIDERS } from './types';

const TIMEOUT_MS = 60000;

function toBase64(dataUrl: string): string {
  return dataUrl.slice(dataUrl.indexOf(',') + 1);
}

async function timedFetch(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function assertOk(res: Response, provider: string): Promise<void> {
  if (res.ok) return;
  let detail = res.statusText;
  try {
    const body = await res.json();
    detail = body?.error?.message || detail;
  } catch {
    // mantém o statusText
  }
  throw new Error(`${provider}: ${res.status} — ${detail}`);
}

async function callGemini(apiKey: string, frames: ExtractedFrame[]): Promise<string> {
  const model = LLM_PROVIDERS.find((p) => p.id === 'gemini')!.model;
  const res = await timedFetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: BOOK_EXTRACTION_PROMPT },
              ...frames.map((f) => ({
                inline_data: { mime_type: 'image/jpeg', data: toBase64(f.dataUrl) },
              })),
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.2,
        },
      }),
    }
  );
  await assertOk(res, 'Gemini');
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAI(apiKey: string, frames: ExtractedFrame[]): Promise<string> {
  const model = LLM_PROVIDERS.find((p) => p.id === 'openai')!.model;
  const res = await timedFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: `${BOOK_EXTRACTION_PROMPT}\nReturn JSON: {"books": [...]}` },
            ...frames.map((f) => ({
              type: 'image_url',
              image_url: { url: f.dataUrl, detail: 'low' },
            })),
          ],
        },
      ],
    }),
  });
  await assertOk(res, 'OpenAI');
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';
  // openai em modo json_object envolve num objeto — pega o array de dentro
  try {
    const obj = JSON.parse(text);
    if (Array.isArray(obj)) return text;
    const arr = obj.books ?? Object.values(obj).find(Array.isArray);
    return Array.isArray(arr) ? JSON.stringify(arr) : text;
  } catch {
    return text;
  }
}

async function callAnthropic(apiKey: string, frames: ExtractedFrame[]): Promise<string> {
  const model = LLM_PROVIDERS.find((p) => p.id === 'anthropic')!.model;
  const res = await timedFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      // Exigido para chamada direta do navegador — sem proxy
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            ...frames.map((f) => ({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: toBase64(f.dataUrl),
              },
            })),
            { type: 'text', text: BOOK_EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });
  await assertOk(res, 'Anthropic');
  const data = await res.json();
  const blocks: any[] = data?.content ?? [];
  return blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

const CALLERS: Record<LLMProvider, (apiKey: string, frames: ExtractedFrame[]) => Promise<string>> = {
  gemini: callGemini,
  openai: callOpenAI,
  anthropic: callAnthropic,
};

/** Envia os frames ao provedor escolhido e devolve o texto cru da resposta. */
export function callLLM(
  provider: LLMProvider,
  apiKey: string,
  frames: ExtractedFrame[]
): Promise<string> {
  return CALLERS[provider](apiKey, frames);
}
