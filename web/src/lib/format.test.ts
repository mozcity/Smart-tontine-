import { describe, expect, it } from 'vitest';
import { date, fcfa, parseAmount, pct } from './format';

describe('format', () => {
  it('affiche les montants en FCFA avec séparateur de milliers', () => {
    expect(fcfa(1_250_000)).toBe('1 250 000 F');
    expect(fcfa(null)).toBe('0 F');
  });
  it('lit une saisie de montant', () => {
    expect(parseAmount('10 000')).toBe(10_000);
    expect(parseAmount('abc')).toBe(0);
  });
  it('formate les taux et les dates', () => {
    expect(pct(0.01)).toBe('1 %');
    expect(pct(0.015, 1)).toBe('1,5 %');
    expect(date('2026-10-05')).toBe('05/10/2026');
  });
});
