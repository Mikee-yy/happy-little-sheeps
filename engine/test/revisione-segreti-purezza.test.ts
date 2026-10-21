// Revisione avversariale: informazioni nascoste, purezza, determinismo, robustezza.
// Riferimenti: brief §6 ("Informazioni nascoste", "Motore"), specifica docs/motore.md §1, §2, §3, §10, §12, §13.
// Le partite di robustezza a 3 e a 4 giocatori stanno in file separati (revisione-robustezza-N-*.test.ts): girano su fili diversi.
import { describe, expect, it } from 'vitest';
import {
  applica,
  azioniPossibili,
  CATALOGO,
  configPer,
  defCarta,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  punteggioTotale,
  SETUP,
  tentaApplica,
  vistaPer,
} from '../src';
import type { Azione, IdCarta, IdGiocatore, IdPecora, Stato } from '../src';
import { prosegui, scenario } from './aiuti';
import {
  azioniACaso,
  candidati,
  congela,
  controllaSegreti,
  devasta,
  generatore,
  giocaPartita,
  giocatoriDi,
  provaRobustezza,
  stringhe,
  valoreNonJson,
  verifica,
} from './aiuti-revisione';

// ─── Informazioni nascoste ───────────────────────────────────────────────────

describe('Revisione · informazioni nascoste (brief §6, specifica §10 e §12)', () => {
  it(
    'partite casuali a 2, 3 e 4 giocatori: a ogni passo nessuna vista contiene carte coperte (mazzo, mani altrui, scelte, Belato Finale, guarda_due altrui, Guai mai rivelati)',
    () => {
      const visto = new Set<string>();
      for (const numero of [2, 3, 4]) {
        for (let k = 0; k < 4; k++) {
          const guaiNoti = new Set<IdCarta>();
          const seme = 500 + numero * 31 + k;
          giocaPartita(numero, seme, (s, _azione, passo) => {
            if (s.datiRound.guaio !== null) guaiNoti.add(s.datiRound.guaio);
            controllaSegreti(s, guaiNoti, `seme ${seme} passo ${passo}`);
            visto.add(s.fase.nome);
            if (s.richiesta) visto.add(`richiesta:${s.richiesta.tipo}`);
            if (s.fase.nome === 'scelta' && Object.values(s.fase.scelte).some((c) => c !== null)) visto.add('scelta in corso');
            if (s.fase.nome === 'belato_finale' && Object.values(s.fase.scelte).some((c) => c)) visto.add('belato_finale in corso');
            for (const e of s.eventi) visto.add(`evento:${e.tipo}`);
          });
        }
      }
      // Le partite devono aver attraversato i punti in cui ci sono carte coperte da proteggere.
      for (const atteso of [
        'scelta in corso',
        'belato_finale in corso',
        'richiesta:guarda_due',
        'richiesta:scarta_e_somma',
        'evento:pescate',
        'evento:ripescata',
        'evento:eliminato',
        'evento:guaio_in_fondo',
      ]) {
        expect(visto, atteso).toContain(atteso);
      }
    },
    180_000,
  );

  it('scelta segreta con Gemelle: carteInMano non cambia finché non hanno scelto tutti e la vista altrui non dice quante carte sono state scelte', () => {
    const s0 = prosegui(
      scenario({
        guaio: 'tosatura-a-sorpresa',
        mani: { g1: ['calzino-gemello', 'orecchino-gemello', 'carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
      }),
    );
    const coppia = s0.giocatori[0]!.mano.filter((c) => c.includes('gemello'));
    const s1 = applica(s0, { tipo: 'scegliTrovata', giocatore: 'g1', carte: coppia });
    for (const per of ['g2', 'g3', null]) {
      const v = vistaPer(s1, per);
      expect(v.giocatori[0]!.carteInMano).toBe(3);
      expect(v.fase).toEqual({ nome: 'scelta', haScelto: { g1: true, g2: false, g3: false }, miaScelta: null });
      expect(stringhe(v).has(coppia[0]!)).toBe(false);
    }
    expect(vistaPer(s1, 'g1').fase).toMatchObject({ miaScelta: coppia });
  });

  it('vista per un id estraneo alla partita: nessuna mano, nessuna carta pescata, nessuna scelta', () => {
    let s = prosegui(
      scenario({
        guaio: 'tosatura-a-sorpresa',
        mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['beee-no'] },
        mazzo: ['coperta-di-lana', 'sasso-comodo', 'pernacchia', 'ombrello-bucato', 'corona-di-margherite', 'capriola'],
      }),
    );
    s = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [s.giocatori[0]!.mano[0]!] });
    const v = vistaPer(s, 'spettatore');
    expect(v.giocatori.every((g) => g.mano === null)).toBe(true);
    expect(v.fase).toMatchObject({ nome: 'scelta', miaScelta: null });
    const visibili = stringhe(v);
    for (const g of s.giocatori) for (const c of g.mano) expect(visibili.has(c), c).toBe(false);
  });
});

