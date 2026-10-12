import { useState, useRef, useCallback } from 'react';

export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const toggleSound = useCallback(async () => {
    if (!soundEnabled) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current && AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          await audioCtxRef.current.resume();
        }
        setSoundEnabled(true);
      } catch (err) {
        console.warn('Não foi possível iniciar o áudio:', err);
      }
    } else {
      if (audioCtxRef.current) {
        await audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setSoundEnabled(false);
    }
  }, [soundEnabled]);

  const playTypewriterKey = useCallback((newline: boolean = false) => {
    if (!soundEnabled || !audioCtxRef.current || audioCtxRef.current.state !== 'running') return;
    const ctx = audioCtxRef.current;
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
  }, [soundEnabled]);

  return {
    soundEnabled,
    toggleSound,
    playTypewriterKey,
  };
}
