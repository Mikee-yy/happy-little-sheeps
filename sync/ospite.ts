// Sessione di un ospite: legge solo la propria vista e il tavolo, scrive le proprie azioni nella coda della stanza.
import type { Azione, IdGiocatore, IdPecora, Vista } from '../engine/src';
import type { EsitoInvio, Sessione } from './sessione';
import { comeTesto, daTesto, percorsi, presentiDa } from './stanza';
import type { Ingresso, Iscrizione, Meta, Pubblico, Rifiuto, VistaPrivata } from './stanza';
import { oraServizio } from './trasporto';
import type { Smetti, Trasporto } from './trasporto';

/** Chi entra con lo stesso dispositivo che ha creato la stanza: deve riprenderla come host, non entrare come ospite. */
export class SeiHostDellaStanza extends Error {
  constructor(codice: string) {
    super(`La stanza ${codice} l'hai creata tu da questo dispositivo.`);
    this.name = 'SeiHostDellaStanza';
  }
}

export class StanzaInesistente extends Error {
  constructor(codice: string) {
    super(`La stanza ${codice} non esiste.`);
    this.name = 'StanzaInesistente';
  }
}

/** Parte comune a ospiti e vista tavolo: ascolta il contenuto pubblico e la presenza dell'host. */
abstract class Osservatore {
  readonly modo = 'realtime' as const;
  protected pub: Pubblico | null = null;
  protected hostUid = '';
  protected presenti = new Set<string>();
  protected connesso = true;
  protected ascoltatori = new Set<() => void>();
  protected smetti: Smetti[] = [];

  constructor(
    protected readonly t: Trasporto,
    readonly codice: string,
  ) {}

  protected async collega(): Promise<void> {
    const meta = (await this.t.leggi(percorsi(this.codice).meta)) as Meta | null;
    if (!meta) throw new StanzaInesistente(this.codice);
    this.hostUid = meta.host;
    const p = percorsi(this.codice);
    this.smetti.push(
      this.t.ascolta(p.pubblico, (v) => {
        this.pub = daTesto<Pubblico>(v);
        this.avvisa();
      }),
      this.t.ascolta(p.presenze, (v) => {
        this.presenti = presentiDa(v);
        this.avvisa();
      }),
      this.t.connessione((online) => {
        this.connesso = online;
        this.avvisa();
      }),
    );
  }

  /** Questo dispositivo è collegato al servizio? */
  online(): boolean {
    return this.connesso;
  }

  protected avvisa(): void {
    for (const cb of this.ascoltatori) cb();
  }

  pubblico(): Pubblico | null {
    return this.pub;
  }

  /** Ora del servizio realtime, uguale su tutti i dispositivi (per i conti alla rovescia). */
  ora(): number {
    return oraServizio(this.t);
  }

  /** L'host è collegato? Se no la partita è ferma finché non riapre la pagina. */
  hostOnline(): boolean {
    return this.presenti.has(this.hostUid);
  }

  ascolta(cb: () => void): Smetti {
    this.ascoltatori.add(cb);
    return () => this.ascoltatori.delete(cb);
  }

  chiudi(): void {
    for (const s of this.smetti) s();
    this.smetti = [];
  }
}

export class SessioneOspite extends Osservatore implements Sessione {
  /** Il proprio posto, quando l'host l'ha assegnato. */
  io: IdGiocatore | null = null;
  private privata: VistaPrivata | null = null;
  private rif: Rifiuto | null = null;
  private smettiVista: Smetti | null = null;

  private constructor(
    t: Trasporto,
    codice: string,
    private ingresso: Ingresso,
  ) {
    super(t, codice);
  }

  /** Entra in una stanza nuova. */
  static async entra(t: Trasporto, codice: string, dati: { nome: string; pecora: IdPecora; gettone: string }): Promise<SessioneOspite> {
    const s = new SessioneOspite(t, codice, { nome: dati.nome, pecora: dati.pecora, gettone: dati.gettone });
    await s.collega();
    if (s.hostUid === t.uid) {
      s.chiudi();
      throw new SeiHostDellaStanza(codice);
    }
    await s.chiediIngresso();
    return s;
  }

