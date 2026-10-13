// Database realtime in memoria per i test: più dispositivi condividono lo stesso archivio.
// Riproduce le regole di accesso di database.rules.json che contano per la sicurezza delle partite.
import type { Smetti, Trasporto } from './trasporto';

type Nodo = Record<string, unknown>;

const parti = (percorso: string) => percorso.split('/').filter(Boolean);
const copia = <T>(x: T): T => (x === undefined ? (null as T) : structuredClone(x));

function leggiIn(radice: Nodo, percorso: string): unknown {
  let n: unknown = radice;
  for (const p of parti(percorso)) {
    if (n === null || typeof n !== 'object') return null;
    n = (n as Nodo)[p];
  }
  return n ?? null;
}

function scriviIn(radice: Nodo, percorso: string, valore: unknown): void {
  const ps = parti(percorso);
  const ultima = ps.pop();
  if (ultima === undefined) throw new Error('percorso vuoto');
  let n = radice;
  const catena: Array<[Nodo, string]> = [];
  for (const p of ps) {
    if (n[p] === null || typeof n[p] !== 'object') {
      if (valore === null) return;
      n[p] = {};
    }
    catena.push([n, p]);
    n = n[p] as Nodo;
  }
  if (valore === null) delete n[ultima];
  else n[ultima] = copia(valore);
  // Come nel database realtime, i nodi rimasti vuoti spariscono.
  for (let i = catena.length - 1; i >= 0; i--) {
    const [padre, chiave] = catena[i]!;
    if (Object.keys(padre[chiave] as Nodo).length === 0) delete padre[chiave];
    else break;
  }
}

const correlati = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const GIORNO = 24 * 3600 * 1000;

export class ErrorePermesso extends Error {
  constructor(percorso: string, cosa: string) {
    super(`PERMISSION_DENIED: ${cosa} ${percorso}`);
    this.name = 'ErrorePermesso';
  }
}

interface Ascoltatore {
  uid: string;
  percorso: string;
  avvisa: () => void;
}

/** L'archivio condiviso: un "server" in memoria. */
export class ArchivioMemoria {
  dati: Nodo = {};
  private ascoltatori = new Set<Ascoltatore>();
  private presenze = new Map<string, Set<string>>();
  private contatore = 0;
  /** Se falso, le regole di accesso non vengono controllate. */
  regole = true;

  dispositivo(uid: string): TrasportoMemoria {
    return new TrasportoMemoria(this, uid);
  }

  private connessioni = new Map<string, Set<(online: boolean) => void>>();

  /** Simula la caduta della connessione di un dispositivo: il servizio toglie le sue presenze. */
  disconnetti(uid: string): void {
    for (const p of this.presenze.get(uid) ?? []) this.applica(uid, { [p]: null }, false);
    this.presenze.delete(uid);
    this.avvisaConnessione(uid, false);
  }

  /** Simula una rete che cade e torna senza chiudere la pagina. */
  impostaConnessione(uid: string, online: boolean): void {
    if (!online) for (const p of this.presenze.get(uid) ?? []) this.applica(uid, { [p]: null }, false);
    this.avvisaConnessione(uid, online);
  }

  aggiungiConnessione(uid: string, cb: (online: boolean) => void): Smetti {
    if (!this.connessioni.has(uid)) this.connessioni.set(uid, new Set());
    this.connessioni.get(uid)!.add(cb);
    return () => this.connessioni.get(uid)?.delete(cb);
  }

  private avvisaConnessione(uid: string, online: boolean): void {
    for (const cb of this.connessioni.get(uid) ?? []) queueMicrotask(() => cb(online));
  }

  nuovaChiave(): string {
    this.contatore += 1;
    return `-k${String(this.contatore).padStart(8, '0')}`;
  }

  registraPresenza(uid: string, percorso: string): void {
    if (!this.presenze.has(uid)) this.presenze.set(uid, new Set());
    this.presenze.get(uid)!.add(percorso);
  }

  togliPresenza(uid: string, percorso: string): void {
    this.presenze.get(uid)?.delete(percorso);
  }

  aggiungiAscoltatore(a: Ascoltatore): Smetti {
    this.ascoltatori.add(a);
    return () => this.ascoltatori.delete(a);
  }

