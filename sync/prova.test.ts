// @vitest-environment jsdom
// Partita di prova: i bot giocano da soli, l'umano no; niente salvataggio.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inAttesaDi } from '../engine/src';
import { SessioneProva } from './prova';

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => vi.useRealTimers());

const eventi = (s: SessioneProva, tipo: string) => s.vista(null).eventi.filter((e) => e.tipo === tipo);
const prosegui = (s: SessioneProva) => {
  const a = s.azioni('sistema').find((x) => x.tipo === 'prosegui');
  if (a) s.invia(a);
};

describe('SessioneProva', () => {
  it('l\'umano è g1 e la partita parte dalla preparazione', () => {
    const s = SessioneProva.nuova({ seme: 3 });
    expect(s.umano).toBe('g1');
    expect(s.vista('g1').giocatori.map((g) => g.nome)).toEqual(['Tu', 'Bea', 'Leo']);
    s.chiudi();
  });

  it('i bot scelgono da soli la Trovata, l\'umano no', () => {
    const s = SessioneProva.nuova({ seme: 3 });
    prosegui(s);
    vi.advanceTimersByTime(3000);
    const scelti = eventi(s, 'ha_scelto').map((e) => (e as { giocatore: string }).giocatore);
    expect(scelti.sort()).toEqual(['g2', 'g3']);
    s.chiudi();
  });

  it('mentre tocca all\'umano i bot aspettano', () => {
    const s = SessioneProva.nuova({ seme: 3 });
    prosegui(s);
    vi.advanceTimersByTime(3000);
    const prima = s.vista(null).eventi.length;
    expect(inAttesaDi((s as unknown as { stato: Parameters<typeof inAttesaDi>[0] }).stato).giocatori).toEqual(['g1']);
    vi.advanceTimersByTime(5000);
    expect(s.vista(null).eventi.length).toBe(prima);
    s.chiudi();
  });

  it('chiudi ferma i bot', () => {
    const s = SessioneProva.nuova({ seme: 3 });
    prosegui(s);
    s.chiudi();
    vi.advanceTimersByTime(5000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(0);
  });

  it('la prova non scrive nel salvataggio', () => {
    localStorage.setItem('hls-partita-locale', 'x');
    const s = SessioneProva.nuova({ seme: 3 });
    prosegui(s);
    vi.advanceTimersByTime(3000);
    const scelta = s.azioni('g1').find((a) => a.tipo === 'scegliTrovata')!;
    s.invia(scelta);
    vi.advanceTimersByTime(3000);
    expect(localStorage.getItem('hls-partita-locale')).toBe('x');
    s.chiudi();
  });

  it('stesso seme e stesso casuale: stessa partita', () => {
    const gioca = () => {
      const s = SessioneProva.nuova({ seme: 5 });
      prosegui(s);
      vi.advanceTimersByTime(3000);
      s.invia(s.azioni('g1').find((a) => a.tipo === 'scegliTrovata')!);
      vi.advanceTimersByTime(3000);
      const ev = JSON.stringify(s.vista(null).eventi);
      s.chiudi();
      return ev;
    };
    expect(gioca()).toBe(gioca());
  });
});
