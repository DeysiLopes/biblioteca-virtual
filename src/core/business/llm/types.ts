export type LLMProvider = 'gemini' | 'openai' | 'anthropic';

export interface LLMProviderInfo {
  id: LLMProvider;
  label: string;
  model: string;
  keyHint: string;
  keyUrl: string;
}

export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    model: 'gemini-3.8-flash',
    keyHint: 'AIza...',
    keyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    model: 'gpt-4o-mini',
    keyHint: 'sk-...',
    keyUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    model: 'claude-3-5-haiku-latest',
    keyHint: 'sk-ant-...',
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
];

export interface ScannedBook {
  title: string;
  author?: string;
  /** Marcado quando o LLM pareceu pouco confiante ou o título veio truncado. */
  uncertain?: boolean;
}

/** Frame de vídeo/imagem pronto para enviar (JPEG). */
export interface ExtractedFrame {
  dataUrl: string; // data:image/jpeg;base64,...
  /** instante em segundos de onde o frame saiu (vídeo) */
  timeSec?: number;
}