  /** Scrive più percorsi in modo atomico, controllando le regole, e avvisa gli ascoltatori. */
  applica(uid: string, valori: Record<string, unknown>, controlla = true): void {
    const dopo = structuredClone(this.dati);
    for (const [p, v] of Object.entries(valori)) scriviIn(dopo, p, v === undefined ? null : v);
    if (controlla && this.regole) {
      for (const [p, v] of Object.entries(valori)) {
        if (!puoScrivere(this.dati, dopo, uid, p, v ?? null)) throw new ErrorePermesso(p, 'scrittura');
      }
    }
    this.dati = dopo;
    const toccati = Object.keys(valori);
    for (const a of [...this.ascoltatori]) {
      if (toccati.some((p) => correlati(parti(p).join('/'), parti(a.percorso).join('/')))) queueMicrotask(a.avvisa);
    }
  }

  puoLeggere(uid: string, percorso: string): boolean {
    return !this.regole || puoLeggere(this.dati, uid, percorso);
  }
}

// ─── Regole (stesso significato di database.rules.json) ─────────────────────

function hostDi(dati: Nodo, codice: string): unknown {
  return leggiIn(dati, `stanze/${codice}/meta/host`);
}

function puoLeggere(dati: Nodo, uid: string, percorso: string): boolean {
  const p = parti(percorso);
  if (p[0] !== 'stanze' || p.length < 3) return false;
  const codice = p[1]!;
  const sezione = p[2];
  const host = hostDi(dati, codice) === uid;
  switch (sezione) {
    case 'meta':
    case 'membri':
    case 'pubblico':
    case 'presenza':
      return true;
    case 'viste':
      return p.length >= 4 && leggiIn(dati, `stanze/${codice}/membri/${p[3]}`) === uid;
    case 'ingressi':
      return host || (p.length >= 4 && p[3] === uid);
    case 'azioni':
      return host;
    case 'rifiuti':
      return p.length >= 4 && p[3] === uid;
    default:
      return false;
  }
}

/** Come i "$altro": { ".validate": false } delle regole: nessun campo oltre quelli previsti. */
function soloCampi(valore: unknown, ammessi: string[]): boolean {
  return valore === null || (typeof valore === 'object' && Object.keys(valore as object).every((k) => ammessi.includes(k)));
}

function puoScrivere(prima: Nodo, dopo: Nodo, uid: string, percorso: string, valore: unknown): boolean {
  const p = parti(percorso);
  if (p[0] === 'attivita' && p.length === 2) {
    const codice = p[1]!;
    if (valore === null) return Number(leggiIn(prima, percorso)) < Date.now() - GIORNO;
    return hostDi(dopo, codice) === uid && typeof valore === 'number';
  }
  if (p[0] !== 'stanze' || p.length < 2) return false;
  const codice = p[1]!;
  if (p.length === 2) return valore === null && Number(leggiIn(prima, `attivita/${codice}`)) < Date.now() - GIORNO;
  const sezione = p[2];
  const hostDopo = hostDi(dopo, codice) === uid;
  const hostPrima = hostDi(prima, codice) === uid;
  switch (sezione) {
    case 'meta': {
      const esiste = leggiIn(prima, `stanze/${codice}/meta`) !== null;
      if (p.length === 4) return hostPrima && p[3] === 'sessione' && typeof valore === 'string';
      return (
        (!esiste || hostPrima) &&
        p.length === 3 &&
        (valore as { host?: string } | null)?.host === uid &&
        /^[A-Z]{4}$/.test(codice) &&
        soloCampi(valore, ['host', 'creata', 'sessione']) &&
        typeof leggiIn(dopo, `attivita/${codice}`) === 'number'
      );
    }
    case 'membri':
    case 'pubblico':
      return hostDopo;
    case 'viste':
      return hostDopo && (valore === null || typeof valore === 'string');
    case 'ingressi':
      return (
        p.length === 4 &&
        p[3] === uid &&
        leggiIn(prima, `stanze/${codice}/meta`) !== null &&
        soloCampi(valore, ['nome', 'pecora', 'gettone', 'rientro', 'quando'])
      );
    case 'azioni':
      if (hostPrima) return true;
      return (
        p.length === 4 &&
        leggiIn(prima, percorso) === null &&
        (valore as { uid?: string } | null)?.uid === uid &&
        typeof (valore as { azione?: unknown }).azione === 'string' &&
        soloCampi(valore, ['uid', 'azione'])
      );
    case 'rifiuti':
      return hostPrima;
    case 'presenza':
      return (
        p.length === 5 &&
        p[3] === uid &&
        (valore === null || (typeof valore === 'boolean' && leggiIn(prima, `stanze/${codice}/meta`) !== null))
      );
    default:
      return false;
  }
}

