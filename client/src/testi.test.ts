// Prove dei testi: singolare e plurale con i numeri, punteggiatura dei consigli.
import { describe, expect, it } from 'vitest';
import { SETUP, defCarta } from '../../engine/src';
import { valoriCerchi } from './scena/fionda/tiro';
import { T, nomiPerEsempi, regole } from './testi';
import type { IdSezioneRegole, SezioneRegole } from './testi';

describe('testi: singolare e plurale', () => {
  it('segnalino della targa: "Manca 1" / "Mancano 2"', () => {
    expect(T.scena.segnalini.quasiPieno(1)).toBe('Manca 1');
    expect(T.scena.segnalini.quasiPieno(2)).toBe('Mancano 2');
    expect(T.scena.segnalini.quasiPieno(0)).toBe('Mancano 0');
  });

  it('riassunto per i lettori di schermo: "1 agnellino", "1 Guaio"', () => {
    expect(T.scena.riassunto.posto('Anna', 1, 15, 1)).toBe('Anna: 1 agnellino su 15, 1 Guaio');
    expect(T.scena.riassunto.posto('Anna', 4, 15, 0)).toBe('Anna: 4 agnellini su 15, 0 Guai');
    expect(T.scena.riassunto.gregge(1)).toBe('Gregge: 1 agnellino');
    expect(T.scena.riassunto.gregge(12)).toBe('Gregge: 12 agnellini');
  });
});

describe('testi: i consigli della partita di prova', () => {
  it('mai due "due punti" nella stessa frase', () => {
    for (const [id, testo] of Object.entries(T.prova.consigli)) {
      for (const frase of testo.split(/[.!?]\s/)) expect(frase.split(':').length, `${id}: "${frase}"`).toBeLessThanOrEqual(2);
    }
  });
});

