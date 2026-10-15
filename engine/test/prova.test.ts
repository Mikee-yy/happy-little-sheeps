// Partita di prova: la preparazione dei primi round (mani, mazzo, Guai, tiri del dado) e il suo effetto sui tre round guidati.
import { describe, expect, it } from 'vitest';
import { azioniPossibili, defCarta, inAttesaDi, nuovaPartita, PROVA, tentaApplica, tipoDi, vistaPer } from '../src';
import type { Azione, IdGiocatore, Stato } from '../src';
import { casuale } from '../src/rng';
import { semplice } from '../sim/politiche';

const conPreparazione = (seme = 7) => nuovaPartita({ giocatori: PROVA.giocatori, seme, preparazione: PROVA.preparazione });
const applica = (s: Stato, a: Azione): Stato => {
  const r = tentaApplica(s, a);
  if (!r.ok) throw new Error(`${a.tipo}: ${r.errore.message}`);
  return r.stato;
};
const eventi = <T extends Stato['eventi'][number]['tipo']>(s: Stato, tipo: T) =>
  s.eventi.filter((e): e is Extract<Stato['eventi'][number], { tipo: T }> => e.tipo === tipo);

/** Le mosse "ovvie" dell'umano nella prova: la carta più alta (le Gemelle insieme nel round 2), poi passa. */
function mossaUmano(s: Stato, azioni: Azione[]): Azione {
  const scelte = azioni.filter((a): a is Extract<Azione, { tipo: 'scegliTrovata' }> => a.tipo === 'scegliTrovata');
  if (scelte.length) {
    const valore = (a: (typeof scelte)[number]) => a.carte.reduce((t, c) => t + ((defCarta(c) as { valore?: number }).valore ?? 0), 0);
    const gemelle = (a: (typeof scelte)[number]) => a.carte.every((c) => (defCarta(c) as { gemella?: boolean }).gemella);
    const candidate = s.round === 2 ? scelte.filter((a) => a.carte.length === 2) : scelte.filter((a) => a.carte.length === 1 && !gemelle(a));
    return [...(candidate.length ? candidate : scelte)].sort((a, b) => valore(b) - valore(a))[0]!;
  }
  for (const tipo of ['lanciaDado', 'esitoTestata', 'dichiaraDado', 'passa', 'rinunciaEffetto'] as const) {
    const a = azioni.find((x) => x.tipo === tipo);
    if (a) return a.tipo === 'esitoTestata' ? { ...a, esito: Math.min(2, a.esito) } : a;
  }
  return azioni.find((a) => a.tipo !== 'giocaBelato') ?? azioni[0]!;
}

describe('partita di prova', () => {
  it('con la preparazione mani, Guai e primi tiri sono quelli del file', () => {
    let s = conPreparazione();
    for (const g of s.giocatori) expect(g.mano.map(tipoDi)).toEqual(PROVA.preparazione.mani[g.id]);
    expect(s.primoGiocatore).toBe(PROVA.preparazione.primoGiocatore);
    expect(tipoDi(eventi(s, 'guaio_rivelato')[0]!.carta!)).toBe(PROVA.preparazione.cimaGuai[0]);
    expect(s.dadoPreparato).toEqual(PROVA.preparazione.dado);
  });

  it('la vista non mostra i tiri preparati', () => {
    expect('dadoPreparato' in vistaPer(conPreparazione(), 'g1')).toBe(false);
  });

  it('tipo sconosciuto o copie insufficienti: preparazione_non_valida', () => {
    const p = PROVA.preparazione;
    expect(() => nuovaPartita({ giocatori: PROVA.giocatori, seme: 1, preparazione: { ...p, cimaMazzo: ['carta-inventata'] } })).toThrow(/preparazione_non_valida|carta-inventata/);
    expect(() => nuovaPartita({ giocatori: PROVA.giocatori, seme: 1, preparazione: { ...p, cimaMazzo: Array(9).fill('sasso-comodo') } })).toThrow();
  });

  it('senza preparazione nuovaPartita è identica a prima', () => {
    const a = nuovaPartita({ giocatori: PROVA.giocatori, seme: 42 });
    const b = nuovaPartita({ giocatori: PROVA.giocatori, seme: 42, preparazione: undefined });
    expect(b).toEqual(a);
    expect(a.dadoPreparato).toBeUndefined();
  });

  it('i tre round preparati vanno come nel progetto; finiti i tiri preparati il dado torna casuale', () => {
    let s = conPreparazione();
    const generatore = { rng: 1 };
    const r = () => casuale(generatore);
    let furtoConBeeeNo = false;
    for (let passi = 0; passi < 2000 && !s.esito && s.round <= 4; passi++) {
      const attesa = inAttesaDi(s);
      if (attesa.giocatori.length === 0) {
        s = applica(s, { tipo: 'prosegui' });
        continue;
      }
      const id = attesa.giocatori.includes('g1') ? 'g1' : (attesa.giocatori[0] as IdGiocatore);
      const azioni = azioniPossibili(s, id);
      // Al Furto del round 2 l'umano deve poter rispondere con il suo Beee-NO!
      const cima = s.pila[s.pila.length - 1];
      if (id === 'g1' && s.finestra && cima?.dettagli.tipo === 'dado' && cima.dettagli.faccia === 'furto_piccolo') {
        furtoConBeeeNo ||= azioni.some((a) => a.tipo === 'giocaBelato' && tipoDi(a.carta) === 'beee-no');
      }
      let a: Azione;
      if (id === 'g1') a = mossaUmano(s, azioni);
      else {
        a = azioni.find((x) => x.tipo === 'esitoTestata') ?? semplice.scegli(s, id, azioni, r);
        if (a.tipo === 'esitoTestata') a = { ...a, esito: Math.min(2, a.esito) };
        if (!tentaApplica(s, a).ok) a = azioni[0]!;
      }
      s = applica(s, a);
    }
    const tiri = eventi(s, 'dado_lanciato');
    expect(tiri.slice(0, 3).map((t) => [t.giocatore === 'g1' ? 'umano' : 'bot', t.faccia])).toEqual([
      ['umano', 'pascolo_piccolo'],
      ['bot', 'furto_piccolo'],
      ['umano', 'testata'],
    ]);
    expect(furtoConBeeeNo).toBe(true);
    expect(eventi(s, 'guaio_preso').some((e) => e.giocatore !== 'g1')).toBe(true);
    expect(s.dadoPreparato ?? []).toEqual([]);
  });
});