// ─── Un dispositivo ──────────────────────────────────────────────────────────

export class TrasportoMemoria implements Trasporto {
  private chiusure = new Set<Smetti>();
  private presenzeMie = new Set<string>();

  constructor(
    private readonly archivio: ArchivioMemoria,
    readonly uid: string,
  ) {}

  async leggi(percorso: string): Promise<unknown> {
    if (!this.archivio.puoLeggere(this.uid, percorso)) throw new ErrorePermesso(percorso, 'lettura');
    return copia(leggiIn(this.archivio.dati, percorso));
  }

  async scrivi(percorso: string, valore: unknown): Promise<void> {
    this.archivio.applica(this.uid, { [percorso]: valore });
  }

  async aggiorna(valori: Record<string, unknown>): Promise<void> {
    this.archivio.applica(this.uid, valori);
  }

  async aggiungi(percorso: string, valore: unknown): Promise<string> {
    const chiave = this.archivio.nuovaChiave();
    this.archivio.applica(this.uid, { [`${percorso}/${chiave}`]: valore });
    return chiave;
  }

  ascolta(percorso: string, cb: (valore: unknown) => void, errore?: (e: Error) => void): Smetti {
    let attivo = true;
    const consegna = () => {
      if (!attivo) return;
      if (!this.archivio.puoLeggere(this.uid, percorso)) {
        attivo = false;
        errore?.(new ErrorePermesso(percorso, 'lettura'));
        return;
      }
      cb(copia(leggiIn(this.archivio.dati, percorso)));
    };
    const togli = this.archivio.aggiungiAscoltatore({ uid: this.uid, percorso, avvisa: consegna });
    queueMicrotask(consegna);
    const smetti = () => {
      attivo = false;
      togli();
    };
    this.chiusure.add(smetti);
    return smetti;
  }

  ascoltaFigli(percorso: string, cb: (chiave: string, valore: unknown) => void, errore?: (e: Error) => void): Smetti {
    const viste = new Set<string>();
    return this.ascolta(
      percorso,
      (valore) => {
        const figli = valore && typeof valore === 'object' ? (valore as Nodo) : {};
        for (const chiave of Object.keys(figli).sort()) {
          if (viste.has(chiave)) continue;
          viste.add(chiave);
          cb(chiave, copia(figli[chiave]));
        }
        // Una chiave cancellata può tornare (non succede con le chiavi cronologiche, ma resta corretto).
        for (const k of [...viste]) if (!(k in figli)) viste.delete(k);
      },
      errore,
    );
  }

  presente(percorso: string): Smetti {
    const mia = `${percorso}/${this.archivio.nuovaChiave()}`;
    this.presenzeMie.add(mia);
    this.archivio.registraPresenza(this.uid, mia);
    this.archivio.applica(this.uid, { [mia]: true });
    return () => {
      this.presenzeMie.delete(mia);
      this.archivio.togliPresenza(this.uid, mia);
      this.archivio.applica(this.uid, { [mia]: null }, false);
    };
  }

  connessione(cb: (online: boolean) => void): Smetti {
    queueMicrotask(() => cb(true));
    const smetti = this.archivio.aggiungiConnessione(this.uid, cb);
    this.chiusure.add(smetti);
    return smetti;
  }

  async chiaviSotto(percorso: string, limite: number): Promise<string[]> {
    const n = leggiIn(this.archivio.dati, percorso);
    if (!n || typeof n !== 'object') return [];
    return Object.entries(n as Nodo)
      .filter(([, v]) => typeof v === 'number' && v < limite)
      .map(([k]) => k);
  }

  scartoOrologio(): number {
    return 0;
  }

  chiudi(): void {
    for (const c of this.chiusure) c();
    this.chiusure.clear();
    this.archivio.disconnetti(this.uid);
  }
}