describe('regole', () => {
  /** Tutto il testo di una sezione: blocchi e didascalie. */
  const testoDi = (s: SezioneRegole): string =>
    s.blocchi.map((b) => [b.testo, ...b.figure.map((f) => f.didascalia ?? '')].join(' ')).join(' ');
  const sezione = (id: IdSezioneRegole, sezioni: SezioneRegole[] = regole(null)): SezioneRegole => {
    const s = sezioni.find((x) => x.id === id);
    if (!s) throw new Error(`manca la sezione ${id}`);
    return s;
  };
  /** Una copia modificabile dei dati (SETUP è congelato). */
  const setupCopia = (): typeof SETUP => structuredClone(SETUP) as typeof SETUP;
  const figureDi = (s: SezioneRegole) => s.blocchi.flatMap((b) => b.figure);

  it('otto sezioni nell\'ordine, con i loro titoli', () => {
    const s = regole(null);
    expect(s.map((x) => x.id)).toEqual(['scopo', 'round', 'carte', 'dado', 'guai', 'beeeno', 'fine', 'esempi']);
    expect(s.map((x) => x.titolo)).toEqual([
      'Lo scopo',
      'Un round in 5 passi',
      'Le carte',
      'Il dado',
      'Guai ed eliminazione',
      'Il Beee-NO!',
      'Come finisce la partita',
      'Tre esempi',
    ]);
  });

  it('lo scopo legge i posti dell\'Ovile da setup.json', () => {
    const scopo = testoDi(sezione('scopo'));
    for (const n of ['18', '15', '12']) expect(scopo).toContain(n);
    const altro = setupCopia();
    altro.perNumeroGiocatori['3']!.postiOvile = 20;
    const scopo2 = testoDi(sezione('scopo', regole(null, altro)));
    expect(scopo2).toContain('20');
    expect(scopo2).not.toContain('15');
  });

  it('lo scopo mostra agnellino, Montone e le quattro pecore con il loro tratto', () => {
    const figure = figureDi(sezione('scopo'));
    expect(figure.some((f) => f.disegno.tipo === 'agnellino')).toBe(true);
    expect(figure.some((f) => f.disegno.tipo === 'montone')).toBe(true);
    const pecore = figure.flatMap((f) => (f.disegno.tipo === 'pecora' ? [{ id: f.disegno.pecora, didascalia: f.didascalia }] : []));
    expect(pecore.map((p) => p.id)).toEqual(SETUP.pecore.map((p) => p.id));
    // Spazio non separabile tra segno e tipo: mai a capo dopo "+1"
    expect(pecore[0]!.didascalia).toBe('Ricciolo · +1 Meteo · −1 Predatori');
  });

  it('il round ha 5 passi e ripesca "fino a 5" (da manoIniziale)', () => {
    const round = sezione('round');
    expect(round.blocchi).toHaveLength(5);
    expect(testoDi(round)).toContain('fino a 5');
    const altro = setupCopia();
    altro.manoIniziale = 6;
    expect(testoDi(sezione('round', regole(null, altro)))).toContain('fino a 6');
  });

  it('il dado: la riga fissata della Testata, le facce in ordine e il recinto dopo la riga', () => {
    const dado = sezione('dado');
    const riga =
      'Centro del recinto 3 agnellini, dentro il recinto 2, sulla staccionata o appena fuori 1, più in là nessuno (mai più di quanti ne ha): li perde e tornano nel Gregge.';
    const i = dado.blocchi.findIndex((b) => b.testo === riga);
    expect(i).toBeGreaterThanOrEqual(0);
    const facce = figureDi(dado).flatMap((f) => (f.disegno.tipo === 'faccia' ? [f.disegno.faccia] : []));
    expect(facce).toEqual(SETUP.dado.map((f) => f.id));
    const conRecinto = dado.blocchi.flatMap((b, j) => (b.figure.some((f) => f.disegno.tipo === 'recinto') ? [j] : []));
    expect(conRecinto).toEqual([i]);
    const testo = testoDi(dado);
    expect(testo).toContain('Sei facce: quattro numeri e due Testate.');
    expect(testo).toContain('oltre l\'ultimo posto libero non si prendono');
    expect(testo).toMatch(/Pascolo[^.]*3 o 5/);
    expect(testo).toMatch(/Furto[^.]*2 o 4/);
    expect(testo).toContain('2 facce su 6');
  });

  it('i Guai: regole di eliminazione lette da setup.json', () => {
    const guai = testoDi(sezione('guai'));
    expect(guai).toContain('3 Guai uguali');
    expect(guai).toContain('4 diversi');
    expect(guai).toContain('4 uguali');
    const altro = setupCopia();
    altro.eliminazione.normale = [
      { regola: 'uguali', quanti: 5 },
      { regola: 'diversi', quanti: 4 },
    ];
    expect(testoDi(sezione('guai', regole(null, altro)))).toContain('5 Guai uguali');
  });

  it('le carte: valori dal catalogo, "da 0 a 9", +2 e −2, tredici carte', () => {
    const carte = testoDi(sezione('carte'));
    for (const id of ['fischietto-da-richiamo', 'cannocchiale', 'carriola', 'balla-di-fieno']) {
      const def = defCarta(id);
      if (def.famiglia !== 'trovata') throw new Error(id);
      expect(carte).toContain(`${def.nome} vale ${def.valore}`);
    }
    expect(carte).toContain('da 0 a 9');
    expect(carte).toContain('+2');
    expect(carte).toContain('−2');
    // 2 Trovate con effetto, 2 senza, 2 Gemelle, 3 Belati, 4 Guai (elenco del compito 1).
    expect(figureDi(sezione('carte')).filter((f) => f.disegno.tipo === 'carta')).toHaveLength(13);
  });

  it('ogni carta è del catalogo e ogni faccia esiste nel dado', () => {
    for (const nomi of [null, ['Zoe', 'Ugo'], ['Zoe', 'Ugo', 'Ivo', 'Eva']]) {
      for (const s of regole(nomi)) {
        for (const f of figureDi(s)) {
          const d = f.disegno;
          if (d.tipo === 'carta') expect(() => defCarta(d.id)).not.toThrow();
          if (d.tipo === 'faccia') expect(SETUP.dado.some((x) => x.id === d.faccia), d.faccia).toBe(true);
        }
      }
    }
  });

  it('Beee-NO! con la finestra di 6 secondi, la fine con parità e Belato Finale', () => {
    expect(testoDi(sezione('beeeno'))).toContain('6 secondi');
    const fine = sezione('fine');
    expect(testoDi(fine)).toContain('meno agnellini');
    expect(testoDi(fine)).toContain('Belato Finale');
    expect(figureDi(fine)).toHaveLength(0);
  });

  it('come finisce la partita: ogni blocco comincia con le parole d\'apertura a parte (in grassetto), il resto nel testo', () => {
    const fine = sezione('fine');
    expect(fine.blocchi.map((b) => b.forte)).toEqual([
      'Ovile pieno.',
      'Ultima pecora.',
      'Mazzo finito.',
      'Pari al primo posto in un round?',
      'Pari all\'ultimo posto?',
      'Tutti pari?',
    ]);
    for (const b of fine.blocchi) expect(b.testo).not.toContain(b.forte!);
    expect(fine.blocchi[0]!.testo.startsWith('Chi riempie il proprio Ovile')).toBe(true);
    // Le altre sezioni non hanno parole d'apertura
    for (const s of regole(null)) if (s.id !== 'fine') for (const b of s.blocchi) expect(b.forte).toBeUndefined();
  });

  it('il richiamo di chi ospita è corto, per stare su una riga anche a 360 px', () => {
    // 268 px misurati nel browser (Atkinson Hyperlegible 700, 15 px): sta su una riga a 360 px (292 px di spazio) e a 375
    // (307); a 320 px (252) va a capo. Dice "scollegato", non "uscito": chi si è scollegato può rientrare
    expect(T.regole.richiamoScollegato).toBe('Un giocatore si è scollegato: decidi tu.');
  });

  it('nomiPerEsempi: i nomi della partita completati con quelli di esempio', () => {
    expect(nomiPerEsempi(null)).toEqual(['Ada', 'Bea', 'Cleo']);
    expect(nomiPerEsempi(['Tu', 'Bea', 'Leo'])).toEqual(['Tu', 'Bea', 'Leo']);
    expect(nomiPerEsempi(['Bea', 'Zoe'])).toEqual(['Bea', 'Zoe', 'Ada']);
    expect(nomiPerEsempi(['ada', 'Ugo', 'Ivo', 'Eva'])).toEqual(['ada', 'Ugo', 'Ivo']);
    const [a, b, c] = nomiPerEsempi(['ADA', 'Bea']);
    expect([a, b]).toEqual(['ADA', 'Bea']);
    expect(['ada', 'bea']).not.toContain(c.toLowerCase());
    // Nomi ripetuti: gli esempi hanno sempre tre nomi diversi.
    expect(new Set(nomiPerEsempi(['Ugo', 'ugo']).map((n) => n.toLowerCase())).size).toBe(3);
  });

  it('esempi: l\'eliminazione segue il numero dei giocatori e usa i loro nomi', () => {
    const due = sezione('esempi', regole(['Zoe', 'Ugo']));
    expect(due.blocchi).toHaveLength(3);
    expect(due.blocchi[1]!.figure).toHaveLength(4);
    expect(due.blocchi[1]!.testo).toContain('Zoe');
    const tre = sezione('esempi', regole(['Zoe', 'Ugo', 'Ivo']));
    expect(tre.blocchi[1]!.figure).toHaveLength(3);
    for (const n of ['Zoe', 'Ugo', 'Ivo']) expect(tre.blocchi[0]!.testo).toContain(n);
    expect(testoDi(sezione('beeeno', regole(['Zoe', 'Ugo'])))).toContain('Zoe');
    expect(testoDi(sezione('esempi'))).toContain('Ada');
  });

  it('mai due "due punti" nella stessa frase', () => {
    const testi: string[] = [
      T.regole.stanzaVaAvanti,
      T.regole.stanzaInPausa,
      T.regole.stanzaFinita,
      T.regole.richiamo,
      T.regole.richiamoScollegato,
      T.regole.figure(3),
    ];
    for (const nomi of [null, ['Zoe', 'Ugo'], ['Zoe', 'Ugo', 'Ivo']]) {
      for (const s of regole(nomi)) {
        testi.push(s.titolo);
        for (const b of s.blocchi) testi.push(b.testo, ...b.figure.map((f) => f.didascalia ?? ''));
      }
    }
    for (const testo of testi) {
      for (const frase of testo.split(/[.!?]\s/)) expect(frase.split(':').length, `"${frase}"`).toBeLessThanOrEqual(2);
    }
  });

  it('il tratto conta con il Guaio del round, non con quelli dell\'Angolo; niente tratto con la Tosatura', () => {
    for (const id of ['scopo', 'guai'] as const) {
      const testo = testoDi(sezione(id));
      expect(testo, id).toContain('Guaio del round');
      expect(testo, id).toContain('Tosatura a Sorpresa il tratto non conta');
      expect(testo, id).not.toMatch(/con i Guai del tipo/);
    }
    // Ricciolo senza articoli scritti a mano: "di tipo Meteo", "di tipo Predatori".
    expect(testoDi(sezione('guai'))).toContain('Ricciolo prende +1 al punteggio quando il Guaio del round è di tipo Meteo, −1 quando è di tipo Predatori.');
  });

  it('le Gemelle si possono giocare insieme, non per forza', () => {
    const carte = testoDi(sezione('carte'));
    expect(carte).toContain('Due Gemelle si possono giocare insieme e i loro valori si sommano.');
    expect(carte).not.toContain('in coppia');
  });

  it('in due giocatori: le Trovate tolte dal mazzo e le Gemelle che restano, dai dati', () => {
    const carte = testoDi(sezione('carte'));
    expect(carte).toContain('In due giocatori si tolgono dal mazzo le Trovate di valore 1, 2 e 3');
    expect(carte).toContain('resta solo Orecchino gemello');
    const altro = setupCopia();
    altro.varianteDueGiocatori.valoriTrovateTolti = [1, 2];
    const carte2 = testoDi(sezione('carte', regole(null, altro)));
    expect(carte2).toContain('di valore 1 e 2');
    expect(carte2).toContain('Calzino gemello');
    expect(carte2).toContain('Orecchino gemello');
  });

  it('il dado, la finestra e la regola a 2 giocatori seguono un setup modificato', () => {
    const altro = setupCopia();
    altro.dado = altro.dado.map((f) =>
      f.id === 'testata' ? { ...f, copie: 3 } : f.id === 'pascolo_grande' ? { ...f, quantita: 6 } : f.id === 'furto_piccolo' ? { ...f, quantita: 1 } : f,
    );
    altro.finestraReazioneSecondi = 9;
    altro.eliminazione.dueGiocatori = [
      { regola: 'uguali', quanti: 5 },
      { regola: 'diversi', quanti: 4 },
    ];
    const dado = testoDi(sezione('dado', regole(null, altro)));
    expect(dado).toContain('Sette facce: quattro numeri e tre Testate.');
    expect(dado).toContain('3 o 6');
    expect(dado).toContain('1 o 4');
    expect(dado).toContain('3 facce su 7');
    expect(testoDi(sezione('beeeno', regole(null, altro)))).toContain('9 secondi');
    expect(testoDi(sezione('guai', regole(null, altro)))).toContain('5 uguali');
    // Esempio (b) a 2 giocatori: 4 Meteo e la Tosatura.
    const b = sezione('esempi', regole(['Zoe', 'Ugo'], altro)).blocchi[1]!;
    expect(b.figure).toHaveLength(5);
    expect(b.testo).toContain('5 Guai dello stesso tipo');
  });

  it('eliminazione: due gruppi di figure, uguali e diversi', () => {
    const guai = sezione('guai');
    const uguali = guai.blocchi.find((x) => x.testo.includes('3 Guai uguali'))!;
    expect(uguali.testo).toContain('dello stesso tipo');
    expect(uguali.figure.map((f) => (f.disegno.tipo === 'carta' ? f.disegno.id : ''))).toEqual([
      'grandine-a-sorpresa',
      'fulmine-curioso',
      'pioggia-di-traverso',
    ]);
    const diversi = guai.blocchi.find((x) => x.testo.includes('4 Guai diversi'))!;
    expect(diversi.figure.map((f) => (f.disegno.tipo === 'carta' ? f.disegno.id : ''))).toEqual([
      'grandine-a-sorpresa',
      'volpe-gentile',
      'crisi-esistenziale',
      'tosatura-a-sorpresa',
    ]);
  });

  it('frasi più chiare: Furto, parità, mazzo dei Guai, Angolo, vittoria condivisa, pecora eliminata', () => {
    expect(testoDi(sezione('dado'))).toContain('Furto: ruba 2 o 4');
    const fine = testoDi(sezione('fine'));
    expect(fine).toContain('Lanciano il dado tutti quelli pari');
    expect(fine).toContain('in fondo al mazzo dei Guai');
    expect(fine).toContain('Se sono ancora pari vincono insieme.');
    expect(testoDi(sezione('scopo'))).toContain('Se sono ancora pari vincono insieme.');
    // L'Angolo dei Guai si presenta nel round, prima di usarlo nelle Carte e nei Guai.
    expect(testoDi(sezione('round'))).toContain('lo mette nel suo Angolo dei Guai');
    const guai = testoDi(sezione('guai'));
    expect(guai).toContain('La pecora eliminata lascia');
    expect(guai).toContain('Ogni Tosatura vale come un solo Guaio');
    expect(guai).not.toContain('Chi è eliminata');
    expect(testoDi(sezione('beeeno'))).toContain('Si gioca anche fuori turno, entro 6 secondi');
  });

  it('nomiPerEsempi: nomi vuoti o di soli spazi non contano, e i nomi escono ripuliti', () => {
    expect(nomiPerEsempi(['', '  ', 'Zoe'])).toEqual(['Zoe', 'Ada', 'Bea']);
    expect(nomiPerEsempi([' Zoe ', 'zoe', 'Ugo'])).toEqual(['Zoe', 'Ugo', 'Ada']);
  });

  it('T.regole: i piccoli testi', () => {
    expect(T.regole.titolo).toBe('Regole');
    expect(T.regole.indietro).toBe('Indietro');
    expect(T.regole.nomiEsempio).toEqual(['Ada', 'Bea', 'Cleo', 'Dario']);
    expect(T.regole.valore(7)).toBe('valore 7');
    expect(T.regole.guaioDi('meteo')).toBe('Guaio Meteo');
    expect(T.regole.carta('Cannocchiale', 'valore 7', 'Guarda le prime 2 carte del mazzo: tienine 1, scarta l\'altra.')).toBe(
      'Cannocchiale, valore 7. Guarda le prime 2 carte del mazzo: tienine 1, scarta l\'altra.',
    );
    expect(T.regole.carta('Visita di Garzina', null, 'Togli un Guaio.')).toBe('Visita di Garzina. Togli un Guaio.');
    // Un nome che finisce già con il punto esclamativo non prende un altro punto.
    expect(T.regole.carta('Beee-NO!', null, 'Annulla.')).toBe('Beee-NO! Annulla.');
    expect(T.regole.figure(3)).toBe('3 figure, scorri di lato');
  });
});

