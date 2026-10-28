// Partite a più dispositivi con il database in memoria: sala d'attesa, riservatezza, partita completa,
// Beee-NO! di un ospite sul dado, ricarica e rientro, pausa e bot, host che si scollega, timer, pulizia.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applica, configPer, vistaPer } from '../engine/src';
import type { Azione, Evento, IdGiocatore, Stato } from '../engine/src';
import { avanza, chiudiPunteggio, conFaccia, prosegui, scegli, scenario } from '../engine/test/aiuti';
import { normale } from '../engine/sim/politiche';
import { SessioneHost, TEMPI } from './host';
import type { OpzioniHost } from './host';
import { archivioInMemoria } from './locale';
import type { Archivio } from './locale';
import { SeiHostDellaStanza, SessioneOspite } from './ospite';
import { percorsi, vistaDaPubblicare } from './stanza';
import type { Iscrizione } from './stanza';
import { ArchivioMemoria, ErrorePermesso } from './trasporto-memoria';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const scorri = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

/** Generatore con seme per le scelte dei giocatori nei test. */
function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Tavolata {
  rete: ArchivioMemoria;
  host: SessioneHost;
  salvataggioHost: Archivio;
  ospiti: SessioneOspite[];
  codice: string;
}

/** Host + ospiti in sala d'attesa, già sistemati nei loro posti. */
async function tavolata(nOspiti = 2, opzioni?: OpzioniHost): Promise<Tavolata> {
  const rete = new ArchivioMemoria();
  const salvataggioHost = archivioInMemoria();
  const host = await SessioneHost.crea(
    rete.dispositivo('uid-host'),
    salvataggioHost,
    { nome: 'Ada', pecora: 'ricciolo', gettone: 'gettone-host' },
    undefined,
    opzioni,
  );
  const nomi = ['Bea', 'Cleo', 'Dora'];
  const pecore = ['brontolana', 'sospirella', 'nerina'] as const;
  const ospiti: SessioneOspite[] = [];
  for (let i = 0; i < nOspiti; i++) {
    ospiti.push(
      await SessioneOspite.entra(rete.dispositivo(`uid-${i + 2}`), host.codice, {
        nome: nomi[i]!,
        pecora: pecore[i]!,
        gettone: `gettone-${i + 2}`,
      }),
    );
    await scorri();
  }
  await scorri();
  return { rete, host, salvataggioHost, ospiti, codice: host.codice };
}

/** Sostituisce lo stato dell'host (salvataggio + ripresa) per partire da una situazione costruita. */
async function conStato(tv: Tavolata, stato: Stato, opzioni?: OpzioniHost): Promise<SessioneHost> {
  tv.host.chiudi();
  const dati = JSON.parse(tv.salvataggioHost.leggi()!);
  tv.salvataggioHost.scrivi(JSON.stringify({ ...dati, stato }));
  const host = await SessioneHost.riprendi(tv.rete.dispositivo('uid-host'), tv.salvataggioHost, opzioni);
  if (!host) throw new Error('ripresa fallita');
  tv.host = host;
  await scorri();
  return host;
}

describe("Sala d'attesa", () => {
  it('codice di 4 lettere, ospiti nei posti g2 e g3, pecora occupata sostituita con una libera', async () => {
    const tv = await tavolata(1);
    expect(tv.codice).toMatch(/^[A-HJ-NP-Z]{4}$/);
    const terzo = await SessioneOspite.entra(tv.rete.dispositivo('uid-x'), tv.codice, {
      nome: 'Zoe',
      pecora: 'ricciolo', // già dell'host
      gettone: 'g-x',
    });
    await scorri();
    const pub = tv.host.pubblico();
    expect(pub.fase).toBe('attesa');
    expect(pub.giocatori.map((g) => [g.id, g.nome])).toEqual([
      ['g1', 'Ada'],
      ['g2', 'Bea'],
      ['g3', 'Zoe'],
    ]);
    expect(new Set(pub.giocatori.map((g) => g.pecora)).size).toBe(3);
    expect(tv.ospiti[0]!.io).toBe('g2');
    expect(terzo.io).toBe('g3');
    expect(terzo.pubblico()?.giocatori).toHaveLength(3);
  });

  it('in sala si può cambiare pecora (se libera) e nome; la quinta persona trova la stanza piena', async () => {
    const tv = await tavolata(3);
    await tv.ospiti[0]!.cambia({ pecora: 'nerina' }); // occupata da Dora: resta com'è
    await tv.ospiti[1]!.cambia({ nome: 'Cleopatra' });
    await scorri();
    const pub = tv.host.pubblico();
    expect(pub.giocatori.find((g) => g.id === 'g2')?.pecora).toBe('brontolana');
    expect(pub.giocatori.find((g) => g.id === 'g3')?.nome).toBe('Cleopatra');
    const quinto = await SessioneOspite.entra(tv.rete.dispositivo('uid-5'), tv.codice, { nome: 'Eva', pecora: 'nerina', gettone: 'g5' });
    await scorri();
    expect(quinto.io).toBeNull();
    expect(quinto.rifiuto()?.messaggio).toMatch(/piena/);
  });

  it("l'host toglie dalla sala chi se n'è andato: il posto si libera e quel dispositivo non rientra", async () => {
    const tv = await tavolata(2);
    tv.ospiti[1]!.chiudi(); // Cleo se ne va prima dell'inizio
    await scorri();
    expect(tv.host.pubblico().giocatori.find((g) => g.id === 'g3')?.online).toBe(false);
    tv.host.togliDallaSala('g3');
    await scorri();
    expect(tv.host.pubblico().giocatori.map((g) => g.id)).toEqual(['g1', 'g2']);
    const cleo = await SessioneOspite.entra(tv.rete.dispositivo('uid-3'), tv.codice, { nome: 'Cleo', pecora: 'sospirella', gettone: 'gettone-3' });
    await scorri();
    expect(cleo.io).toBeNull();
    expect(cleo.rifiuto()?.messaggio).toMatch(/tolto/);
    // Il posto liberato va a chi entra dopo.
    const dora = await SessioneOspite.entra(tv.rete.dispositivo('uid-9'), tv.codice, { nome: 'Dora', pecora: 'nerina', gettone: 'g9' });
    await scorri();
    expect(dora.io).toBe('g3');
  });

  it('entrare in una stanza che non esiste dà errore', async () => {
    const rete = new ArchivioMemoria();
    await expect(SessioneOspite.entra(rete.dispositivo('u'), 'ZZZZ', { nome: 'A', pecora: 'nerina', gettone: 'x' })).rejects.toThrow(
      /non esiste/,
    );
  });
});

