// Sessione dell'host: il suo browser è l'unica fonte di verità (brief §6). Convalida con il motore le azioni
// degli ospiti, pubblica una vista per ogni giocatore, gestisce timer, pause, bot e rientri.
import { azioniPossibili, inAttesaDi, nuovaPartita, SETUP, tentaApplica, vistaPer } from '../engine/src';
import type { Azione, Evento, IdGiocatore, IdPecora, NomeFase, Stato, Vista } from '../engine/src';
import { normale } from '../engine/sim/politiche';
import { esitoTestataCasuale } from '../engine/sim/simulatore';
import { aggiornaSalvato } from './locale';
import type { Archivio } from './locale';
import type { EsitoInvio, Sessione } from './sessione';
import {
  codiceCasuale,
  comeTesto,
  daTesto,
  MASSIMO_GIOCATORI,
  nuovoGettone,
  ORE_INATTIVITA,
  percorsi,
  presentiDa,
  vistaDaPubblicare,
} from './stanza';
import type { AzioneInviata, Impostazioni, Ingresso, Iscrizione, Meta, Pubblico, VistaPrivata } from './stanza';
import { oraServizio } from './trasporto';
import type { Smetti, Trasporto } from './trasporto';

const VERSIONE_SALVATAGGIO = 1;
const ID_HOST: IdGiocatore = 'g1';
const NOME_MASSIMO = 16;

/** Pause delle fasi automatiche, in millisecondi: il tempo per guardare prima di proseguire. */
export const TEMPI = {
  prosegui: {
    guaio: 2500,
    rivelazione: 4000,
    guaio_al_peggiore: 3000,
    fine_round: 1500,
    ultimo_round: 3500,
  } as Partial<Record<NomeFase, number>>,
  bot: 1100,
};

/** Cose che chi ospita riceve da fuori (`sync/` non importa dal client). */
export interface OpzioniHost {
  /**
   * Durata normale, in ms, della recita sulla scena dei telefoni degli eventi NUOVI di una mossa (`vista` è quella del tavolo).
   * Finestre, fasi automatiche e bot aspettano la fine della recita. Senza, 0: il comportamento di prima.
   */
  durataRecita?: (eventi: Evento[], vista: Vista) => number;
}

export interface GiocatoreHost {
  id: IdGiocatore;
  uid: string | null;
  nome: string;
  pecora: IdPecora;
  gettone: string;
  bot: boolean;
  /** Ora dell'ingresso che ha preso il posto per ultimo. */
  quandoIngresso?: number;
}

interface Salvataggio {
  versione: number;
  codice: string;
  giocatori: GiocatoreHost[];
  impostazioni: Impostazioni;
  stato: Stato | null;
  /** Gettoni di chi l'host ha tolto dalla sala d'attesa: non rientrano. */
  esclusi?: string[];
}

const PECORE = SETUP.pecore.map((p) => p.id);
const ultimoSeq = (eventi: Evento[]): number => eventi.reduce((massimo, e) => Math.max(massimo, e.seq), -1);
const pulisciNome = (n: unknown): string => (typeof n === 'string' ? n.trim().slice(0, NOME_MASSIMO) : '');
const pecoraValida = (p: unknown): p is IdPecora => typeof p === 'string' && (PECORE as string[]).includes(p);