describe('giro finale: correzioni dei testi', () => {
  const testoDi = (s: SezioneRegole): string =>
    s.blocchi.map((b) => [b.testo, ...b.figure.map((f) => f.didascalia ?? '')].join(' ')).join(' ');
  const sezione = (id: IdSezioneRegole, sezioni: SezioneRegole[] = regole(null)): SezioneRegole => sezioni.find((x) => x.id === id)!;
  const setupCopia = (): typeof SETUP => structuredClone(SETUP) as typeof SETUP;

  it('Testata: chi è colpito perde gli agnellini, che tornano nel Gregge (Regole e consiglio della prova)', () => {
    expect(testoDi(sezione('dado'))).toContain(
      'Centro del recinto 3 agnellini, dentro il recinto 2, sulla staccionata o appena fuori 1, più in là nessuno (mai più di quanti ne ha): li perde e tornano nel Gregge.',
    );
    expect(T.prova.consigli.testata).toContain('tornano nel Gregge');
  });

  it('Testata: i numeri delle zone vengono dai dati (esitoMassimo)', () => {
    const altro = setupCopia();
    altro.testata.esitoMassimo = 2;
    expect(testoDi(sezione('dado', regole(null, altro)))).toContain('Centro del recinto 2 agnellini, dentro il recinto 2, sulla staccionata o appena fuori 1,');
    altro.testata.esitoMassimo = 1;
    expect(testoDi(sezione('dado', regole(null, altro)))).toContain('Centro del recinto 1 agnellino, dentro il recinto 1,');
    // Gli stessi numeri dei cerchi della mira e del disegno del recinto
    for (const m of [0, 1, 2, 3, 4]) {
      altro.testata.esitoMassimo = m;
      const [c, i, b] = valoriCerchi(m);
      expect(testoDi(sezione('dado', regole(null, altro))), String(m)).toContain(`recinto ${c} ${c === 1 ? 'agnellino' : 'agnellini'}, dentro il recinto ${i}, sulla staccionata o appena fuori ${b},`);
    }
  });

  it('Furto: se gli altri non ne hanno abbastanza, il resto viene dal Gregge', () => {
    expect(testoDi(sezione('dado'))).toContain('Furto: ruba 2 o 4 agnellini agli altri, divisi come vuoi. Se gli altri non ne hanno abbastanza, il resto viene dal Gregge.');
  });

  it('il richiamo di chi ospita dice che il giocatore si è scollegato', () => {
    expect(T.regole.richiamoScollegato).toBe('Un giocatore si è scollegato: decidi tu.');
  });

  it('in due giocatori niente Belato Finale (D36) e l\'esempio del round è a due', () => {
    const due = regole(['Zoe', 'Ugo']);
    expect(testoDi(sezione('fine', due))).not.toContain('Belato Finale');
    expect(sezione('fine', due).blocchi.map((b) => b.forte)).not.toContain('Pari all\'ultimo posto?');
    // In due anche la parità al primo posto non può capitare: è sempre "Tutti pari" (decisione dell'utente, 27 ottobre)
    expect(sezione('fine', due).blocchi.map((b) => b.forte)).not.toContain('Pari al primo posto in un round?');
    expect(testoDi(sezione('fine', due))).toContain('in fondo al mazzo dei Guai');
    expect(sezione('esempi', due).blocchi[0]!.testo).toBe(
      'Zoe e Ugo fanno 7 e 4. Zoe lancia il dado. Ugo prende il Guaio, riceve 1 agnellino e può scartare una carta.',
    );
    // Fuori da una partita e a 3–4 giocatori resta tutto com'era
    for (const nomi of [null, ['Zoe', 'Ugo', 'Ivo']]) {
      expect(testoDi(sezione('fine', regole(nomi)))).toContain('Belato Finale');
      expect(sezione('fine', regole(nomi)).blocchi.map((b) => b.forte)).toContain('Pari al primo posto in un round?');
      expect(sezione('esempi', regole(nomi)).blocchi[0]!.testo).toContain('fanno 7, 7 e 4.');
    }
  });

  it('il Guaio torna in fondo al mazzo dei Guai, anche nei messaggi della partita', () => {
    expect(T.guai.inFondo).toBe('Il Guaio torna in fondo al mazzo dei Guai.');
    expect(T.guai.tuttiPari).toBe('Tutti pari: il Guaio torna in fondo al mazzo dei Guai e nessuno lancia il dado.');
  });

  it('il consiglio dell\'eliminazione nella prova legge le regole da setup.json', () => {
    const [u, d] = [SETUP.eliminazione.normale.find((r) => r.regola === 'uguali')!, SETUP.eliminazione.normale.find((r) => r.regola === 'diversi')!];
    expect(T.prova.consigli.guaioTuo).toContain(`con ${u.quanti} Guai uguali o ${d.quanti} diversi sei fuori`);
  });

  it('la scritta della mira nomina il bersaglio e, su un dispositivo condiviso, chi tira', () => {
    expect(T.testata.fionda.scritta('Bea', 'Anna')).toBe('Anna, tira indietro il Montone e lascialo andare verso l\'Ovile di Bea');
    expect(T.testata.fionda.scritta('Bea')).toBe('Tira indietro il Montone e lascialo andare verso l\'Ovile di Bea');
  });
});
