// Simulatore della fase 2: partite complete senza errori, riproducibilità, Testata casuale (D43), varianti.
import { describe, expect, it } from 'vitest';
import { configPer, nuovaPartita } from '../src';
import { casuale, semplice } from '../sim/politiche';
import { applicaVariante, esitoTestataCasuale, generatore, giocaPartita, simula } from '../sim/simulatore';
import { riassumi } from '../sim/statistiche';

describe('Simulatore', () => {
  it.each([2, 3, 4])('a %i giocatori completa 25 partite per politica senza errori né stalli', { timeout: 120_000 }, (n) => {
    for (const politica of [casuale, semplice]) {
      const r = riassumi(simula({ numeroGiocatori: n, partite: 25, semeIniziale: 100, politica }));
      expect(r.errori + r.stalli, r.esempiErrori.join('\n')).toBe(0);
      expect(r.partite).toBe(25);
      expect(Object.values(r.modi).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
      expect(r.round.min).toBeGreaterThanOrEqual(1);
    }
  });

  it('stesso seme ⇒ stessa partita', () => {
    const a = giocaPartita({ numeroGiocatori: 3, seme: 7, politica: semplice });
    const b = giocaPartita({ numeroGiocatori: 3, seme: 7, politica: semplice });
    expect(a).toEqual(b);
    const c = giocaPartita({ numeroGiocatori: 3, seme: 8, politica: semplice });
    expect(c).not.toEqual(a);
  });

  it('la politica semplice propone quasi sempre azioni valide', { timeout: 60_000 }, () => {
    const r = riassumi(simula({ numeroGiocatori: 3, partite: 30, semeIniziale: 1, politica: semplice }));
    expect(r.ripieghi).toBe(0);
  });
});

describe('Esito casuale della Testata (D43)', () => {
  it('rispetta le probabilità 20/40/30/10 e non supera il massimo', () => {
    const r = generatore(42);
    const conta = [0, 0, 0, 0];
    const prove = 20_000;
    for (let i = 0; i < prove; i++) conta[esitoTestataCasuale(3, r)]!++;
    expect(conta.map((x) => x / prove)).toEqual([
      expect.closeTo(0.2, 1),
      expect.closeTo(0.4, 1),
      expect.closeTo(0.3, 1),
      expect.closeTo(0.1, 1),
    ]);
    for (let i = 0; i < 1000; i++) expect(esitoTestataCasuale(1, r)).toBeLessThanOrEqual(1);
    for (let i = 0; i < 100; i++) expect(esitoTestataCasuale(0, r)).toBe(0);
  });
});

describe('Varianti di bilanciamento', () => {
  it('cambiano posti, agnellini totali (con il Gregge) e dado nello stato', () => {
    const s = nuovaPartita({
      giocatori: [
        { id: 'a', nome: 'A', pecora: 'ricciolo' },
        { id: 'b', nome: 'B', pecora: 'nerina' },
        { id: 'c', nome: 'C', pecora: 'sospirella' },
      ],
      seme: 1,
    });
    const gregge = s.gregge;
    const base = configPer(3);
    applicaVariante(s, {
      nome: 'prova',
      postiOvile: { 3: base.postiOvile + 3 },
      agnelliniTotali: { 3: base.agnelliniTotali + 9 },
      dado: [{ id: 'pascolo_piccolo', effetto: 'pascolo', quantita: 3, copie: 6 }],
    });
    expect(s.config.postiOvile).toBe(base.postiOvile + 3);
    expect(s.config.agnelliniTotali).toBe(base.agnelliniTotali + 9);
    expect(s.gregge).toBe(gregge + 9);
    expect(s.config.dado).toHaveLength(1);
  });

  it('una variante per un altro numero di giocatori non cambia nulla', () => {
    const r1 = giocaPartita({ numeroGiocatori: 3, seme: 3, politica: semplice });
    const r2 = giocaPartita({ numeroGiocatori: 3, seme: 3, politica: semplice, variante: { nome: 'x', postiOvile: { 2: 20 } } });
    expect(r2).toEqual(r1);
  });
});