export class SessioneHost implements Sessione {
  readonly modo = 'realtime' as const;
  readonly idGiocatore = ID_HOST;
  private stato: Stato | null;
  private giocatori: GiocatoreHost[];
  private impostazioni: Impostazioni;
  private presenti = new Set<string>();
  private ascoltatori = new Set<() => void>();
  private smetti: Smetti[] = [];
  private timerSistema: ReturnType<typeof setTimeout> | null = null;
  private timerBot: ReturnType<typeof setTimeout> | null = null;
  private chiaveFinestra: string | null = null;
  private scadenza: number | null = null;
  private prosegueAlle: number | null = null;
  /**
   * Lo stato per cui sono stati fissati l'avanzamento automatico e la mossa del bot: finché la partita non cambia,
   * un aggiornamento qualsiasi (presenze, ingressi) non li fa ripartire da capo.
   */
  private statoProsegui: Stato | null = null;
  private botFissato: { stato: Stato; id: IdGiocatore; alle: number } | null = null;
  private versione = 0;
  private pubblicati = new Map<string, string>();
  private ultimaAttivita = 0;
  private codaPubblicazioni: Promise<void> = Promise.resolve();
  private chiusa = false;
  /** Rifiuti già comunicati, per non riscriverli a ogni aggiornamento degli ingressi. */
  private rifiutati = new Set<string>();
  private esclusi: Set<string>;
  /** Collegato al servizio? Scollegato, l'host sospende i timer: le risposte degli ospiti potrebbero essere in viaggio. */
  private connesso = true;
  /** Identità di questa scheda: se un'altra scheda riprende la stanza, questa si ferma (niente due host). */
  private readonly idSessione = nuovoGettone();
  private sessioneConfermata = false;
  private sostituitaDaAltra = false;
  /** Ultimo evento già considerato per la durata della recita (-1: nessuno). Gli eventi più nuovi sono "della mossa". */
  private ultimoSeqPianificato = -1;
  /** Quando la scena dei telefoni ha finito di recitare tutte le mosse viste finora (ora del servizio; 0: niente in coda). */
  private fineRecita = 0;
  /** `durataRecita` ha già lanciato un errore (lo si scrive in console una volta sola). */
  private durataRotta = false;

  private constructor(
    private readonly t: Trasporto,
    private readonly archivio: Archivio,
    readonly codice: string,
    dati: { giocatori: GiocatoreHost[]; impostazioni: Impostazioni; stato: Stato | null; esclusi?: string[] },
    private opzioni: OpzioniHost = {},
  ) {
    this.giocatori = dati.giocatori;
    this.impostazioni = dati.impostazioni;
    this.stato = dati.stato;
    this.esclusi = new Set(dati.esclusi ?? []);
    // Riprendendo una partita, ciò che c'è già non va recitato (né aspettato) di nuovo.
    this.ultimoSeqPianificato = dati.stato ? ultimoSeq(dati.stato.eventi) : -1;
  }

  /** Crea una stanza nuova con un codice libero e ci entra come primo giocatore. */
  static async crea(
    t: Trasporto,
    archivio: Archivio,
    io: { nome: string; pecora: IdPecora; gettone: string },
    casuale: () => number = Math.random,
    opzioni?: OpzioniHost,
  ): Promise<SessioneHost> {
    // La pulizia delle stanze vecchie non deve rallentare la creazione: parte e prosegue da sola.
    void SessioneHost.cancellaStanzeInattive(t);
    let codice = '';
    for (let tentativo = 0; tentativo < 20 && !codice; tentativo++) {
      const c = codiceCasuale(casuale);
      if ((await t.leggi(percorsi(c).meta)) === null) codice = c;
    }
    if (!codice) throw new Error('Nessun codice stanza libero');
    const p = percorsi(codice);
    await t.aggiorna({ [p.meta]: { host: t.uid, creata: oraServizio(t) }, [p.attivita]: oraServizio(t) });
    const s = new SessioneHost(t, archivio, codice, {
      giocatori: [
        { id: ID_HOST, uid: t.uid, nome: pulisciNome(io.nome) || 'Host', pecora: io.pecora, gettone: io.gettone, bot: false, quandoIngresso: 0 },
      ],
      impostazioni: { finestraSecondi: SETUP.finestraReazioneSecondi },
      stato: null,
    }, opzioni);
    s.avvia();
    return s;
  }

  /** Riprende la stanza salvata in questo browser, se l'host è ancora questo dispositivo. */
  static async riprendi(t: Trasporto, archivio: Archivio, opzioni?: OpzioniHost): Promise<SessioneHost | null> {
    const testo = archivio.leggi();
    if (!testo) return null;
    let dati: Salvataggio;
    try {
      dati = JSON.parse(testo) as Salvataggio;
    } catch {
      return null;
    }
    if (dati.versione !== VERSIONE_SALVATAGGIO) return null;
    const meta = (await t.leggi(percorsi(dati.codice).meta)) as { host?: string } | null;
    if (!meta || meta.host !== t.uid) return null;
    const s = new SessioneHost(t, archivio, dati.codice, { ...dati, stato: dati.stato && aggiornaSalvato(dati.stato) }, opzioni);
    s.avvia();
    return s;
  }

