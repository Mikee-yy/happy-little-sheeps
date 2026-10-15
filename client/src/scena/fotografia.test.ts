import { describe, expect, it } from 'vitest';
import { nuovaPartita, vistaPer } from '../../../engine/src';
import { eTrovata } from '../../../engine/src/dati';
import type { IdGiocatore, Stato } from '../../../engine/src';
import { avanza, scegli, scenario } from '../../../engine/test/aiuti';
import { fotografia, inBassoIniziale, riassuntoTestuale } from './fotografia';

const GIOCATORI = [
  { id: 'g1', nome: 'Anna', pecora: 'ricciolo' as const },
  { id: 'g2', nome: 'Bruno', pecora: 'brontolana' as const },
  { id: 'g3', nome: 'Carla', pecora: 'sospirella' as const },
];

/** Partita vera portata alla fase di scelta. */
function inScelta(): Stato {
  const s = avanza(nuovaPartita({ giocatori: GIOCATORI, seme: 7 }));
  expect(s.fase.nome).toBe('scelta');
  return s;
}

const vista = (s: Stato, per: IdGiocatore | null = null) => vistaPer(s, per);
const scelte = (s: Stato, id: IdGiocatore) => {
  const g = s.giocatori.find((x) => x.id === id)!;
  const prima = g.mano.find((c) => eTrovata(c));
  return { [id]: [prima!] };
};