describe('Riservatezza (brief §5, §6)', () => {
  it('ogni ospite riceve solo la propria mano; le viste altrui non si possono leggere; il tavolo non ha mani', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(7);
    await scorri();
    const [bea, cleo] = tv.ospiti as [SessioneOspite, SessioneOspite];
    expect(bea.vista('g2').giocatori.find((g) => g.id === 'g2')?.mano).toHaveLength(5);
    expect(bea.vista('g2').giocatori.find((g) => g.id === 'g3')?.mano).toBeNull();
    const tavolo = bea.pubblico()!.tavolo!;
    expect(tavolo.giocatori.every((g) => g.mano === null)).toBe(true);
    const tBea = tv.rete.dispositivo('uid-2');
    await expect(tBea.leggi(percorsi(tv.codice).vista('g3'))).rejects.toBeInstanceOf(ErrorePermesso);
    await expect(tBea.leggi(percorsi(tv.codice).ingressi)).rejects.toBeInstanceOf(ErrorePermesso);
    await expect(tBea.leggi(percorsi(tv.codice).azioni)).rejects.toBeInstanceOf(ErrorePermesso);
    await expect(tBea.scrivi(percorsi(tv.codice).pubblico, 'falso')).rejects.toBeInstanceOf(ErrorePermesso);
    await expect(tBea.scrivi(percorsi(tv.codice).membro('g3'), 'uid-2')).rejects.toBeInstanceOf(ErrorePermesso);
    // Un'azione scritta a nome di un altro dispositivo non passa le regole.
    await expect(tBea.aggiungi(percorsi(tv.codice).azioni, { uid: 'uid-3', azione: '{}' })).rejects.toBeInstanceOf(ErrorePermesso);
    expect(cleo.vista('g3').giocatori.find((g) => g.id === 'g3')?.mano).toHaveLength(5);
  });

  it("un ospite non può giocare al posto di un altro né mandare azioni di sistema: l'host rifiuta", async () => {
    const tv = await tavolata(2);
    tv.host.inizia(3);
    await scorri(10_000); // fase guaio → scelta
    const bea = tv.ospiti[0]!;
    const prima = tv.host.vista(null);
    const altrui = tv.ospiti[1]!.azioni('g3')[0]!;
    // Bea manda una mossa di Cleo usando la propria coda.
    await tv.rete.dispositivo('uid-2').aggiungi(percorsi(tv.codice).azioni, { uid: 'uid-2', azione: JSON.stringify(altrui) });
    await tv.rete.dispositivo('uid-2').aggiungi(percorsi(tv.codice).azioni, { uid: 'uid-2', azione: JSON.stringify({ tipo: 'prosegui' }) });
    await scorri();
    expect(tv.host.vista(null).fase).toEqual(prima.fase);
    expect(bea.rifiuto()?.messaggio).toMatch(/solo per te/);
  });
});

describe('Partita completa con tre dispositivi (criterio della fase 4)', () => {
  it('host e due ospiti giocano dall\'inizio alla fine solo con le proprie viste e azioni', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(11);
    await scorri();
    const r = generatore(5);
    const giocatori: Array<{ id: IdGiocatore; sessione: SessioneHost | SessioneOspite }> = [
      { id: 'g1', sessione: tv.host },
      { id: 'g2', sessione: tv.ospiti[0]! },
      { id: 'g3', sessione: tv.ospiti[1]! },
    ];
    let passi = 0;
    const storia: string[] = [];
    while (!tv.host.vista(null).esito) {
      if (++passi > 5000) throw new Error('la partita non finisce: ' + storia.slice(-12).join(' | '));
      let mosso = false;
      // A rotazione: nella scelta segreta si può cambiare carta all'infinito (D40), quindi tutti devono avere il turno.
      const ordine = [...giocatori.slice(passi % 3), ...giocatori.slice(0, passi % 3)];
      for (const { id, sessione } of ordine) {
        const azioni = sessione.azioni(id);
        if (azioni.length === 0) continue;
        // Ogni dispositivo vede esattamente la vista che l'host calcola per lui.
        if (sessione instanceof SessioneOspite) {
          expect(sessione.vista(id)).toEqual(vistaDaPubblicare(tv.host.vista(id)));
        }
        let a: Azione = azioni[Math.floor(r() * azioni.length)]!;
        if (a.tipo === 'esitoTestata') a = { ...a, esito: 0 };
        sessione.invia(a);
        storia.push(`${tv.host.vista(null).fase.nome}:${id}:${a.tipo}`);
        mosso = true;
        await scorri();
        break;
      }
      if (!mosso) await scorri(7000); // fasi automatiche e finestre a tempo
    }
    const esito = tv.host.vista(null).esito!;
    await scorri();
    expect(tv.ospiti[0]!.pubblico()?.tavolo?.esito).toEqual(esito);
    expect(tv.ospiti[1]!.vista('g3').esito).toEqual(esito);
  }, 60_000);
});

/** Stato costruito: g1 (host) lancia il dado, g2 (Bea) ha un Beee-NO!. */
function statoAlDado(): Stato {
  let s = prosegui(
    scenario({
      giocatori: [
        { id: 'g1', nome: 'Ada', pecora: 'ricciolo' },
        { id: 'g2', nome: 'Bea', pecora: 'brontolana' },
        { id: 'g3', nome: 'Cleo', pecora: 'sospirella' },
      ],
      guaio: 'tosatura-a-sorpresa',
      mani: { g1: ['carriola'], g2: ['balla-di-fieno', 'beee-no'], g3: ['coperta-di-lana'] },
    }),
  );
  s = chiudiPunteggio(avanza(scegli(s, { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] })));
  return conFaccia(s, 'pascolo_grande');
}