  /** Rientra nella stanza ricordata da questo browser: stessa identità, oppure gettone per riprendersi il posto. */
  static async rientra(t: Trasporto, i: Iscrizione): Promise<SessioneOspite> {
    const ingresso: Ingresso = { nome: i.nome, pecora: i.pecora, gettone: i.gettone };
    if (i.idGiocatore) ingresso.rientro = i.idGiocatore;
    const s = new SessioneOspite(t, i.codice, ingresso);
    await s.collega();
    const membro = i.idGiocatore ? await t.leggi(percorsi(i.codice).membro(i.idGiocatore)) : null;
    if (membro !== t.uid) await s.chiediIngresso();
    return s;
  }

  protected override async collega(): Promise<void> {
    await super.collega();
    const p = percorsi(this.codice);
    this.smetti.push(
      this.t.presente(p.presenza(this.t.uid)),
      this.t.ascolta(p.membri, (v) => this.membri((v as Record<string, string>) ?? {})),
      this.t.ascolta(p.rifiuto(this.t.uid), (v) => {
        this.rif = (v as Rifiuto | null) ?? null;
        this.avvisa();
      }),
    );
  }

  private async chiediIngresso(): Promise<void> {
    await this.t.scrivi(percorsi(this.codice).ingresso(this.t.uid), { ...this.ingresso, quando: oraServizio(this.t) });
  }

  private membri(m: Record<string, string>): void {
    const mio = (Object.entries(m).find(([, uid]) => uid === this.t.uid)?.[0] ?? null) as IdGiocatore | null;
    if (mio === this.io) return;
    this.io = mio;
    this.smettiVista?.();
    this.smettiVista = null;
    this.privata = null;
    if (mio) {
      this.smettiVista = this.t.ascolta(
        percorsi(this.codice).vista(mio),
        (v) => {
          this.privata = daTesto<VistaPrivata>(v);
          this.avvisa();
        },
        () => {
          // Lettura non (ancora) permessa: il posto è cambiato, si riprova al prossimo aggiornamento dei membri.
          this.smettiVista = null;
        },
      );
    }
    this.avvisa();
  }

  /** In sala d'attesa: cambia nome o pecora (l'host conferma se la pecora è libera). */
  async cambia(dati: { nome?: string; pecora?: IdPecora }): Promise<void> {
    this.ingresso = { ...this.ingresso, ...dati };
    await this.chiediIngresso();
  }

  datiIngresso(): Ingresso {
    return { ...this.ingresso };
  }

  /** Ultimo rifiuto dell'host (stanza piena, partita iniziata, mossa non valida). */
  rifiuto(): Rifiuto | null {
    return this.rif;
  }

  vista(per: IdGiocatore | null): Vista {
    if (per !== null && per === this.io && this.privata) return this.privata.vista;
    const tavolo = this.pub?.tavolo;
    if (!tavolo) throw new Error('Vista non ancora disponibile');
    return tavolo;
  }

  /** La propria vista è arrivata ed è aggiornata almeno quanto il tavolo? */
  pronta(): boolean {
    return !!this.io && !!this.privata && !!this.pub?.tavolo;
  }

  azioni(per: IdGiocatore | 'sistema'): Azione[] {
    return per === this.io && this.privata ? this.privata.azioni : [];
  }

  invia(azione: Azione): EsitoInvio {
    if (!this.io) return { ok: false, codice: 'non_tocca_a_te', messaggio: 'Non sei ancora nella stanza' };
    const p = percorsi(this.codice);
    void this.t.aggiungi(p.azioni, { uid: this.t.uid, azione: comeTesto(azione) }).catch(() => undefined);
    return { ok: true };
  }

  override chiudi(): void {
    this.smettiVista?.();
    this.smettiVista = null;
    super.chiudi();
  }
}

/** Vista "tavolo" senza mani, da proiettare su uno schermo comune (brief §5, facoltativa). */
export class SessioneTavolo extends Osservatore {
  static async apri(t: Trasporto, codice: string): Promise<SessioneTavolo> {
    const s = new SessioneTavolo(t, codice);
    await s.collega();
    return s;
  }

  vista(): Vista | null {
    return this.pub?.tavolo ?? null;
  }
}