  /** Le stanze ferme da più di 24 ore si cancellano (brief §6), senza servizi a pagamento: lo fa chi crea una stanza. */
  static async cancellaStanzeInattive(t: Trasporto): Promise<void> {
    try {
      const vecchie = await t.chiaviSotto('attivita', oraServizio(t) - ORE_INATTIVITA * 3600 * 1000);
      // Cancellazioni indipendenti: un errore su una stanza non ferma le altre.
      await Promise.allSettled(vecchie.map((c) => t.aggiorna({ [percorsi(c).stanza]: null, [percorsi(c).attivita]: null })));
    } catch {
      // La pulizia è facoltativa: non deve impedire di creare la stanza.
    }
  }

  // ─── Sessione ──────────────────────────────────────────────────────────────

  vista(per: IdGiocatore | null): Vista {
    if (!this.stato) throw new Error('La partita non è ancora iniziata');
    return vistaPer(this.stato, per);
  }

  azioni(per: IdGiocatore | 'sistema'): Azione[] {
    return this.stato ? azioniPossibili(this.stato, per) : [];
  }

  /** Azioni dell'interfaccia dell'host: le sue mosse e il "Continua" delle fasi automatiche. */
  invia(azione: Azione): EsitoInvio {
    if (this.chiusa) return { ok: false, codice: 'fase_errata', messaggio: 'Questa scheda non comanda più la stanza' };
    if (!this.stato) return { ok: false, codice: 'fase_errata', messaggio: 'La partita non è iniziata' };
    if (azione.tipo === 'scadenza') return { ok: false, codice: 'non_tocca_a_te', messaggio: 'Le finestre le chiude il timer' };
    if (azione.tipo !== 'prosegui' && azione.giocatore !== ID_HOST) {
      return { ok: false, codice: 'non_tocca_a_te', messaggio: 'Puoi giocare solo per te' };
    }
    return this.applica(azione);
  }

  ascolta(cb: () => void): Smetti {
    this.ascoltatori.add(cb);
    return () => this.ascoltatori.delete(cb);
  }

  /** Ora del servizio realtime, uguale su tutti i dispositivi (per i conti alla rovescia). */
  ora(): number {
    return oraServizio(this.t);
  }

  /** Collegato al servizio realtime? */
  online(): boolean {
    return this.connesso;
  }

  /**
   * La durata delle recite arrivata dopo la creazione (nel client si scarica a parte, con la scena): vale dalle mosse
   * nuove; quelle già fatte non fanno aspettare.
   */
  impostaDurataRecita(durataRecita: OpzioniHost['durataRecita']): void {
    this.opzioni = { ...this.opzioni, durataRecita };
    this.ultimoSeqPianificato = this.stato ? ultimoSeq(this.stato.eventi) : -1;
  }

  /** La stanza è stata ripresa da un'altra scheda (o cancellata): questa sessione si è fermata. */
  sostituita(): boolean {
    return this.sostituitaDaAltra;
  }

  /** Dati per rientrare come host da questo browser. */
  iscrizione(): Iscrizione {
    const io = this.giocatori[0]!;
    return { codice: this.codice, ruolo: 'host', idGiocatore: ID_HOST, nome: io.nome, pecora: io.pecora, gettone: io.gettone };
  }

  // ─── Sala d'attesa ─────────────────────────────────────────────────────────

  pubblico(): Pubblico {
    return {
      versione: this.versione,
      fase: this.stato ? 'partita' : 'attesa',
      host: ID_HOST,
      giocatori: this.giocatori.map((g) => ({
        id: g.id,
        nome: g.nome,
        pecora: g.pecora,
        bot: g.bot,
        online: g.id === ID_HOST || (g.uid !== null && this.presenti.has(g.uid)),
      })),
      impostazioni: { ...this.impostazioni },
      tavolo: this.stato ? vistaDaPubblicare(vistaPer(this.stato, null)) : null,
      scadenza: this.scadenza,
      prosegueAlle: this.prosegueAlle,
      pausa: this.inPausa(),
    };
  }

  impostaFinestra(secondi: number): void {
    if (!Number.isFinite(secondi) || secondi < 2 || secondi > 30) return;
    this.impostazioni = { finestraSecondi: Math.round(secondi) };
    this.cambiato();
  }

  /** L'host cambia nome o pecora in sala d'attesa. */
  aggiornaHost(nome: string, pecora: IdPecora): void {
    if (this.stato) return;
    const io = this.giocatori[0]!;
    if (pulisciNome(nome)) io.nome = pulisciNome(nome);
    if (pecoraValida(pecora) && !this.giocatori.some((g) => g.id !== ID_HOST && g.pecora === pecora)) io.pecora = pecora;
    this.cambiato();
  }

