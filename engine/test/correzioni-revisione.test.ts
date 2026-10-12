// Correzioni decise dopo la revisione avversariale: effetti inutili saltati (D11), eventi ha_scelto
// che non rivelano i cambi di carta (D40), parametri non previsti rifiutati, nomi validati, dati congelati.
import { describe, expect, it } from 'vitest';
import { applica, CATALOGO, ErroreRegola, nuovaPartita, SETUP } from '../src';
import type { Azione, Evento, IdGiocatore, Stato } from '../src';
import { avanza, carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from './aiuti';
import type { OpzioniScenario } from './aiuti';

const NEUTRO = 'tosatura-a-sorpresa';

function finoAgliEffetti(o: OpzioniScenario, scelte: Record<IdGiocatore, string[]>): Stato {
  return prosegui(scegli(prosegui(scenario(o)), scelte));
}

function esitiEffetti(s: Stato): string[] {
  return (s.eventi.filter((e) => e.tipo === 'effetto') as Array<Extract<Evento, { tipo: 'effetto' }>>).map((e) => e.esito);
}

function quantiHaScelto(s: Stato, g: IdGiocatore): number {
  return s.eventi.filter((e) => e.tipo === 'ha_scelto' && e.giocatore === g).length;
}

describe('Effetti che non possono cambiare nulla vengono saltati (D11)', () => {
  it('Tappi per le orecchie senza altri effetti dopo di loro: saltati, nessuna finestra', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mani: { g1: ['tappi-per-le-orecchie'], g2: ['sasso-comodo'], g3: ['carriola'] } },
      { g1: ['tappi-per-le-orecchie'], g2: ['sasso-comodo'], g3: ['carriola'] },
    );
    expect(s.fase.nome).toBe('belati_punteggio');
    expect(esitiEffetti(s)).toEqual(['saltato']);
    expect(s.datiRound.ignoraEffetti).toBeNull();
  });

  it('Tappi per le orecchie con un effetto dopo: restano attivabili', () => {
    const s = finoAgliEffetti(
      { guaio: NEUTRO, gregge: 10, mani: { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola'] } },
      { g1: ['tappi-per-le-orecchie'], g2: ['agnellino-smarrito'], g3: ['carriola'] },
    );
    expect(s.fase.nome).toBe('effetti');
    if (s.fase.nome !== 'effetti') return;
    expect(s.fase.coda[s.fase.indice]?.carta).toMatch(/^tappi-per-le-orecchie#/);
  });

  it('Capriola con un solo partecipante: saltata', () => {
    // g2 e g3 hanno solo Belati e il mazzo è vuoto: restano fuori dal round.
    const s = finoAgliEffetti(
      { guaio: NEUTRO, mazzo: [], ultimoRound: 2, mani: { g1: ['capriola'], g2: ['beee-no'], g3: ['pernacchia'] } },
      { g1: ['capriola'] },
    );
    expect(s.datiRound.partecipanti).toEqual(['g1']);
    expect(esitiEffetti(s)).toEqual(['saltato']);
    expect(s.fase.nome).toBe('dado');
  });
});

describe("L'evento ha_scelto non rivela i cambi di carta (brief §5; D40)", () => {
  it('nella scelta segreta arriva una sola volta anche se il giocatore cambia carta', () => {
    let s = prosegui(
      scenario({ mani: { g1: ['carriola', 'sasso-comodo'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] } }),
    );
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'sasso-comodo')] });
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    expect(quantiHaScelto(s, 'g1')).toBe(1);
    expect(s.fase.nome).toBe('scelta');
  });

  it('nel Belato Finale arriva una sola volta anche se il giocatore cambia carta', () => {
    // g1 lancia (8); g2 e g3 pari a 5 vanno al Belato Finale.
    let s = prosegui(
      scenario({
        guaio: NEUTRO,
        gregge: 20,
        mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'sasso-comodo', 'carriola'], g3: ['balla-di-fieno', 'coperta-di-lana'] },
      }),
    );
    s = scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['balla-di-fieno'] });
    s = chiudiPunteggio(avanza(s));
    s = nessunaReazione(applica(conFaccia(s, 'pascolo_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' }));
    s = avanza(s);
    expect(s.fase.nome).toBe('belato_finale');
    const prima = quantiHaScelto(s, 'g2');
    s = applica(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: carta(s, 'g2', 'sasso-comodo') });
    s = applica(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: carta(s, 'g2', 'carriola') });
    expect(quantiHaScelto(s, 'g2') - prima).toBe(1);
  });
});

