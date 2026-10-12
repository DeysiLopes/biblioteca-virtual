import { describe, it, expect } from 'vitest';
import { buildShareText } from '../core/business/share';
import { Book } from '../core/models/book';

const base: Book = {
  id: 'b1',
  title: 'Dom Casmurro',
  author: 'Machado de Assis',
  status: 'Lido',
  paginas: 256,
  paginasLidas: 256,
  genero: 'Romance',
};

describe('buildShareText', () => {
  it('inclui título, autor, status e progresso', () => {
    const text = buildShareText(base);
    expect(text).toContain('📚 Dom Casmurro — Machado de Assis');
    expect(text).toContain('Lido');
    expect(text).toContain('256/256 páginas');
    expect(text).toContain('Romance');
    expect(text).toContain('Minha Biblioteca');
  });

  it('inclui resenha sem spoiler em destaque, sem aviso', () => {
    const text = buildShareText({ ...base, resenha: 'Obra-prima do ciúme.' });
    expect(text).toContain('📝 Resenha:');
    expect(text).toContain('Obra-prima do ciúme.');
    expect(text).not.toContain('SPOILERS');
  });

  it('resenha com spoiler vai para o fim, depois do aviso', () => {
    const text = buildShareText({
      ...base,
      resenha: 'Bentinho inventou tudo.',
      resenhaSpoilers: true,
    });
    expect(text).toContain('SPOILERS');
    expect(text.indexOf('SPOILERS')).toBeLessThan(text.indexOf('Bentinho inventou tudo.'));
    expect(text).not.toContain('📝 Resenha:');
  });

  it('inclui citações com página', () => {
    const text = buildShareText({
      ...base,
      citacoes: [
        { id: 'c1', text: 'Olhos de ressaca.', page: 42, ts: 1 },
        { id: 'c2', text: 'Um verso de Sá de Miranda.', page: 87, ts: 2 },
      ],
    });
    expect(text).toContain('💬 Citações favoritas:');
    expect(text).toContain('“Olhos de ressaca.” — p.42');
    expect(text).toContain('“Um verso de Sá de Miranda.” — p.87');
  });

  it('omite seções vazias: sem resenha nem citações', () => {
    const text = buildShareText(base);
    expect(text).not.toContain('Resenha');
    expect(text).not.toContain('Citações');
  });
});