  puoIniziare(): boolean {
    return !this.stato && this.giocatori.length >= 2 && this.giocatori.length <= MASSIMO_GIOCATORI;
  }

  inizia(seme: number): void {
    if (!this.puoIniziare()) return;
    this.stato = nuovaPartita({
      giocatori: this.giocatori.map((g) => ({ id: g.id, nome: g.nome, pecora: g.pecora })),
      seme,
    });
    this.cambiato();
  }

  /** In sala d'attesa l'host può togliere un giocatore (per esempio chi se n'è andato prima dell'inizio). */
  togliDallaSala(id: IdGiocatore): void {
    const g = this.giocatori.find((x) => x.id === id);
    if (this.stato || !g || id === ID_HOST) return;
    this.esclusi.add(g.gettone);
    this.giocatori = this.giocatori.filter((x) => x.id !== id);
    if (g.uid) this.rifiuta(g.uid, 'L\'host ti ha tolto dalla stanza.');
    this.cambiato();
  }

  /** A partita finita si torna in sala d'attesa con gli stessi giocatori, per la rivincita. */
  tornaInSala(): void {
    if (!this.stato?.esito) return;
    this.stato = null;
    for (const g of this.giocatori) g.bot = false;
    this.cambiato();
  }

  /** Sostituisce un giocatore scollegato con un bot; se il giocatore torna riprende il controllo. */
  sostituisciConBot(id: IdGiocatore): void {
    const g = this.giocatori.find((x) => x.id === id);
    if (!g || id === ID_HOST) return;
    g.bot = true;
    this.cambiato();
  }

  chiudi(): void {
    this.chiusa = true;
    this.fermaTimer();
    for (const s of this.smetti) s();
    this.smetti = [];
  }

  /** La partita è finita: il salvataggio locale non serve più. */
  dimentica(): void {
    this.archivio.cancella();
  }

  // ─── Interno ───────────────────────────────────────────────────────────────

  private avvia(): void {
    const p = percorsi(this.codice);
    // Una sola scheda comanda: questa si annuncia in meta e si ferma se un'altra la sostituisce.
    this.smetti.push(
      this.t.ascolta(p.meta, (v) => {
        const meta = v as Meta | null;
        if (meta?.sessione === this.idSessione) this.sessioneConfermata = true;
        else if (this.sessioneConfermata || meta === null) this.fermatiPerAltraScheda();
      }),
    );
    void this.t.scrivi(p.sessioneHost, this.idSessione).catch(() => undefined);
    this.smetti.push(this.t.presente(p.presenza(this.t.uid)));
    this.smetti.push(
      this.t.ascolta(p.presenze, (v) => {
        this.presenti = presentiDa(v);
        this.presenzeCambiate();
      }),
    );
    this.smetti.push(
      this.t.connessione((online) => {
        if (online === this.connesso) return;
        this.connesso = online;
        if (online) {
          // Si ripubblica tutto e le finestre ripartono con il tempo pieno.
          this.pubblicati.clear();
          this.chiaveFinestra = null;
        }
        this.cambiato();
      }),
    );
    this.smetti.push(this.t.ascolta(p.ingressi, (v) => this.ingressi((v as Record<string, Ingresso>) ?? {})));
    this.smetti.push(this.t.ascoltaFigli(p.azioni, (chiave, v) => this.azioneArrivata(chiave, v)));
    this.cambiato();
  }

  private fermatiPerAltraScheda(): void {
    if (this.chiusa) return;
    this.sostituitaDaAltra = true;
    this.chiudi();
    for (const cb of this.ascoltatori) cb();
  }

  private giocatoreDiUid(uid: string): GiocatoreHost | undefined {
    return this.giocatori.find((g) => g.uid === uid);
  }