describe('Beee-NO! di un ospite sul dado (criterio della fase 4)', () => {
  it("l'ospite annulla il lancio dell'host: nessun agnellino si muove", async () => {
    const tv = await tavolata(2);
    tv.host.inizia(1);
    await scorri();
    const host = await conStato(tv, statoAlDado());
    const bea = tv.ospiti[0]!;
    const agnelliniPrima = host.vista(null).giocatori.find((g) => g.id === 'g1')!.agnellini;
    expect(host.invia({ tipo: 'lanciaDado', giocatore: 'g1' })).toEqual({ ok: true });
    await scorri();
    const no = bea.azioni('g2').find((a) => a.tipo === 'giocaBelato');
    expect(no).toBeDefined();
    expect(tv.host.pubblico().scadenza).not.toBeNull();
    bea.invia(no!);
    await scorri();
    // Ora la cima è il Beee-NO! di Bea: Ada e Cleo possono rispondere; nessuno lo fa e il timer scade.
    expect(host.vista(null).finestra?.inAttesa.sort()).toEqual(['g1', 'g3']);
    await scorri(host.pubblico().impostazioni.finestraSecondi * 1000 + 100);
    const dopo = host.vista(null);
    expect(dopo.giocatori.find((g) => g.id === 'g1')!.agnellini).toBe(agnelliniPrima);
    expect(dopo.eventi.some((e) => e.tipo === 'annullata')).toBe(true);
    expect(bea.pubblico()!.tavolo!.giocatori.find((g) => g.id === 'g1')!.agnellini).toBe(agnelliniPrima);
  });

  it('senza reazioni la finestra si chiude da sola allo scadere del timer configurato', async () => {
    const tv = await tavolata(2);
    tv.host.impostaFinestra(10);
    tv.host.inizia(1);
    await scorri();
    const host = await conStato(tv, statoAlDado());
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri(9000);
    expect(host.vista(null).finestra).not.toBeNull();
    await scorri(1500);
    expect(host.vista(null).finestra).toBeNull();
    expect(host.vista(null).giocatori.find((g) => g.id === 'g1')!.agnellini).toBe(8);
  });
});

describe('Ricarica, rientro, pausa e bot', () => {
  const iscrizione = (tv: Tavolata, i: number, g: IdGiocatore): Iscrizione => ({
    codice: tv.codice,
    ruolo: 'ospite',
    idGiocatore: g,
    nome: ['Bea', 'Cleo'][i]!,
    pecora: (['brontolana', 'sospirella'] as const)[i]!,
    gettone: `gettone-${i + 2}`,
  });

  it("chi ricarica la pagina rientra con la stessa identità e ritrova la sua mano", async () => {
    const tv = await tavolata(2);
    tv.host.inizia(5);
    await scorri();
    const mano = tv.ospiti[0]!.vista('g2').giocatori.find((g) => g.id === 'g2')!.mano;
    tv.ospiti[0]!.chiudi();
    const di = await SessioneOspite.rientra(tv.rete.dispositivo('uid-2'), iscrizione(tv, 0, 'g2'));
    await scorri();
    expect(di.io).toBe('g2');
    expect(di.vista('g2').giocatori.find((g) => g.id === 'g2')!.mano).toEqual(mano);
  });

  it('con identità nuova si rientra solo con il gettone giusto', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(5);
    await scorri();
    tv.ospiti[0]!.chiudi();
    await scorri(1000); // il rientro arriva dopo l'ingresso originale
    const ladro = await SessioneOspite.rientra(tv.rete.dispositivo('uid-ladro'), { ...iscrizione(tv, 0, 'g2'), gettone: 'sbagliato' });
    await scorri();
    expect(ladro.io).toBeNull();
    expect(ladro.rifiuto()?.messaggio).toMatch(/già iniziata/);
    const nuovo = await SessioneOspite.rientra(tv.rete.dispositivo('uid-2-nuovo'), iscrizione(tv, 0, 'g2'));
    await scorri();
    expect(nuovo.io).toBe('g2');
    await expect(tv.rete.dispositivo('uid-2').leggi(percorsi(tv.codice).vista('g2'))).rejects.toBeInstanceOf(ErrorePermesso);
  });

  it('se un ospite si scollega la partita va in pausa; l\'host può sostituirlo con un bot; quando torna riprende il posto', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(9);
    await scorri();
    tv.ospiti[1]!.chiudi(); // Cleo chiude il browser
    await scorri();
    expect(tv.host.pubblico().pausa).toEqual(['g3']);
    expect(tv.ospiti[0]!.pubblico()!.pausa).toEqual(['g3']);
    const fase = tv.host.vista(null).fase.nome;
    await scorri(30_000);
    expect(tv.host.vista(null).fase.nome).toBe(fase); // ferma
    tv.host.sostituisciConBot('g3');
    await scorri();
    expect(tv.host.pubblico().pausa).toEqual([]);
    expect(tv.host.pubblico().giocatori.find((g) => g.id === 'g3')?.bot).toBe(true);
    // Il bot gioca: la partita va avanti anche senza Cleo.
    for (let i = 0; i < 20 && tv.host.vista(null).round === 1; i++) {
      for (const [s, id] of [
        [tv.host, 'g1'],
        [tv.ospiti[0]!, 'g2'],
      ] as const) {
        const a = s.azioni(id)[0];
        if (a) s.invia(a.tipo === 'esitoTestata' ? { ...a, esito: 0 } : a);
      }
      await scorri(7000);
    }
    expect(tv.host.vista(null).round).toBeGreaterThan(1);
    const torna = await SessioneOspite.rientra(tv.rete.dispositivo('uid-3'), iscrizione(tv, 1, 'g3'));
    await scorri();
    expect(torna.io).toBe('g3');
    expect(tv.host.pubblico().giocatori.find((g) => g.id === 'g3')?.bot).toBe(false);
  }, 30_000);

  it("se l'host chiude il browser gli ospiti lo vedono scollegato; quando riapre la partita riprende e le mosse in coda si applicano", async () => {
    const tv = await tavolata(2);
    tv.host.inizia(4);
    await scorri(10_000);
    expect(tv.host.vista(null).fase.nome).toBe('scelta');
    tv.host.chiudi();
    await scorri();
    const bea = tv.ospiti[0]!;
    expect(bea.hostOnline()).toBe(false);
    const scelta = bea.azioni('g2').find((a) => a.tipo === 'scegliTrovata')!;
    bea.invia(scelta);
    await scorri();
    const host = await SessioneHost.riprendi(tv.rete.dispositivo('uid-host'), tv.salvataggioHost);
    expect(host).not.toBeNull();
    await scorri();
    expect(bea.hostOnline()).toBe(true);
    const fase = host!.vista(null).fase;
    expect(fase.nome === 'scelta' && fase.haScelto.g2).toBe(true);
  });

  it.each([
    [1, [{ regola: 'uguali', quanti: 4 }, { regola: 'perTipo', quanti: 2 }]],
    [2, [{ regola: 'uguali', quanti: 3 }, { regola: 'diversi', quanti: 3 }]],
  ])('con %i ospiti, una stanza salvata con le regole di eliminazione di prima riprende con quelle di adesso', async (nOspiti, vecchie) => {
    const tv = await tavolata(nOspiti);
    tv.host.inizia(2);
    await scorri();
    tv.host.chiudi();
    await scorri();
    const dati = JSON.parse(tv.salvataggioHost.leggi()!);
    dati.stato.config.regoleEliminazione = vecchie;
    tv.salvataggioHost.scrivi(JSON.stringify(dati));
    const host = await SessioneHost.riprendi(tv.rete.dispositivo('uid-host'), tv.salvataggioHost);
    await scorri();
    expect(host?.vista(null).config.regoleEliminazione).toEqual(configPer(nOspiti + 1).regoleEliminazione);
  });

  it("un dispositivo diverso non può riprendere la stanza dell'host", async () => {
    const tv = await tavolata(1);
    tv.host.chiudi();
    expect(await SessioneHost.riprendi(tv.rete.dispositivo('uid-altro'), tv.salvataggioHost)).toBeNull();
  });
});