// ─── Purezza ─────────────────────────────────────────────────────────────────

describe('Revisione · purezza (specifica §1)', () => {
  it('vistaPer, inAttesaDi e azioniPossibili non restituiscono riferimenti allo stato: manometterne il risultato non cambia lo stato', () => {
    let controllati = 0;
    giocaPartita(3, 4242, (s, _a, passo) => {
      if (passo % 7 !== 0) return;
      const prima = JSON.stringify(s);
      for (const per of [...s.giocatori.map((g) => g.id), null]) devasta(vistaPer(s, per));
      devasta(inAttesaDi(s));
      for (const chi of [...s.giocatori.map((g) => g.id), 'sistema']) devasta(azioniPossibili(s, chi));
      verifica(JSON.stringify(s) === prima, () => `passo ${passo} (${s.fase.nome}): lo stato è cambiato manomettendo un risultato`);
      controllati++;
    });
    expect(controllati).toBeGreaterThan(5);
  }, 60_000);

  it('applica non conserva riferimenti né all\'argomento né all\'azione: manometterli dopo non cambia il nuovo stato', () => {
    let controllati = 0;
    giocaPartita(4, 777, (s, azione, passo) => {
      if (azione === null || passo % 3 !== 0) return;
      const copia = structuredClone(azione);
      const base = structuredClone(s);
      const nuovo = applica(base, copia);
      const istantanea = JSON.stringify(nuovo);
      devasta(copia);
      devasta(base);
      verifica(JSON.stringify(nuovo) === istantanea, () => `passo ${passo}: ${azione.tipo} ha lasciato riferimenti condivisi`);
      controllati++;
    });
    expect(controllati).toBeGreaterThan(10);
  }, 60_000);

  it('applica accetta azioni congelate in profondità (non scrive sull\'azione)', () => {
    giocaPartita(3, 99, (s, azione) => {
      if (azione === null) return;
      const r = tentaApplica(s, congela(structuredClone(azione)));
      verifica(r.ok, () => `${azione.tipo} congelata rifiutata`);
    });
  }, 60_000);

  it('una partita intera non modifica CATALOGO, SETUP né i risultati di configPer; lo stato non condivide oggetti con SETUP', () => {
    const catalogo = JSON.stringify(CATALOGO);
    const setup = JSON.stringify(SETUP);
    const config = JSON.stringify(configPer(3));
    const s = nuovaPartita({ giocatori: giocatoriDi(3), seme: 3 });
    devasta(s.config);
    devasta(configPer(4));
    giocaPartita(3, 31337, () => {});
    expect(JSON.stringify(CATALOGO)).toBe(catalogo);
    expect(JSON.stringify(SETUP)).toBe(setup);
    expect(JSON.stringify(configPer(3))).toBe(config);
  }, 60_000);

  it('nuovaPartita non conserva riferimenti all\'elenco dei giocatori ricevuto', () => {
    const input = { giocatori: giocatoriDi(3), seme: 8 };
    const s = nuovaPartita(input);
    const istantanea = JSON.stringify(s);
    devasta(input);
    expect(JSON.stringify(s)).toBe(istantanea);
  });
});

// ─── Determinismo ────────────────────────────────────────────────────────────


