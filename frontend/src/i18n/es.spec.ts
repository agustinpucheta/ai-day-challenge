import { describe, expect, it } from 'vitest';
import { es, fill, plural } from './es';

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'ítem', 'ítems')).toBe('ítem');
    expect(plural(0, 'ítem', 'ítems')).toBe('ítems');
    expect(plural(2, 'ítem', 'ítems')).toBe('ítems');
  });
});

describe('fill', () => {
  it('replaces named placeholders, numbers included', () => {
    expect(fill('{a} de {b}', { a: 3, b: 'doce' })).toBe('3 de doce');
    expect(fill('{a} y {a}', { a: 'x' })).toBe('x y x');
  });

  it('leaves unknown placeholders untouched instead of printing undefined', () => {
    expect(fill('Hola {name}', {})).toBe('Hola {name}');
  });
});

describe('copy helpers', () => {
  it('agrees counts in number', () => {
    expect(es.progress.counts(12, 47)).toBe('12 de 47 terminados');
    expect(es.progress.counts(0, 1)).toBe('0 de 1 terminado');
    expect(es.progress.pending(1)).toBe('1 pendiente');
    expect(es.progress.cancelled(2)).toBe('2 cancelados');
    expect(es.progress.available(17)).toBe('17 disponibles para tomar');
    expect(es.progress.unknown(1)).toBe('1 ítem con estado desconocido');
  });

  it('words the rate limit wait in seconds', () => {
    expect(es.failure.rateLimitedIn(1)).toContain('1 segundo.');
    expect(es.failure.rateLimitedIn(30)).toContain('30 segundos.');
  });

  it('keeps the product terms in English', () => {
    expect(es.common.track).toBe('Track');
    expect(es.common.untrack).toBe('Untrack');
    expect(es.common.storyPoints).toBe('Story points');
  });
});