  private ingressi(tutti: Record<string, Ingresso>): void {
    let cambiato = false;
    for (const [uid, ing] of Object.entries(tutti)) {
      const nome = pulisciNome(ing?.nome);
      if (!nome || typeof ing.gettone !== 'string' || this.esclusi.has(ing.gettone)) continue;
      const gia = this.giocatoreDiUid(uid);
      if (this.stato) {
        // A partita iniziata si rientra solo nel proprio posto, con il gettone giusto.
        if (gia) continue;
        const posto = ing.rientro ? this.giocatori.find((g) => g.id === ing.rientro) : undefined;
        if (posto && posto.id !== ID_HOST && posto.gettone === ing.gettone) {
          // Se due dispositivi reclamano lo stesso posto vince la richiesta più recente.
          if ((ing.quando ?? 0) > (posto.quandoIngresso ?? 0)) {
            posto.uid = uid;
            posto.bot = false;
            posto.quandoIngresso = ing.quando ?? 0;
            cambiato = true;
          }
        } else {
          this.rifiutaUnaVolta(uid, 'La partita è già iniziata.');
        }
        continue;
      }
      if (gia) {
        if (gia.id === ID_HOST) continue;
        if (gia.nome !== nome) {
          gia.nome = nome;
          cambiato = true;
        }
        if (pecoraValida(ing.pecora) && gia.pecora !== ing.pecora && !this.giocatori.some((g) => g.pecora === ing.pecora)) {
          gia.pecora = ing.pecora;
          cambiato = true;
        }
        continue;
      }
      // Rientro in sala d'attesa con un'identità nuova: stesso posto se il gettone torna.
      const stessoGettone = this.giocatori.find((g) => g.gettone === ing.gettone && g.id !== ID_HOST);
      if (stessoGettone) {
        if ((ing.quando ?? 0) > (stessoGettone.quandoIngresso ?? 0)) {
          stessoGettone.uid = uid;
          stessoGettone.quandoIngresso = ing.quando ?? 0;
          cambiato = true;
        }
        continue;
      }
      if (this.giocatori.length >= MASSIMO_GIOCATORI) {
        this.rifiutaUnaVolta(uid, 'La stanza è piena.');
        continue;
      }
      const libere = PECORE.filter((p) => !this.giocatori.some((g) => g.pecora === p));
      const pecora = pecoraValida(ing.pecora) && libere.includes(ing.pecora) ? ing.pecora : libere[0]!;
      const id = (['g1', 'g2', 'g3', 'g4'] as IdGiocatore[]).find((x) => !this.giocatori.some((g) => g.id === x))!;
      this.giocatori.push({ id, uid, nome, pecora, gettone: ing.gettone, bot: false, quandoIngresso: ing.quando ?? 0 });
      cambiato = true;
    }
    if (cambiato) this.cambiato();
  }

  private azioneArrivata(chiave: string, valore: unknown): void {
    const p = percorsi(this.codice);
    void this.t.scrivi(p.azione(chiave), null).catch(() => undefined);
    const inviata = valore as AzioneInviata | null;
    if (!inviata || typeof inviata.uid !== 'string') return;
    const g = this.giocatoreDiUid(inviata.uid);
    const azione = daTesto<Azione>(inviata.azione);
    if (!g || !azione || typeof azione !== 'object' || !this.stato) return;
    if (azione.tipo === 'prosegui' || azione.tipo === 'scadenza' || azione.giocatore !== g.id) {
      this.rifiuta(inviata.uid, 'Puoi giocare solo per te.');
      return;
    }
    const esito = this.applica(azione);
    if (!esito.ok) this.rifiuta(inviata.uid, esito.messaggio);
  }

  private applica(azione: Azione): EsitoInvio {
    if (!this.stato) return { ok: false, codice: 'fase_errata', messaggio: 'La partita non è iniziata' };
    const r = tentaApplica(this.stato, azione);
    if (!r.ok) return { ok: false, codice: r.errore.codice, messaggio: r.errore.message };
    this.stato = r.stato;
    this.cambiato();
    return { ok: true };
  }

  private rifiuta(uid: string, messaggio: string): void {
    void this.t.scrivi(percorsi(this.codice).rifiuto(uid), { messaggio, quando: oraServizio(this.t) }).catch(() => undefined);
  }

  private rifiutaUnaVolta(uid: string, messaggio: string): void {
    const chiave = `${uid}|${messaggio}`;
    if (this.rifiutati.has(chiave)) return;
    this.rifiutati.add(chiave);
    this.rifiuta(uid, messaggio);
  }

  private presenzeCambiate(): void {
    // Chi torna dopo essere stato sostituito riprende il controllo del suo posto.
    for (const g of this.giocatori) {
      if (g.bot && g.uid && this.presenti.has(g.uid)) g.bot = false;
    }
    this.cambiato();
  }

