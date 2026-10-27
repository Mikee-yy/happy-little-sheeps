// @vitest-environment jsdom
// Partita di prova: i bot giocano da soli, l'umano no; niente salvataggio.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { azioniPossibili, inAttesaDi } from '../engine/src';
import { normale, semplice } from '../engine/sim/politiche';
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

describe('SessioneProva.pausa (la scena recita: i bot aspettano)', () => {
  it('pausa(true): nessuna mossa dei bot; pausa(false): la mossa arriva dopo pausaMs', () => {
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    prosegui(s);
    s.pausa(true);
    vi.advanceTimersByTime(5000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(0);
    s.pausa(false);
    vi.advanceTimersByTime(999);
    expect(eventi(s, 'ha_scelto')).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(eventi(s, 'ha_scelto')).toHaveLength(1);
    s.chiudi();
  });

  it("in pausa anche una mossa dell'umano non fa ripartire i bot; avvia non toglie la pausa", () => {
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    s.pausa(true);
    prosegui(s);
    s.avvia();
    vi.advanceTimersByTime(5000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(0);
    s.pausa(false);
    vi.advanceTimersByTime(3000);
    expect(eventi(s, 'ha_scelto').length).toBeGreaterThan(0);
    s.chiudi();
  });

  it('chiusa, pausa(false) non fa muovere i bot', () => {
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    prosegui(s);
    s.pausa(true);
    s.chiudi();
    s.pausa(false);
    vi.advanceTimersByTime(5000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(0);
  });
});

describe('SessioneProva.pausa ripetuta', () => {
  it('pausa(false) senza pausa non fa ripartire da capo la mossa già pianificata', () => {
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    prosegui(s);
    vi.advanceTimersByTime(600);
    s.pausa(false);
    vi.advanceTimersByTime(400);
    expect(eventi(s, 'ha_scelto')).toHaveLength(1);
    s.chiudi();
  });
});

describe('SessioneProva: un bot che sbaglia non ferma la partita', () => {
  afterEach(() => vi.restoreAllMocks());

  it('se la strategia propone una mossa che non è tra le azioni, il bot ne gioca un\'altra valida', () => {
    vi.spyOn(semplice, 'scegli').mockImplementation((_s, g) => ({ tipo: 'scegliTrovata', giocatore: g, carte: ['non-esiste#9'] }));
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    prosegui(s);
    vi.advanceTimersByTime(3000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(2);
    s.chiudi();
  });

  it('se la strategia si rompe (eccezione), il bot ne gioca un\'altra valida e la partita prosegue', () => {
    vi.spyOn(semplice, 'scegli').mockImplementation(() => {
      throw new Error('strategia rotta');
    });
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    prosegui(s);
    vi.advanceTimersByTime(3000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(2);
    s.chiudi();
  });

  it('se la mossa scelta viene rifiutata dal motore, il bot prova un\'altra azione senza fermarsi', () => {
    const rifiutata = vi.spyOn(semplice, 'scegli');
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    rifiutata.mockImplementation(() => ({ tipo: 'scegliTrovata', giocatore: 'g1', carte: [] }));
    prosegui(s);
    vi.advanceTimersByTime(3000);
    expect(eventi(s, 'ha_scelto')).toHaveLength(2);
    s.chiudi();
  });

  it("se la strategia propone una mossa valida ma di un altro (l'umano), il bot non la gioca: gioca una delle sue", () => {
    // La mossa dell'umano è accettata dal motore (si sceglie tutti insieme): non deve passare per buona
    vi.spyOn(semplice, 'scegli').mockImplementation((st) => azioniPossibili(st, 'g1').find((a) => a.tipo === 'scegliTrovata')!);
    const s = SessioneProva.nuova({ seme: 3, pausaMs: 1000 });
    prosegui(s);
    vi.advanceTimersByTime(3000);
    const chi = eventi(s, 'ha_scelto').map((e) => (e.tipo === 'ha_scelto' ? e.giocatore : ''));
    expect(chi).not.toContain('g1');
    expect(chi).toHaveLength(2);
    s.chiudi();
  });
});

describe('SessioneProva: strategia dei bot (D47)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('nei tre round guidati i bot usano "semplice" (la storia preparata), dal quarto "normale"', () => {
    const roundSemplice: number[] = [];
    const roundNormale: number[] = [];
    vi.spyOn(semplice, 'scegli').mockImplementation((st, _g, az) => {
      roundSemplice.push(st.round);
      return az.find((a) => a.tipo !== 'giocaBelato') ?? az[0]!;
    });
    vi.spyOn(normale, 'scegli').mockImplementation((st, _g, az) => {
      roundNormale.push(st.round);
      return az.find((a) => a.tipo !== 'giocaBelato') ?? az[0]!;
    });
    const s = SessioneProva.nuova({ pausaMs: 10 });
    // L'umano fa la prima mossa che non sia un Belato; le fasi di sistema proseguono.
    for (let i = 0; i < 3000 && !s.vista(null).esito && roundNormale.length === 0; i++) {
      const umano = s.azioni('g1');
      const mossa = umano.find((a) => a.tipo !== 'giocaBelato');
      if (mossa && inAttesaDi((s as unknown as { stato: Parameters<typeof inAttesaDi>[0] }).stato).giocatori.includes('g1')) s.invia(mossa);
      else if (s.azioni('sistema').length > 0) s.invia(s.azioni('sistema')[0]!);
      vi.advanceTimersByTime(20);
    }
    expect(roundSemplice.length).toBeGreaterThan(0);
    expect(Math.max(...roundSemplice)).toBeLessThanOrEqual(3);
    expect(Math.min(...roundNormale)).toBe(4);
    s.chiudi();
  });
});
