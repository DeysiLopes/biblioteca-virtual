import React from 'react';

/**
 * Fundo mágico da biblioteca: lua crescente, estrelinhas de 4 pontas
 * cintilando (como as luzes de fada das referências) e partículas de
 * poeira encantada flutuando devagar. Tudo decorativo e CSS puro.
 */

type Sparkle = { x: number; y: number; s: number; t: number; d: number; c: string };
type Mote = { x: number; y: number; s: number; t: number; d: number; dx: number; c: string };

const GOLD = '#ffd98a';
const LILAC = '#cdb4ff';
const ROSE = '#f0a6c8';
const MINT = '#9fd8c8';

const SPARKLES: Sparkle[] = [
  { x: 4,  y: 12, s: 14, t: 3.4, d: 0.2,  c: LILAC },
  { x: 12, y: 34, s: 8,  t: 4.2, d: 1.1,  c: GOLD },
  { x: 9,  y: 62, s: 11, t: 3.8, d: 2.0,  c: ROSE },
  { x: 18, y: 8,  s: 7,  t: 5.0, d: 0.6,  c: MINT },
  { x: 26, y: 46, s: 5,  t: 4.6, d: 2.8,  c: GOLD },
  { x: 33, y: 18, s: 12, t: 3.6, d: 1.5,  c: LILAC },
  { x: 41, y: 72, s: 8,  t: 4.4, d: 0.9,  c: MINT },
  { x: 48, y: 5,  s: 9,  t: 5.2, d: 2.4,  c: GOLD },
  { x: 55, y: 38, s: 6,  t: 4.0, d: 3.1,  c: ROSE },
  { x: 62, y: 14, s: 13, t: 3.3, d: 0.4,  c: LILAC },
  { x: 70, y: 58, s: 7,  t: 4.8, d: 1.8,  c: GOLD },
  { x: 78, y: 30, s: 10, t: 3.9, d: 2.6,  c: MINT },
  { x: 86, y: 70, s: 12, t: 3.5, d: 1.2,  c: ROSE },
  { x: 93, y: 44, s: 8,  t: 4.5, d: 0.7,  c: LILAC },
  { x: 15, y: 86, s: 9,  t: 4.1, d: 3.4,  c: GOLD },
  { x: 52, y: 88, s: 11, t: 3.7, d: 1.9,  c: LILAC },
  { x: 88, y: 12, s: 6,  t: 5.4, d: 2.2,  c: GOLD },
  { x: 37, y: 92, s: 7,  t: 4.9, d: 0.3,  c: MINT },
];

const MOTES: Mote[] = [
  { x: 8,  y: 78, s: 4, t: 16, d: 0,   dx: 26,  c: GOLD },
  { x: 20, y: 90, s: 3, t: 21, d: 4,   dx: -18, c: LILAC },
  { x: 32, y: 84, s: 5, t: 18, d: 8,   dx: 30,  c: ROSE },
  { x: 45, y: 95, s: 3, t: 23, d: 2,   dx: -24, c: GOLD },
  { x: 58, y: 80, s: 4, t: 17, d: 11,  dx: 20,  c: MINT },
  { x: 68, y: 92, s: 3, t: 20, d: 6,   dx: -28, c: LILAC },
  { x: 79, y: 86, s: 5, t: 19, d: 13,  dx: 16,  c: GOLD },
  { x: 90, y: 76, s: 4, t: 22, d: 3,   dx: -20, c: ROSE },
  { x: 14, y: 60, s: 3, t: 24, d: 9,   dx: 22,  c: MINT },
  { x: 63, y: 66, s: 4, t: 15, d: 5,   dx: -16, c: GOLD },
  { x: 85, y: 55, s: 3, t: 20, d: 14,  dx: 24,  c: LILAC },
  { x: 27, y: 48, s: 3, t: 18, d: 7,   dx: -22, c: ROSE },
];

export const MagicBackdrop: React.FC = () => (
  <div className="magic-bg" aria-hidden="true">
    <span className="aurora" />
    <span className="moon" />
    {SPARKLES.map((s, i) => (
      <i
        key={`s${i}`}
        className="sparkle"
        style={{
          left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s,
          ['--t' as string]: `${s.t}s`, ['--d' as string]: `${s.d}s`, ['--c' as string]: s.c,
        }}
      />
    ))}
    {MOTES.map((m, i) => (
      <i
        key={`m${i}`}
        className="mote"
        style={{
          left: `${m.x}%`, top: `${m.y}%`, width: m.s, height: m.s,
          ['--t' as string]: `${m.t}s`, ['--d' as string]: `${m.d}s`,
          ['--dx' as string]: `${m.dx}px`, ['--c' as string]: m.c,
        }}
      />
    ))}
  </div>
);