describe('Correzioni dalla revisione multi-dispositivo', () => {
  it("chi ha creato la stanza e riapre il link non diventa ospite: l'ingresso è rifiutato e si riprende come host", async () => {
    const tv = await tavolata(1);
    tv.host.inizia(3);
    await scorri();
    await expect(
      SessioneOspite.entra(tv.rete.dispositivo('uid-host'), tv.codice, { nome: 'Ada', pecora: 'ricciolo', gettone: 'nuovo' }),
    ).rejects.toBeInstanceOf(SeiHostDellaStanza);
    expect(tv.host.pubblico().giocatori.map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  it('un "Lascia passare" arrivato dopo un Beee-NO! altrui non finisce sulla nuova finestra', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(1);
    await scorri();
    const host = await conStato(tv, statoAlDado());
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri();
    const [bea, cleo] = tv.ospiti as [SessioneOspite, SessioneOspite];
    const passaCleo = cleo.azioni('g3').find((a) => a.tipo === 'passa')!;
    // Il Beee-NO! di Bea arriva all'host prima del "passa" di Cleo, pensato per il dado.
    bea.invia(bea.azioni('g2').find((a) => a.tipo === 'giocaBelato')!);
    cleo.invia(passaCleo);
    await scorri();
    expect(host.vista(null).finestra?.inAttesa).toContain('g3');
    expect(cleo.rifiuto()?.messaggio).toMatch(/non è più aperto/);
  });

  it('la stessa persona con due schede: chiuderne una non la fa risultare scollegata', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(2);
    await scorri();
    const secondaScheda = await SessioneOspite.rientra(tv.rete.dispositivo('uid-2'), {
      codice: tv.codice,
      ruolo: 'ospite',
      idGiocatore: 'g2',
      nome: 'Bea',
      pecora: 'brontolana',
      gettone: 'gettone-2',
    });
    await scorri();
    secondaScheda.chiudi(); // la scheda vecchia (o la connessione vecchia) se ne va
    await scorri();
    expect(tv.host.pubblico().pausa).toEqual([]);
  });

  it('se la stanza viene ripresa da un\'altra scheda, quella vecchia si ferma (mai due host)', async () => {
    const tv = await tavolata(1);
    tv.host.inizia(2);
    await scorri();
    const vecchio = tv.host;
    const nuovo = await SessioneHost.riprendi(tv.rete.dispositivo('uid-host'), tv.salvataggioHost);
    await scorri();
    expect(nuovo).not.toBeNull();
    expect(vecchio.sostituita()).toBe(true);
    expect(nuovo!.sostituita()).toBe(false);
    // La vecchia scheda non applica più nulla.
    expect(vecchio.invia({ tipo: 'prosegui' }).ok).toBe(false);
    await scorri(10_000);
    expect(nuovo!.vista(null).fase.nome).toBe('scelta');
  });

  it('le regole rifiutano campi in più, presenze in stanze inesistenti e stanze senza registro di attività', async () => {
    const tv = await tavolata(1);
    const t = tv.rete.dispositivo('uid-2');
    const p = percorsi(tv.codice);
    await expect(t.scrivi(p.ingresso('uid-2'), { nome: 'Bea', pecora: 'nerina', gettone: 'x', zavorra: 'x'.repeat(100) })).rejects.toBeInstanceOf(
      ErrorePermesso,
    );
    await expect(t.aggiungi(p.azioni, { uid: 'uid-2', azione: '{}', zavorra: 'x' })).rejects.toBeInstanceOf(ErrorePermesso);
    await expect(t.scrivi('stanze/ZZZZ/presenza/uid-2/k1', true)).rejects.toBeInstanceOf(ErrorePermesso);
    await expect(t.scrivi('stanze/QQQQ/meta', { host: 'uid-2', creata: 1 })).rejects.toBeInstanceOf(ErrorePermesso);
  });

  it('due dispositivi con lo stesso gettone: il posto resta al rientro più recente', async () => {
    const tv = await tavolata(2);
    tv.host.inizia(5);
    await scorri(1000);
    const isc: Iscrizione = { codice: tv.codice, ruolo: 'ospite', idGiocatore: 'g2', nome: 'Bea', pecora: 'brontolana', gettone: 'gettone-2' };
    const nuovo = await SessioneOspite.rientra(tv.rete.dispositivo('uid-2-nuovo'), isc);
    await scorri(1000);
    expect(nuovo.io).toBe('g2');
    // Un altro aggiornamento degli ingressi (il vecchio ingresso di Bea è ancora lì) non le toglie il posto.
    await SessioneOspite.entra(tv.rete.dispositivo('uid-x'), tv.codice, { nome: 'Zoe', pecora: 'nerina', gettone: 'z' });
    await scorri();
    expect(nuovo.io).toBe('g2');
    expect(tv.ospiti[0]!.io).toBeNull();
  });

  it("se l'host perde la rete i timer si fermano; al ritorno la finestra riparte con il tempo pieno", async () => {
    const tv = await tavolata(2);
    tv.host.inizia(1);
    await scorri();
    const host = await conStato(tv, statoAlDado());
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri();
    tv.rete.impostaConnessione('uid-host', false);
    await scorri(20_000);
    expect(host.vista(null).finestra).not.toBeNull();
    expect(host.online()).toBe(false);
    tv.rete.impostaConnessione('uid-host', true);
    await scorri(host.pubblico().impostazioni.finestraSecondi * 1000 - 500);
    expect(host.vista(null).finestra).not.toBeNull();
    await scorri(1000);
    expect(host.vista(null).finestra).toBeNull();
  });
});

describe('Pulizia delle stanze inattive (brief §6)', () => {
  it('chi crea una stanza cancella quelle ferme da più di 24 ore', async () => {
    const tv = await tavolata(1);
    const vecchio = tv.codice;
    tv.host.chiudi();
    vi.advanceTimersByTime(25 * 3600 * 1000);
    const nuovo = await SessioneHost.crea(tv.rete.dispositivo('uid-nuovo'), archivioInMemoria(), {
      nome: 'Ugo',
      pecora: 'nerina',
      gettone: 'x',
    });
    expect(nuovo.codice).not.toBe(vecchio);
    expect(tv.rete.dati.stanze?.[vecchio as keyof typeof tv.rete.dati.stanze]).toBeUndefined();
  });
});

// Coerenza delle viste pubblicate durante il gioco automatico dei tempi.
describe('Tempi', () => {
  it('le fasi automatiche proseguono da sole dopo la pausa prevista', async () => {
    const tv = await tavolata(1);
    tv.host.inizia(2);
    await scorri();
    expect(tv.host.vista(null).fase.nome).toBe('guaio');
    expect(tv.host.pubblico().prosegueAlle).not.toBeNull();
    await scorri((TEMPI.prosegui.guaio ?? 0) + 50);
    expect(tv.host.vista(null).fase.nome).toBe('scelta');
  });
});

// La scena dei telefoni recita ogni mossa: chi ospita aspetta la durata normale (iniettata, qui finta) prima di
// chiudere la finestra, far proseguire le fasi automatiche o far muovere i bot.
describe('Durata delle animazioni (opzione durataRecita)', () => {
  const RECITA = 3000;
  /** Finta durataRecita: 3 secondi per ogni mossa che produce eventi. */
  const tremila: OpzioniHost = { durataRecita: (eventi: Evento[]) => (eventi.length > 0 ? RECITA : 0) };

  /** Tavolata con il dado di Ada pronto da tirare, host con l'opzione. */
  async function alDado(opzioni: OpzioniHost = tremila) {
    const tv = await tavolata(2, opzioni);
    tv.host.inizia(1);
    await scorri();
    const host = await conStato(tv, statoAlDado(), opzioni);
    return { tv, host, finestraMs: host.pubblico().impostazioni.finestraSecondi * 1000 };
  }

  it('la finestra si apre con scadenza = ora + recita + secondi della finestra, e si chiude non prima', async () => {
    const { host, finestraMs } = await alDado();
    const ora = host.ora();
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    expect(host.pubblico().scadenza).toBe(ora + RECITA + finestraMs);
    await scorri(RECITA + finestraMs - 100);
    expect(host.vista(null).finestra).not.toBeNull();
    await scorri(200);
    expect(host.vista(null).finestra).toBeNull();
  });

  it('senza opzione la scadenza è quella di oggi: ora + secondi della finestra', async () => {
    const { host, finestraMs } = await alDado({});
    const ora = host.ora();
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    expect(host.pubblico().scadenza).toBe(ora + finestraMs);
  });

  it('una durataRecita che si rompe conta 0: la partita va avanti, si pubblica e la scadenza è quella di oggi', async () => {
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {});
    const rotta: OpzioniHost = {
      durataRecita: () => {
        throw new Error('durata rotta');
      },
    };
    const { tv, host, finestraMs } = await alDado(rotta);
    const ora = host.ora();
    expect(() => host.invia({ tipo: 'lanciaDado', giocatore: 'g1' })).not.toThrow();
    // Una riga in console per sessione di chi ospita, non una a ogni mossa
    const righe = errori.mock.calls.length;
    expect(righe).toBeGreaterThan(0);
    expect(host.vista(null).fase.nome).toBe('risoluzione_dado');
    expect(host.pubblico().scadenza).toBe(ora + finestraMs);
    await scorri();
    // Pubblicata: gli ospiti vedono il dado lanciato e la stessa scadenza
    const bea = tv.ospiti[0] as SessioneOspite;
    expect(bea.vista(null).fase.nome).toBe('risoluzione_dado');
    expect(bea.pubblico()?.scadenza).toBe(ora + finestraMs);
    // La finestra si chiude da sola alla scadenza di oggi
    await scorri(finestraMs + 100);
    expect(host.vista(null).finestra).toBeNull();
    expect(errori).toHaveBeenCalledTimes(righe);
    errori.mockRestore();
  });

  it('una mossa che non fa recitare niente (durata 0) non sposta la scadenza', async () => {
    const { host, finestraMs } = await alDado({ durataRecita: () => 0 });
    const ora = host.ora();
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    expect(host.pubblico().scadenza).toBe(ora + finestraMs);
  });

  it('una mossa nella stessa finestra non cambia la scadenza; un Beee-NO! apre una finestra nuova col suo conto', async () => {
    const { tv, host, finestraMs } = await alDado();
    const ora = host.ora();
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    const scadenza = host.pubblico().scadenza;
    await scorri(1000);
    const [bea, cleo] = tv.ospiti as [SessioneOspite, SessioneOspite];
    cleo.invia(cleo.azioni('g3').find((a) => a.tipo === 'passa')!);
    await scorri(500);
    expect(host.pubblico().scadenza).toBe(scadenza);
    bea.invia(bea.azioni('g2').find((a) => a.tipo === 'giocaBelato')!);
    await scorri();
    expect(host.ora()).toBe(ora + 1500);
    // La recita del Beee-NO! si mette in coda dopo quella del dado, ancora in corso: fine a ora + 2 * RECITA.
    expect(host.pubblico().scadenza).toBe(ora + 2 * RECITA + finestraMs);
  });

  it('la scadenza non dipende dagli ospiti: stessa sequenza di azioni, stessa scadenza (relativa)', async () => {
    const relative: number[] = [];
    for (const conPassa of [false, true]) {
      const { tv, host } = await alDado();
      const ora = host.ora();
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
      await scorri(800);
      if (conPassa) {
        // Un ospite che passa non sposta la scadenza di chi ospita.
        const cleo = tv.ospiti[1]!;
        cleo.invia(cleo.azioni('g3').find((a) => a.tipo === 'passa')!);
        await scorri(300);
      }
      relative.push(host.pubblico().scadenza! - ora);
    }
    expect(relative[0]).toBe(relative[1]);
  });

  it('una fase automatica avanza dopo la recita + la pausa di oggi', async () => {
    const tv = await tavolata(1, tremila);
    const ora = tv.host.ora();
    tv.host.inizia(2);
    expect(tv.host.vista(null).fase.nome).toBe('guaio');
    const pausa = TEMPI.prosegui.guaio ?? 0;
    expect(tv.host.pubblico().prosegueAlle).toBe(ora + RECITA + pausa);
    await scorri(RECITA + pausa - 50);
    expect(tv.host.vista(null).fase.nome).toBe('guaio');
    await scorri(100);
    expect(tv.host.vista(null).fase.nome).toBe('scelta');
  });

  it('senza opzione la fase automatica avanza come oggi, dopo la sola pausa', async () => {
    const tv = await tavolata(1);
    const ora = tv.host.ora();
    tv.host.inizia(2);
    expect(tv.host.pubblico().prosegueAlle).toBe(ora + (TEMPI.prosegui.guaio ?? 0));
  });

  it('un bot muove non prima della fine della recita normale', async () => {
    const { tv, host } = await alDado();
    tv.ospiti[1]!.chiudi();
    await scorri();
    host.sostituisciConBot('g3');
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri(RECITA - 100);
    expect(host.vista(null).finestra?.inAttesa).toContain('g3');
    await scorri(200);
    expect(host.vista(null).finestra?.inAttesa).not.toContain('g3');
  });

  it('un bot non muove prima del suo ritardo di oggi, anche se la recita è più corta', async () => {
    const { tv, host } = await alDado({ durataRecita: (e: Evento[]) => (e.length > 0 ? 500 : 0) });
    tv.ospiti[1]!.chiudi();
    await scorri();
    host.sostituisciConBot('g3');
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri(TEMPI.bot - 100);
    expect(host.vista(null).finestra?.inAttesa).toContain('g3');
    await scorri(200);
    expect(host.vista(null).finestra?.inAttesa).not.toContain('g3');
  });

  it('i bot delle stanze giocano con la politica "normale" (D47)', async () => {
    const scegli = vi.spyOn(normale, 'scegli');
    const { tv, host } = await alDado({});
    tv.ospiti[1]!.chiudi();
    await scorri();
    host.sostituisciConBot('g3');
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri(TEMPI.bot + 100);
    expect(scegli.mock.calls.some(([, id]) => id === 'g3')).toBe(true);
    scegli.mockRestore();
  });

  it('se la strategia del bot si rompe, chi ospita lo annota e ripiega su una mossa possibile: la stanza non si ferma', async () => {
    const scegli = vi.spyOn(normale, 'scegli').mockImplementation(() => {
      throw new Error('strategia rotta');
    });
    const errori = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { tv, host } = await alDado({});
    tv.ospiti[1]!.chiudi();
    await scorri();
    host.sostituisciConBot('g3');
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri(TEMPI.bot + 100);
    expect(host.vista(null).finestra?.inAttesa).not.toContain('g3');
    expect(errori).toHaveBeenCalled();
    scegli.mockRestore();
    errori.mockRestore();
  });

  it('senza opzione il bot muove dopo il suo ritardo di oggi', async () => {
    const { tv, host } = await alDado({});
    tv.ospiti[1]!.chiudi();
    await scorri();
    host.sostituisciConBot('g3');
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri(TEMPI.bot + 100);
    expect(host.vista(null).finestra?.inAttesa).not.toContain('g3');
  });

  it('giocatore in pausa: la finestra non scade; quando riparte lo fa a tempo pieno, senza la recita già finita', async () => {
    const { tv, host, finestraMs } = await alDado();
    tv.ospiti[1]!.chiudi();
    await scorri();
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    expect(host.pubblico().pausa).toEqual(['g3']);
    expect(host.pubblico().scadenza).toBeNull();
    await scorri(RECITA + finestraMs + 5000);
    expect(host.vista(null).finestra).not.toBeNull();
    host.sostituisciConBot('g3');
    expect(host.pubblico().scadenza).toBe(host.ora() + finestraMs);
  });

  it('una fase automatica che riparte dopo una pausa conta solo la pausa di oggi', async () => {
    const tv = await tavolata(1, tremila);
    tv.host.inizia(2);
    tv.ospiti[0]!.chiudi();
    await scorri(RECITA + 1000);
    expect(tv.host.vista(null).fase.nome).toBe('guaio');
    tv.host.sostituisciConBot('g2');
    expect(tv.host.pubblico().prosegueAlle).toBe(tv.host.ora() + (TEMPI.prosegui.guaio ?? 0));
  });

  it('host scollegato: nessun timer; al ritorno la finestra riparte a tempo pieno, senza la recita', async () => {
    const { tv, host, finestraMs } = await alDado();
    host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
    await scorri();
    tv.rete.impostaConnessione('uid-host', false);
    await scorri(RECITA + finestraMs + 5000);
    expect(host.vista(null).finestra).not.toBeNull();
    tv.rete.impostaConnessione('uid-host', true);
    await scorri();
    expect(host.pubblico().scadenza).toBe(host.ora() + finestraMs);
    await scorri(finestraMs - 500);
    expect(host.vista(null).finestra).not.toBeNull();
    await scorri(1000);
    expect(host.vista(null).finestra).toBeNull();
  });

  // Le recite si mettono in coda come quelle del regista: una mossa corta non anticipa la fine di una lunga ancora in corso.
  describe('recite in coda', () => {
    /** Durata finta guidata dal test: ogni mossa con eventi prende il valore successivo (0 se la coda è vuota). */
    function conCoda() {
      const coda: number[] = [];
      const opzioni: OpzioniHost = { durataRecita: (eventi: Evento[]) => (eventi.length > 0 ? (coda.shift() ?? 0) : 0) };
      return { coda, opzioni };
    }

    it('una mossa senza recita non anticipa la fine di quella lunga: il bot aspetta comunque', async () => {
      const { coda, opzioni } = conCoda();
      const { tv, host } = await alDado(opzioni);
      tv.ospiti[1]!.chiudi();
      await scorri();
      host.sostituisciConBot('g3');
      coda.push(3000);
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' }); // A: t, 3000
      await scorri(1000);
      const bea = tv.ospiti[0]!;
      coda.push(0);
      bea.invia(bea.azioni('g2').find((a) => a.tipo === 'giocaBelato')!); // B: t + 1000, 0
      await scorri(1900); // t + 2900
      expect(host.vista(null).finestra?.inAttesa).toContain('g3');
      await scorri(200); // t + 3100
      expect(host.vista(null).finestra?.inAttesa).not.toContain('g3');
    });

    it('una fase automatica non parte prima della fine della recita lunga + la pausa', async () => {
      const { coda, opzioni } = conCoda();
      const tv = await tavolata(1, opzioni);
      tv.host.inizia(2);
      await scorri(10_000);
      expect(tv.host.vista(null).fase.nome).toBe('scelta');
      const bea = tv.ospiti[0]!;
      const ora = tv.host.ora();
      coda.push(3000);
      tv.host.invia(tv.host.azioni('g1').find((a) => a.tipo === 'scegliTrovata')!); // A: t, 3000
      await scorri(1000);
      coda.push(0);
      bea.invia(bea.azioni('g2').find((a) => a.tipo === 'scegliTrovata')!); // B: t + 1000, 0 -> rivelazione
      await scorri();
      expect(tv.host.vista(null).fase.nome).toBe('rivelazione');
      expect(tv.host.pubblico().prosegueAlle).toBe(ora + 3000 + (TEMPI.prosegui.rivelazione ?? 0));
    });

    it('due recite in coda si sommano: la finestra aperta dalla seconda scade dopo la fine di entrambe', async () => {
      const { coda, opzioni } = conCoda();
      const { tv, host, finestraMs } = await alDado(opzioni);
      const ora = host.ora();
      coda.push(3000);
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' }); // A: t, 3000
      await scorri(1000);
      const bea = tv.ospiti[0]!;
      coda.push(2000);
      bea.invia(bea.azioni('g2').find((a) => a.tipo === 'giocaBelato')!); // B: t + 1000, 2000 -> fine a t + 5000
      await scorri();
      expect(host.pubblico().scadenza).toBe(ora + 5000 + finestraMs);
    });
  });

  it('riprendendo una stanza le mosse già recitate non fanno aspettare di nuovo', async () => {
    const tv = await tavolata(1, tremila);
    tv.host.inizia(2);
    await scorri(100);
    tv.host.chiudi();
    const host = (await SessioneHost.riprendi(tv.rete.dispositivo('uid-host'), tv.salvataggioHost, tremila))!;
    await scorri();
    expect(host.pubblico().prosegueAlle).toBe(host.ora() + (TEMPI.prosegui.guaio ?? 0));
  });

  describe('durata data dopo (si scarica con la scena)', () => {
    it("vale dalle mosse nuove: quelle già fatte non fanno aspettare, la prossima sì", async () => {
      const { host, finestraMs } = await alDado({});
      // Arriva a partita già avviata: un secondo per evento, così si vede quali eventi conta
      const durata = vi.fn((eventi: Evento[]) => eventi.length * 1000);
      host.impostaDurataRecita(durata);
      await scorri();
      const primaSeq = host.vista(null).eventi.reduce((m, e) => Math.max(m, e.seq), -1);
      const ora = host.ora();
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
      const nuovi = host.vista(null).eventi.filter((e) => e.seq > primaSeq);
      expect(nuovi.length).toBeGreaterThan(0);
      // Solo gli eventi del lancio: niente della storia di prima
      expect(durata).toHaveBeenCalledTimes(1);
      expect(durata.mock.calls[0]![0]).toEqual(nuovi);
      expect(host.pubblico().scadenza).toBe(ora + nuovi.length * 1000 + finestraMs);
    });

    it('in sala d\'attesa: la partita che parte dopo la usa dalla prima mossa', async () => {
      const tv = await tavolata(1);
      tv.host.impostaDurataRecita(() => 3000);
      const ora = tv.host.ora();
      tv.host.inizia(2);
      await scorri();
      expect(tv.host.pubblico().prosegueAlle).toBe(ora + 3000 + (TEMPI.prosegui.guaio ?? 0));
    });
  });

  /** La stessa persona (Bea, g2) apre una seconda scheda e la richiude: due aggiornamenti di presenza, nessuna pausa. */
  async function presenzaSecondaScheda(tv: Tavolata): Promise<void> {
    const seconda = await SessioneOspite.rientra(tv.rete.dispositivo('uid-2'), {
      codice: tv.codice,
      ruolo: 'ospite',
      idGiocatore: 'g2',
      nome: 'Bea',
      pecora: 'brontolana',
      gettone: 'gettone-2',
    });
    await scorri();
    seconda.chiudi();
    await scorri();
  }

  describe('aggiornamenti di presenza a metà recita', () => {
    it('non spostano la scadenza della finestra, che si chiude quando doveva', async () => {
      const { tv, host, finestraMs } = await alDado();
      const ora = host.ora();
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
      const scadenza = ora + RECITA + finestraMs;
      expect(host.pubblico().scadenza).toBe(scadenza);
      await scorri(1000);
      const versione = host.pubblico().versione;
      await presenzaSecondaScheda(tv);
      // L'aggiornamento è arrivato (l'host ha ripubblicato) ma non ha toccato i tempi
      expect(host.pubblico().versione).toBeGreaterThan(versione);
      expect(host.pubblico().pausa).toEqual([]);
      expect(host.pubblico().scadenza).toBe(scadenza);
      await scorri(scadenza - host.ora() - 100);
      expect(host.vista(null).finestra).not.toBeNull();
      await scorri(200);
      expect(host.vista(null).finestra).toBeNull();
    });

    it('non spostano il momento in cui proseguono le fasi automatiche', async () => {
      const tv = await tavolata(2, tremila);
      const ora = tv.host.ora();
      tv.host.inizia(2);
      await scorri(500);
      const proseguiAlle = ora + RECITA + (TEMPI.prosegui.guaio ?? 0);
      expect(tv.host.pubblico().prosegueAlle).toBe(proseguiAlle);
      const versione = tv.host.pubblico().versione;
      await presenzaSecondaScheda(tv);
      expect(tv.host.pubblico().versione).toBeGreaterThan(versione);
      expect(tv.host.pubblico().prosegueAlle).toBe(proseguiAlle);
      // La fase non parte prima del previsto...
      await scorri(proseguiAlle - tv.host.ora() - 100);
      expect(tv.host.vista(null).fase.nome).toBe('guaio');
      // ...e parte appena passato
      await scorri(200);
      expect(tv.host.vista(null).fase.nome).not.toBe('guaio');
    });
  });

  describe('aggiornamenti di presenza dopo la fine della recita', () => {
    it('non spostano il momento in cui proseguono le fasi automatiche', async () => {
      const tv = await tavolata(2, tremila);
      const ora = tv.host.ora();
      tv.host.inizia(2);
      const proseguiAlle = ora + RECITA + (TEMPI.prosegui.guaio ?? 0);
      await scorri(RECITA + 200);
      expect(tv.host.vista(null).fase.nome).toBe('guaio');
      await presenzaSecondaScheda(tv);
      expect(tv.host.pubblico().prosegueAlle).toBe(proseguiAlle);
      await scorri(proseguiAlle - tv.host.ora() - 100);
      expect(tv.host.vista(null).fase.nome).toBe('guaio');
      await scorri(200);
      expect(tv.host.vista(null).fase.nome).not.toBe('guaio');
    });

    it('non fanno aspettare di più un bot', async () => {
      const { tv, host } = await alDado({ durataRecita: (e: Evento[]) => (e.length > 0 ? 500 : 0) });
      tv.ospiti[1]!.chiudi();
      await scorri();
      host.sostituisciConBot('g3');
      const ora = host.ora();
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
      await scorri(700);
      await presenzaSecondaScheda(tv);
      expect(host.vista(null).finestra?.inAttesa).toContain('g3');
      await scorri(ora + TEMPI.bot + 100 - host.ora());
      expect(host.vista(null).finestra?.inAttesa).not.toContain('g3');
    });
  });

  describe("rigioca (si torna in sala d'attesa)", () => {
    /** Il dado di g1 (Ada) dà il pascolo che riempie il suo Ovile: alla scadenza della finestra la partita finisce. */
    function statoAllaFine(): Stato {
      const s = statoAlDado();
      const posti = s.config.postiOvile;
      const g1 = s.giocatori[0]!;
      return {
        ...s,
        giocatori: s.giocatori.map((g) => (g.id === 'g1' ? { ...g, agnellini: posti - 1 } : g)),
        gregge: s.gregge + g1.agnellini - (posti - 1),
      };
    }

    it('la nuova partita riparte con la coda delle recite vuota: aspetta solo la propria recita', async () => {
      const coda: number[] = [];
      const opzioni: OpzioniHost = { durataRecita: (eventi: Evento[]) => (eventi.length > 0 ? (coda.shift() ?? 0) : 0) };
      const tv = await tavolata(2, opzioni);
      tv.host.inizia(1);
      await scorri();
      const host = await conStato(tv, statoAllaFine(), opzioni);
      const finestraMs = host.pubblico().impostazioni.finestraSecondi * 1000;
      // Il lancio e il finale mettono in coda recite lunghissime
      coda.push(100_000, 100_000);
      host.invia({ tipo: 'lanciaDado', giocatore: 'g1' });
      await scorri(100_000 + finestraMs + 1000);
      expect(host.vista(null).esito).not.toBeNull();
      // Si torna in sala e se ne riparte subito con un'altra partita: la coda di prima non conta più
      host.tornaInSala();
      expect(host.pubblico().fase).toBe('attesa');
      coda.push(3000);
      const ora = host.ora();
      host.inizia(2);
      await scorri();
      expect(host.pubblico().prosegueAlle).toBe(ora + 3000 + (TEMPI.prosegui.guaio ?? 0));
    });
  });
});

// Usati solo per i tipi.
void applica;
void vistaPer;