describe('Revisione · determinismo (specifica §1)', () => {
  it.each([2, 3, 4])(
    'a %i giocatori lo stato salvato in JSON e riletto si comporta come l\'originale a ogni passo (salvataggio e ripresa, brief §5–§6)',
    (numero) => {
      giocaPartita(numero, 9000 + numero, (s, azione, passo) => {
        const impuro = valoreNonJson(s, 'stato');
        verifica(impuro === null, () => `passo ${passo}: ${impuro}`);
        const riletto = JSON.parse(JSON.stringify(s)) as Stato;
        if (azione === null) return;
        const a = applica(s, azione);
        const b = applica(riletto, azione);
        verifica(JSON.stringify(a) === JSON.stringify(b), () => `passo ${passo}: ${azione.tipo} diverge dopo il salvataggio`);
        if (passo % 11 === 0) {
          for (const per of [...s.giocatori.map((g) => g.id), null]) {
            verifica(
              JSON.stringify(vistaPer(s, per)) === JSON.stringify(vistaPer(riletto, per)),
              () => `passo ${passo}: vista di ${String(per)} diversa dopo il salvataggio`,
            );
          }
        }
      });
    },
    120_000,
  );

  it('stessa partita giocata due volte: stessa sequenza di stati e di viste a ogni passo', () => {
    const registra = (): string[] => {
      const traccia: string[] = [];
      giocaPartita(3, 2024, (s) => {
        traccia.push(JSON.stringify(s));
        traccia.push(JSON.stringify(vistaPer(s, 'p2')));
      });
      return traccia;
    };
    const a = registra();
    const b = registra();
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) verifica(a[i] === b[i], () => `divergenza all'elemento ${i}`);
  }, 60_000);

  it('le azioni rifiutate non lasciano tracce (generatore, eventi, contatori): l\'azione successiva dà lo stesso stato che senza i tentativi', () => {
    const rnd = generatore(55);
    let rifiutate = 0;
    giocaPartita(3, 55, (s, azione, passo) => {
      if (azione === null || passo % 4 !== 0) return;
      const prima = structuredClone(s);
      for (const v of azioniACaso(s, rnd)) {
        const r = tentaApplica(s, v as Azione);
        if (!r.ok) rifiutate++;
      }
      verifica(JSON.stringify(applica(s, azione)) === JSON.stringify(applica(prima, azione)), () => `passo ${passo}`);
    });
    expect(rifiutate).toBeGreaterThan(100);
  }, 60_000);
});

// ─── Robustezza ──────────────────────────────────────────────────────────────

describe('Revisione · robustezza contro azioni malformate (specifica §1 "Azioni non valide", §13)', () => {
  it(
    'partite a 2 giocatori: ogni variante malformata delle azioni valide e ogni azione a caso dà ErroreRegola oppure uno stato integro, mai un\'altra eccezione',
    () => {
      provaRobustezza(2, 0);
      provaRobustezza(2, 1);
    },
    180_000,
  );

  it('vistaPer, inAttesaDi e azioniPossibili non lanciano con id estranei o valori strani come destinatario', () => {
    giocaPartita(3, 1234, (s, _a, passo) => {
      if (passo % 13 !== 0) return;
      for (const chi of ['nessuno', '', 'g9']) {
        verifica(azioniPossibili(s, chi).length === 0, () => `azioni per ${chi}`);
        const v = vistaPer(s, chi);
        verifica(v.giocatori.every((g) => g.mano === null), () => `mani esposte a ${chi}`);
      }
    });
  }, 60_000);

  it('nuovaPartita rifiuta con ErroreRegola input malformati comuni (giocatori mancanti, nulli, senza id o pecora, seme non numerico)', () => {
    const due = giocatoriDi(2);
    const casi: unknown[] = [
      undefined,
      null,
      {},
      { giocatori: 'ab', seme: 1 },
      { giocatori: [null, null], seme: 1 },
      { giocatori: [{ id: 'a' }, { id: 'b' }], seme: 1 },
      { giocatori: [{ ...due[0], id: 3 }, due[1]], seme: 1 },
      { giocatori: due },
      { giocatori: due, seme: '1' },
      { giocatori: due, seme: Number.NaN },
      { giocatori: due, seme: Number.POSITIVE_INFINITY },
      { giocatori: [...due, ...giocatoriDi(3).slice(2), { id: 'p4', nome: 'X', pecora: 'ricciolo' }], seme: 1 },
    ];
    for (const c of casi) {
      expect(() => nuovaPartita(c as Parameters<typeof nuovaPartita>[0]), JSON.stringify(c)).toThrow(ErroreRegola);
    }
  });
});

// ─── Bug trovati ─────────────────────────────────────────────────────────────