describe('fotografia', () => {
  it('posti ruotati: chi sta in basso è il primo', () => {
    const f = fotografia(vista(scenario({ giocatori: 3 })), 'g2', null);
    expect(f.posti.map((p) => p.id)).toEqual(['g2', 'g3', 'g1']);
  });

  it('segnalini: un Guaio all\'eliminazione e Ovile quasi pieno', () => {
    const s = scenario({
      giocatori: 3,
      angoli: { g1: ['grandine-a-sorpresa', 'fulmine-curioso'] },
      agnellini: { g1: 12, g2: 11, g3: 10 },
    });
    const f = fotografia(vista(s), 'g1', null);
    expect(f.posti[0]!.unGuaioAllEliminazione).toBe(true);
    expect(f.posti[0]!.quasiPieno).toBe(true);
    expect(f.posti[1]!.quasiPieno).toBe(false);
    expect(f.posti[1]!.unGuaioAllEliminazione).toBe(false);
    expect(f.posti[0]!.angolo).toHaveLength(2);
  });

  describe('carte del round', () => {
    it('prima della scelta null, poi coperta, mai id prima della rivelazione', () => {
      let s = inScelta();
      let f = fotografia(vista(s), 'g1', null);
      expect(f.posti.every((p) => p.giocata === null)).toBe(true);
      expect(f.posti.every((p) => p.deveAgire)).toBe(true);

      s = scegli(s, scelte(s, 'g1'));
      const v = vista(s);
      f = fotografia(v, 'g1', null);
      expect(f.posti[0]!.giocata).toEqual({ coperta: true });
      expect(f.posti[1]!.giocata).toBeNull();
      expect(f.posti[2]!.giocata).toBeNull();
      expect(f.posti[0]!.deveAgire).toBe(false);
      expect(f.posti[1]!.deveAgire).toBe(true);
      const mano = s.giocatori[0]!.mano;
      const json = JSON.stringify(f);
      for (const c of mano) expect(json).not.toContain(c);
    });

    it('dopo la rivelazione le carte vere', () => {
      let s = inScelta();
      s = scegli(s, { ...scelte(s, 'g1'), ...scelte(s, 'g2'), ...scelte(s, 'g3') });
      s = avanza(s);
      const v = vista(s);
      expect(Object.keys(v.datiRound.giocate).length).toBeGreaterThan(0);
      const f = fotografia(v, 'g1', null);
      for (const p of f.posti) {
        expect(p.giocata).toEqual({ coperta: false, carte: v.datiRound.giocate[p.id] });
      }
    });
  });

  it('mano: null resta null, altrimenti uguale', () => {
    const v = vista(scenario({ giocatori: 3 }), 'g1');
    expect(fotografia(v, 'g1', null).mano).toBeNull();
    const mano = v.giocatori[0]!.mano!;
    expect(fotografia(v, 'g1', mano).mano).toEqual(mano);
  });

  describe('ora del giorno', () => {
    const conAgnellini = (a: number, ultimo: number | null = null) =>
      fotografia(
        vista(scenario({ giocatori: 3, agnellini: { g1: a, g2: 1, g3: 1 }, ultimoRound: ultimo })),
        'g1',
        null,
      ).ora;
    it('soglie', () => {
      expect(conAgnellini(7)).toBe('giorno');
      expect(conAgnellini(8)).toBe('pomeriggio');
      expect(conAgnellini(11)).toBe('tramonto');
      expect(conAgnellini(13)).toBe('sera');
    });
    it('ultimo round: almeno tramonto', () => {
      const s = scenario({ giocatori: 3, agnellini: { g1: 2, g2: 1, g3: 1 }, ultimoRound: 1 });
      const f = fotografia(vista(s), 'g1', null);
      expect(f.ultimoRound).toBe(true);
      expect(f.ora).toBe('tramonto');
    });
    it('gli eliminati non contano', () => {
      const s = scenario({ giocatori: 3, agnellini: { g1: 14, g2: 1, g3: 1 }, eliminati: ['g1'] });
      expect(fotografia(vista(s), 'g2', null).ora).toBe('giorno');
    });
  });

  it('eliminati e fuori dal round', () => {
    const s = scenario({ giocatori: 3, eliminati: ['g3'] });
    s.datiRound.partecipanti = ['g1'];
    const f = fotografia(vista(s), 'g1', null);
    const g3 = f.posti.find((p) => p.id === 'g3')!;
    const g2 = f.posti.find((p) => p.id === 'g2')!;
    expect(g3.eliminato).toBe(true);
    expect(g3.fuoriDalRound).toBe(false);
    expect(g3.quasiPieno).toBe(false);
    expect(g2.fuoriDalRound).toBe(true);
    expect(f.posti[0]!.fuoriDalRound).toBe(false);
  });

  describe('inBassoIniziale', () => {
    it('in scelta: primo in attesa dal primo giocatore', () => {
      let s = inScelta();
      const primo = s.primoGiocatore;
      expect(inBassoIniziale(vista(s))).toBe(primo);
      s = scegli(s, scelte(s, primo));
      const ordine = s.giocatori.map((g) => g.id);
      const i = ordine.indexOf(primo);
      expect(inBassoIniziale(vista(s))).toBe(ordine[(i + 1) % ordine.length]);
    });
    it('senza nessuno in attesa: giocatori[0]', () => {
      const v = vista(scenario({ giocatori: 3 }));
      v.attesa = { sistema: true, giocatori: [] };
      expect(inBassoIniziale(v)).toBe('g1');
    });
  });

  it('conservazione e dado', () => {
    const f = fotografia(vista(inScelta()), 'g1', null);
    expect(f.totaleAgnellini).toBe(45);
    expect(f.dado).toBeNull();
    expect(f.postiOvile).toBe(15);
  });

  it('dado: ultima faccia dopo l\'ultimo round_iniziato', () => {
    const v = vista(scenario({ giocatori: 3 }));
    v.eventi = [
      { seq: 1, tipo: 'round_iniziato', round: 1, ultimo: false },
      { seq: 2, tipo: 'dado_lanciato', giocatore: 'g1', faccia: 'testata' },
      { seq: 3, tipo: 'round_iniziato', round: 2, ultimo: false },
    ];
    expect(fotografia(v, 'g1', null).dado).toBeNull();
    v.eventi.push({ seq: 4, tipo: 'dado_lanciato', giocatore: 'g2', faccia: 'furto_grande' });
    expect(fotografia(v, 'g1', null).dado).toBe('furto_grande');
  });

  it('riassunto testuale', () => {
    const s = scenario({ giocatori: 3, eliminati: ['g3'], gregge: 4, agnellini: { g1: 15, g2: 15, g3: 11 } });
    const righe = riassuntoTestuale(fotografia(vista(s), 'g1', null));
    expect(righe).toHaveLength(4);
    expect(righe[0]).toBe('Giocatore 1: 15 agnellini su 15, 0 Guai');
    expect(righe[2]).toBe('Giocatore 3: eliminata');
    expect(righe[3]).toBe('Gregge: 4 agnellini');
  });
});
