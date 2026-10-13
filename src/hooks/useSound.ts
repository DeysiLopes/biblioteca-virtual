import { useState, useRef, useCallback } from 'react';

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Cria/libera o AudioContext dentro de um gesto do usuário (tecla ou clique)
  const ensureCtx = useCallback(async () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!audioCtxRef.current && AudioCtx) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const toggleSound = useCallback(async () => {
    if (!soundEnabled) {
      const ctx = await ensureCtx();
      if (ctx) setSoundEnabled(true);
    } else {
      if (audioCtxRef.current) {
        await audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setSoundEnabled(false);
    }
  }, [soundEnabled, ensureCtx]);

  const playTypewriterKey = useCallback(async (newline: boolean = false) => {
    if (!soundEnabled) return;
    const ctx = await ensureCtx();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const duration = newline ? 0.12 : 0.045;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (samples.length * 0.15));
    }

    const key = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();

    key.buffer = buffer;
    filter.type = 'highpass';
    filter.frequency.value = newline ? 450 : 1200;
    volume.gain.value = 0.14;

    key.connect(filter);
    filter.connect(volume);
    volume.connect(ctx.destination);

    key.onended = () => {
      key.disconnect();
      filter.disconnect();
      volume.disconnect();
    };

    key.start(now);
  }, [soundEnabled, ensureCtx]);

  // "Whoosh" de folha virando: ruído com envelope sobe→desce e
  // bandpass varrendo grave→agudo→grave, como o atrito do papel
  const playPageTurn = useCallback(async () => {
    if (!soundEnabled) return;
    const ctx = await ensureCtx();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const duration = 0.42;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);

    for (let i = 0; i < samples.length; i++) {
      const t = i / samples.length;
      const env = Math.sin(Math.PI * Math.min(t * 1.25, 1));
      const flutter = 0.8 + 0.2 * Math.sin(i * 0.11);
      samples[i] = (Math.random() * 2 - 1) * env * flutter;
    }

    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const volume = ctx.createGain();

    src.buffer = buffer;
    filter.type = 'bandpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(600, now + duration);
    volume.gain.value = 0.32;

    src.connect(filter);
    filter.connect(volume);
    volume.connect(ctx.destination);

    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      volume.disconnect();
    };

    src.start(now);
  }, [soundEnabled, ensureCtx]);

  return {
    soundEnabled,
    toggleSound,
    playTypewriterKey,
    playPageTurn,
  };
}