describe('Revisione · input di nuovaPartita e nomi che coincidono con proprietà di Object.prototype', () => {
  it('[specifica §3.1 "pecore valide"] nuovaPartita rifiuta una pecora "toString", "constructor" o "__proto__" (giocatori_non_validi)', () => {
    for (const pecora of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      const giocatori = [
        { id: 'a', nome: 'A', pecora: pecora as IdPecora },
        { id: 'b', nome: 'B', pecora: 'ricciolo' as IdPecora },
      ];
      expect(() => nuovaPartita({ giocatori, seme: 1 }), pecora).toThrow(ErroreRegola);
    }
  });

  it('[specifica §3.1 "id unici … (giocatori_non_validi)"] nuovaPartita con un elenco bucato (voce senza giocatore) lancia ErroreRegola, non TypeError', () => {
    const elenco = giocatoriDi(3);
    // `[ , b, c]`: la prima voce manca. map/some saltano i buchi, quindi la validazione la lascia passare.
    const bucato = [...elenco] as Array<(typeof elenco)[number] | undefined>;
    delete bucato[0];
    expect(() => nuovaPartita({ giocatori: bucato as typeof elenco, seme: 1 })).toThrow(ErroreRegola);
  });

  it('[specifica §2 "defCarta lancia se il tipo non esiste"] defCarta("constructor") e defCarta("toString#1") lanciano', () => {
    expect(() => defCarta('constructor')).toThrow();
    expect(() => defCarta('toString#1')).toThrow();
    expect(() => defCarta('__proto__')).toThrow();
  });

  it('[specifica §3.1 "id unici" e §1 "azioni non valide ⇒ ErroreRegola"] un giocatore con id "__proto__": o nuovaPartita lo rifiuta con ErroreRegola, o un round intero si gioca senza eccezioni', () => {
    let s: Stato;
    try {
      s = nuovaPartita({ giocatori: giocatoriDi(3, ['__proto__', 'b', 'c']), seme: 1 });
    } catch (e) {
      expect(e).toBeInstanceOf(ErroreRegola);
      return;
    }
    // Si gioca il primo round scegliendo sempre la prima azione possibile di chi è atteso.
    for (let i = 0; i < 200 && s.round === 1 && s.esito === null; i++) {
      const a = candidati(s, false)[0];
      if (!a) throw new Error(`nessuna azione in ${s.fase.nome}`);
      s = applica(s, a);
    }
    expect(s.round > 1 || s.esito !== null).toBe(true);
  });

  /** true se nuovaPartita accetta l'id; se lo rifiuta deve farlo con ErroreRegola (correzione ammessa). */
  function idAccettato(id: IdGiocatore): boolean {
    try {
      nuovaPartita({ giocatori: giocatoriDi(3, [id, 'b', 'c']), seme: 1 });
      return true;
    } catch (e) {
      expect(e).toBeInstanceOf(ErroreRegola);
      return false;
    }
  }

  /** Giocatore "constructor" (id accettato da nuovaPartita, §3) fuori dal round: niente Trovate e mazzo vuoto (D32, D34). */
  function conConstructorFuori(): Stato {
    return prosegui(
      scenario({
        giocatori: [{ id: 'constructor' }, { id: 'b' }, { id: 'c' }],
        guaio: 'tosatura-a-sorpresa',
        mani: { constructor: ['beee-no'], b: ['carriola'], c: ['balla-di-fieno'] },
        mazzo: [],
      }),
    );
  }

  it('[specifica §2 "punteggioTotale … 0 se non partecipa"] con un giocatore "constructor" fuori dal round punteggioTotale vale 0 (o l\'id è rifiutato da nuovaPartita)', () => {
    if (!idAccettato('constructor')) return;
    const s = conConstructorFuori();
    expect(s.fase.nome).toBe('scelta');
    expect(s.datiRound.partecipanti).toEqual(['b', 'c']);
    expect(punteggioTotale(s, 'constructor')).toBe(0);
  });

  it('[specifica §10 "miaScelta per g"] vistaPer per un giocatore "constructor" fuori dal round non lancia e mostra miaScelta null (o l\'id è rifiutato da nuovaPartita)', () => {
    if (!idAccettato('constructor')) return;
    const s = conConstructorFuori();
    expect(() => vistaPer(s, 'constructor')).not.toThrow();
    expect(vistaPer(s, 'constructor').fase).toMatchObject({ nome: 'scelta', miaScelta: null });
  });
});