  /** Giocatori umani scollegati, durante la partita. */
  private inPausa(): IdGiocatore[] {
    if (!this.stato || this.stato.esito) return [];
    return this.giocatori.filter((g) => g.id !== ID_HOST && !g.bot && !(g.uid && this.presenti.has(g.uid))).map((g) => g.id);
  }

  private cambiato(): void {
    if (this.chiusa) return;
    this.salva();
    this.pianifica();
    this.versione += 1;
    this.codaPubblicazioni = this.codaPubblicazioni.then(() => this.pubblica()).catch(() => undefined);
    for (const cb of this.ascoltatori) cb();
  }

  private salva(): void {
    const dati: Salvataggio = {
      versione: VERSIONE_SALVATAGGIO,
      codice: this.codice,
      giocatori: this.giocatori,
      impostazioni: this.impostazioni,
      stato: this.stato,
      esclusi: [...this.esclusi],
    };
    this.archivio.scrivi(JSON.stringify(dati));
  }

  private async pubblica(): Promise<void> {
    if (this.chiusa) return;
    const p = percorsi(this.codice);
    const scritture: Record<string, unknown> = {};
    const metti = (percorso: string, contenuto: string, testo: string) => {
      if (this.pubblicati.get(percorso) === contenuto) return;
      this.pubblicati.set(percorso, contenuto);
      scritture[percorso] = testo;
    };
    for (const g of this.giocatori) {
      if (g.uid && this.pubblicati.get(p.membro(g.id)) !== g.uid) {
        this.pubblicati.set(p.membro(g.id), g.uid);
        scritture[p.membro(g.id)] = g.uid;
      }
    }
    // Posti liberati (giocatore tolto dalla sala): via il collegamento uid → posto e la vista.
    for (const id of ['g1', 'g2', 'g3', 'g4'] as IdGiocatore[]) {
      if (this.giocatori.some((g) => g.id === id) || !this.pubblicati.has(p.membro(id))) continue;
      this.pubblicati.delete(p.membro(id));
      this.pubblicati.delete(p.vista(id));
      scritture[p.membro(id)] = null;
      scritture[p.vista(id)] = null;
    }
    const pub = this.pubblico();
    metti(p.pubblico, comeTesto({ ...pub, versione: 0 }), comeTesto(pub));
    if (this.stato) {
      for (const g of this.giocatori) {
        if (g.bot || g.id === ID_HOST) continue;
        const contenuto: Omit<VistaPrivata, 'versione'> = {
          vista: vistaDaPubblicare(vistaPer(this.stato, g.id)),
          azioni: azioniPossibili(this.stato, g.id),
        };
        const testo = comeTesto(contenuto);
        metti(p.vista(g.id), testo, comeTesto({ versione: this.versione, ...contenuto }));
      }
    }
    const ora = oraServizio(this.t);
    if (ora - this.ultimaAttivita > 60_000) {
      this.ultimaAttivita = ora;
      scritture[p.attivita] = ora;
    }
    if (Object.keys(scritture).length === 0) return;
    try {
      await this.t.aggiorna(scritture);
    } catch {
      // Scrittura fallita (rete assente): alla prossima modifica si ripubblica tutto.
      this.pubblicati.clear();
    }
  }

  private fermaTimer(): void {
    if (this.timerSistema) clearTimeout(this.timerSistema);
    if (this.timerBot) clearTimeout(this.timerBot);
    this.timerSistema = null;
    this.timerBot = null;
  }