describe('Parametri non previsti vengono rifiutati (coerenza con azioniPossibili, §2)', () => {
  function alPunteggio(): Stato {
    let s = prosegui(
      scenario({
        guaio: NEUTRO,
        mani: {
          g1: ['carriola', 'mondo-alla-rovescia', 'belato-di-gruppo'],
          g2: ['balla-di-fieno', 'beee-no'],
          g3: ['coperta-di-lana'],
        },
      }),
    );
    s = avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] }));
    expect(s.fase.nome).toBe('belati_punteggio');
    return s;
  }

  it('Mondo alla rovescia con bersaglio, voce o guaio', () => {
    const s = alPunteggio();
    const base = { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s, 'g1', 'mondo-alla-rovescia') } as const;
    expect(() => applica(s, { ...base, bersaglio: 'g2' })).toThrow(ErroreRegola);
    expect(() => applica(s, { ...base, voce: 1 })).toThrow(ErroreRegola);
    expect(() => applica(s, { ...base, guaio: 'insonnia#1' })).toThrow(ErroreRegola);
    expect(() => applica(s, base)).not.toThrow();
  });

  it('Belato di gruppo con voce; Beee-NO! con bersaglio', () => {
    const s = alPunteggio();
    const piuDue: Azione = { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s, 'g1', 'belato-di-gruppo'), bersaglio: 'g1' };
    expect(() => applica(s, { ...piuDue, voce: 1 })).toThrow(ErroreRegola);
    const s1 = applica(s, piuDue);
    const voce = s1.pila[0]?.id;
    const no: Azione = { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s1, 'g2', 'beee-no'), voce };
    expect(() => applica(s1, { ...no, bersaglio: 'g1' })).toThrow(ErroreRegola);
    expect(() => applica(s1, no)).not.toThrow();
  });

  it('dichiaraDado: bersaglio sul Furto e furto sulla Testata', () => {
    const partenza = (): Stato => {
      const s = prosegui(
        scenario({ guaio: NEUTRO, mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] } }),
      );
      return chiudiPunteggio(avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] })));
    };
    const furto = applica(conFaccia(partenza(), 'furto_piccolo'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(() =>
      applica(furto, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 1 }, bersaglio: 'g2' }),
    ).toThrow(ErroreRegola);
    expect(() => applica(furto, { tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2: 1, g3: 1 } })).not.toThrow();

    const testata = applica(conFaccia(partenza(), 'testata'), { tipo: 'lanciaDado', giocatore: 'g1' });
    expect(() =>
      applica(testata, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2', furto: { g2: 1 } }),
    ).toThrow(ErroreRegola);
    expect(() => applica(testata, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' })).not.toThrow();
  });
});

describe('Validazione dei giocatori in nuovaPartita (§3.1)', () => {
  const giocatori = (nome: unknown) => [
    { id: 'a', nome: nome as string, pecora: 'ricciolo' as const },
    { id: 'b', nome: 'Bea', pecora: 'nerina' as const },
  ];

  it('rifiuta nomi vuoti o non testuali', () => {
    for (const nome of ['', '   ', 42, null, undefined, { x: 1 }]) {
      expect(() => nuovaPartita({ giocatori: giocatori(nome), seme: 1 })).toThrow(ErroreRegola);
    }
    expect(() => nuovaPartita({ giocatori: giocatori('Ada'), seme: 1 })).not.toThrow();
  });
});

describe('Dati condivisi immutabili (§1)', () => {
  it('CATALOGO e SETUP sono congelati in profondità', () => {
    expect(Object.isFrozen(CATALOGO)).toBe(true);
    expect(Object.isFrozen(CATALOGO.carte)).toBe(true);
    expect(Object.isFrozen(CATALOGO.carte['carriola'])).toBe(true);
    expect(Object.isFrozen(CATALOGO.pecore.ricciolo)).toBe(true);
    expect(Object.isFrozen(SETUP)).toBe(true);
    expect(Object.isFrozen(SETUP.dado[0])).toBe(true);
    expect(() => {
      (CATALOGO.carte['carriola'] as { nome: string }).nome = 'altro';
    }).toThrow(TypeError);
  });
});
