// Partite a più dispositivi con il database in memoria: sala d'attesa, riservatezza, partita completa,
// Beee-NO! di un ospite sul dado, ricarica e rientro, pausa e bot, host che si scollega, timer, pulizia.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applica, vistaPer } from '../engine/src';
import type { Azione, IdGiocatore, Stato } from '../engine/src';
import { avanza, chiudiPunteggio, conFaccia, prosegui, scegli, scenario } from '../engine/test/aiuti';
import { SessioneHost, TEMPI } from './host';
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
async function tavolata(nOspiti = 2): Promise<Tavolata> {
  const rete = new ArchivioMemoria();
  const salvataggioHost = archivioInMemoria();
  const host = await SessioneHost.crea(rete.dispositivo('uid-host'), salvataggioHost, {
    nome: 'Ada',
    pecora: 'ricciolo',
    gettone: 'gettone-host',
  });
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
async function conStato(tv: Tavolata, stato: Stato): Promise<SessioneHost> {
  tv.host.chiudi();
  const dati = JSON.parse(tv.salvataggioHost.leggi()!);
  tv.salvataggioHost.scrivi(JSON.stringify({ ...dati, stato }));
  const host = await SessioneHost.riprendi(tv.rete.dispositivo('uid-host'), tv.salvataggioHost);
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

// Usati solo per i tipi.
void applica;
void vistaPer;