  /** Dopo ogni cambiamento: timer della finestra di reazione, avanzamento automatico, mosse dei bot. */
  private pianifica(): void {
    this.fermaTimer();
    const s = this.stato;
    const proseguiFissato = s !== null && this.statoProsegui === s ? this.prosegueAlle : null;
    const botFissato = s !== null && this.botFissato?.stato === s ? this.botFissato : null;
    this.prosegueAlle = null;
    this.statoProsegui = null;
    this.botFissato = null;
    const ora = oraServizio(this.t);
    // Prima di tutto si "consumano" gli eventi nuovi (anche senza connessione o in pausa): la loro recita conta una volta sola.
    this.registraRecita(s, ora);
    // Senza connessione niente timer: si riprende con il tempo pieno quando torna.
    if (!this.connesso) return;
    if (!s || s.esito || this.inPausa().length > 0) {
      this.scadenza = null;
      this.chiaveFinestra = null;
      return;
    }
    const attesa = inAttesaDi(s);
    // Quando la scena dei telefoni ha finito di recitare l'ultima mossa (se è già passata, vale "ora").
    const fineRecita = Math.max(ora, this.fineRecita);

    // Finestra di reazione o dei Belati di punteggio: timer configurabile, che riparte a ogni nuova dichiarazione.
    const chiave = s.finestra
      ? `f${s.finestra.voce}`
      : s.fase.nome === 'belati_punteggio' && s.pila.length === 0
        ? `p${s.round}-${s.prossimaVoce}`
        : null;
    if (chiave) {
      if (chiave !== this.chiaveFinestra || this.scadenza === null) {
        this.chiaveFinestra = chiave;
        this.scadenza = fineRecita + this.impostazioni.finestraSecondi * 1000;
      }
      this.timerSistema = setTimeout(() => this.applica({ tipo: 'scadenza' }), Math.max(0, this.scadenza - ora));
    } else {
      this.chiaveFinestra = null;
      this.scadenza = null;
      if (attesa.sistema && attesa.giocatori.length === 0) {
        const pausa = TEMPI.prosegui[s.fase.nome] ?? 1500;
        this.prosegueAlle = proseguiFissato ?? fineRecita + pausa;
        this.statoProsegui = s;
        this.timerSistema = setTimeout(() => this.applica({ tipo: 'prosegui' }), Math.max(0, this.prosegueAlle - ora));
      }
    }

    const bot = this.giocatori.find((g) => g.bot && attesa.giocatori.includes(g.id));
    if (bot) {
      const alle = botFissato?.id === bot.id ? botFissato.alle : ora + Math.max(TEMPI.bot, fineRecita - ora);
      this.botFissato = { stato: s, id: bot.id, alle };
      this.timerBot = setTimeout(() => this.mossaBot(bot.id), Math.max(0, alle - ora));
    }
  }

  /**
   * Dagli eventi arrivati dopo l'ultima volta calcola la durata normale della recita della mossa (solo se la durata
   * è stata data) e la mette in coda dopo quelle ancora in corso, come fa il regista: la nuova fine è
   * max(fine precedente, ora) + durata (una durata 0 lascia la fine precedente). Dipende solo dagli eventi.
   */
  private registraRecita(s: Stato | null, ora: number): void {
    if (!s) {
      this.ultimoSeqPianificato = -1;
      this.fineRecita = 0;
      return;
    }
    // Senza la durata data non c'è niente da aspettare: il comportamento di sempre.
    if (!this.opzioni.durataRecita) return;
    const tavolo = vistaPer(s, null);
    const nuovi = tavolo.eventi.filter((e) => e.seq > this.ultimoSeqPianificato);
    if (nuovi.length === 0) return;
    this.ultimoSeqPianificato = ultimoSeq(nuovi);
    // La durata viene da fuori: se si rompe conta 0 (le scadenze di sempre) e la partita va avanti, senza fermare
    // la pubblicazione che segue (la stanza resterebbe ferma per tutti)
    let durata = 0;
    try {
      durata = this.opzioni.durataRecita(nuovi, tavolo);
    } catch (e) {
      if (!this.durataRotta) console.error('durataRecita:', e);
      this.durataRotta = true;
    }
    this.fineRecita = Math.max(this.fineRecita, ora) + (Number.isFinite(durata) ? Math.max(0, durata) : 0);
  }

  private mossaBot(id: IdGiocatore): void {
    const s = this.stato;
    if (!s) return;
    const azioni = azioniPossibili(s, id);
    if (azioni.length === 0) return;
    const testate = azioni.filter((a) => a.tipo === 'esitoTestata');
    let azione: Azione;
    if (testate.length > 0) {
      const massimo = Math.max(...testate.map((a) => (a.tipo === 'esitoTestata' ? a.esito : 0)));
      azione = { tipo: 'esitoTestata', giocatore: id, esito: esitoTestataCasuale(massimo, Math.random) };
    } else {
      azione = normale.scegli(s, id, azioni, Math.random);
      if (!tentaApplica(s, azione).ok) azione = azioni[Math.floor(Math.random() * azioni.length)]!;
    }
    this.applica(azione);
  }
}
