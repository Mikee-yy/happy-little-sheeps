// Tipi del motore di Happy Little Sheeps.
// Contratto condiviso tra motore, test, simulatore e interfaccia: la semantica è in docs/motore.md.

// ─── Identificatori ──────────────────────────────────────────────────────────

export type IdGiocatore = string;
/** Istanza fisica di una carta: "<idTipo>#<n>", con n da 1. Esempio: "calzino-gemello#2". */
export type IdCarta = string;
/** Id del tipo di carta in cards.json. Esempio: "calzino-gemello". */
export type IdTipoCarta = string;
/** Id progressivo di una voce della pila di reazione. */
export type IdVoce = number;

export type IdPecora = 'ricciolo' | 'brontolana' | 'sospirella' | 'nerina';
export type TipoGuaio = 'meteo' | 'predatori' | 'drammi';
export type TipoGuaioCarta = TipoGuaio | 'tosatura';

// ─── Dati (cards.json, setup.json) ───────────────────────────────────────────

export type EffettoTrovata =
  | 'ignora_effetti'
  | 'scarta_e_somma'
  | 'prendi_agnellino'
  | 'scarta_fino_a_tre'
  | 'sposta_agnellino'
  | 'guarda_due'
  | 'scambia_punteggi'
  | 'raddoppia_belati';

/** Gruppo di risoluzione: 'round' = "per tutto il round", 'normale', 'punteggio' = "durante il calcolo del punteggio". */
export type GruppoEffetto = 'round' | 'normale' | 'punteggio';

export type EffettoBelato =
  | 'modifica_punteggio'
  | 'scambia_punteggi'
  | 'guaio_in_fondo'
  | 'devia_guaio'
  | 'beee_no'
  | 'cura';

/** Quando si gioca un Belato. 'sempre' = Beee-NO!, solo se la pila non è vuota. 'dopo_guaio' = fase consolazione. */
export type MomentoBelato = 'punteggio' | 'salvataggio' | 'sempre' | 'dopo_guaio';

export interface DefTrovata {
  id: IdTipoCarta;
  famiglia: 'trovata';
  nome: string;
  valore: number;
  gemella: boolean;
  effetto: EffettoTrovata | null;
  gruppo: GruppoEffetto | null;
  testo: string;
  copie: number;
}

export interface DefBelato {
  id: IdTipoCarta;
  famiglia: 'belato';
  nome: string;
  effetto: EffettoBelato;
  quando: MomentoBelato;
  /** Solo per 'modifica_punteggio': +2 o −2. */
  valore?: number;
  testo: string;
  copie: number;
}

export interface DefGuaio {
  id: IdTipoCarta;
  famiglia: 'guaio';
  nome: string;
  tipo: TipoGuaioCarta;
  testo: string;
  copie: 1;
}

export type DefCarta = DefTrovata | DefBelato | DefGuaio;

export interface DefPecora {
  id: IdPecora;
  nome: string;
  titolo: string;
  bonus: TipoGuaio;
  malus: TipoGuaio;
}

export type EffettoDado = 'pascolo' | 'furto' | 'testata';

export interface FacciaDado {
  id: string;
  effetto: EffettoDado;
  /** Pascolo: agnellini da prendere. Furto: agnellini da rubare in totale. Testata: esito massimo. */
  quantita: number;
  copie: number;
}

export type RegolaEliminazione =
  | { regola: 'uguali'; quanti: number }
  | { regola: 'diversi'; quanti: number }
  | { regola: 'perTipo'; quanti: number };

/** Configurazione della partita, copiata nello stato alla creazione: il motore non rilegge setup.json. */
export interface ConfigPartita {
  numeroGiocatori: number;
  postiOvile: number;
  agnelliniTotali: number;
  agnelliniIniziali: number;
  manoIniziale: number;
  regoleEliminazione: RegolaEliminazione[];
  dado: FacciaDado[];
  esitoMassimoTestata: number;
}

// ─── Stato ───────────────────────────────────────────────────────────────────

export interface StatoGiocatore {
  id: IdGiocatore;
  nome: string;
  pecora: IdPecora;
  mano: IdCarta[];
  agnellini: number;
  /** Angolo dei Guai, in ordine di arrivo. */
  angolo: IdCarta[];
  eliminato: boolean;
}

export type TipoRiga = 'valore' | 'tratto' | 'effetto' | 'belato' | 'scambio';

/** Una riga del calcolo del punteggio del round. Il totale è la somma dei delta. */
export interface RigaPunteggio {
  tipo: TipoRiga;
  delta: number;
  /** Carta che ha causato la riga (Trovata giocata, Trovata scartata, Belato), se c'è. */
  carta?: IdCarta;
  /** Giocatore che ha causato la riga (chi ha giocato il Belato o la Trovata), se c'è. */
  autore?: IdGiocatore;
}

export type EsitoVoceEffetto = 'attesa' | 'attivato' | 'rinunciato' | 'saltato' | 'ignorato' | 'annullato';

export interface VoceEffetto {
  giocatore: IdGiocatore;
  carta: IdCarta;
  effetto: EffettoTrovata;
  gruppo: GruppoEffetto;
  valore: number;
  esito: EsitoVoceEffetto;
}

export interface DatiRound {
  numero: number;
  /** Guaio attivo del round, o null se il mazzo Guai è esaurito e non c'è nulla da rimescolare. */
  guaio: IdCarta | null;
  /** Giocatori che giocano una Trovata in questo round (non eliminati, con almeno una Trovata dopo la ripescata). */
  partecipanti: IdGiocatore[];
  /** Trovate giocate, pubbliche dopo la rivelazione (1 carta, o 2 Gemelle). */
  giocate: Record<IdGiocatore, IdCarta[]>;
  punteggi: Record<IdGiocatore, RigaPunteggio[]>;
  /** Tutte le carte finite sul tavolo nel round (Trovate giocate, Belati giocati, carte del Belato Finale): agli scarti a fine round. */
  tavolo: IdCarta[];
  raddoppioBelati: boolean;
  /** Trovata "ignora gli effetti" che si è risolta, se c'è. */
  ignoraEffetti: { giocatore: IdGiocatore; carta: IdCarta } | null;
  /** Calcolati alla chiusura della finestra dei Belati di punteggio. */
  piuAlti: IdGiocatore[];
  piuBassi: IdGiocatore[];
  /** Chi lancia il Dado del Pastore in questo round, nell'ordine di lancio. */
  lanciatori: IdGiocatore[];
  /** Chi ha preso il Guaio del round (dopo deviazioni), se qualcuno. */
  presoDa: IdGiocatore | null;
}

export type DichiarazioneDado =
  | { effetto: 'pascolo'; quantita: number }
  | { effetto: 'furto'; daAvversari: Record<IdGiocatore, number>; dalGregge: number }
  | { effetto: 'testata'; bersaglio: IdGiocatore };

export type Fase =
  | { nome: 'guaio' }
  | {
      nome: 'scelta';
      /** Per ogni partecipante: carte scelte (1 Trovata o 2 Gemelle) o null se non ha ancora scelto. Segreto. */
      scelte: Record<IdGiocatore, IdCarta[] | null>;
    }
  | { nome: 'rivelazione' }
  | { nome: 'effetti'; coda: VoceEffetto[]; indice: number }
  | {
      nome: 'belati_punteggio';
      /** Giocatori non eliminati che non hanno ancora passato da quando la finestra è stata (ri)aperta. */
      inAttesa: IdGiocatore[];
    }
  | { nome: 'dado'; indice: number }
  | {
      nome: 'risoluzione_dado';
      indice: number;
      lanciatore: IdGiocatore;
      faccia: string;
      passo: 'dichiarazione' | 'reazione' | 'esito_testata';
      dichiarazione: DichiarazioneDado | null;
    }
  | {
      nome: 'guaio_al_peggiore';
      /** Chi prende il Guaio, se uno solo è il più basso. */
      destinatario: IdGiocatore | null;
      /** Pari merito per il più basso: vanno al Belato Finale. */
      spareggio: IdGiocatore[] | null;
    }
  | {
      nome: 'belato_finale';
      partecipanti: IdGiocatore[];
      /** Segreto finché tutti hanno scelto. */
      scelte: Record<IdGiocatore, IdCarta | null>;
      /** Rivelazioni già avvenute (ripetizioni comprese), pubbliche. */
      storico: Array<Record<IdGiocatore, IdCarta>>;
    }
  | { nome: 'belati_salvataggio'; destinatario: IdGiocatore }
  | { nome: 'consolazione'; destinatario: IdGiocatore }
  | { nome: 'fine_round' }
  | { nome: 'ultimo_round' }
  | { nome: 'fine_partita' };

export type NomeFase = Fase['nome'];

export type DettagliVoce =
  | { tipo: 'effetto_trovata'; carta: IdCarta; effetto: EffettoTrovata; bersaglio?: IdGiocatore }
  | {
      tipo: 'belato';
      carta: IdCarta;
      effetto: EffettoBelato;
      bersaglio?: IdGiocatore;
      /** Solo Beee-NO!: la voce che annulla (sempre quella subito sotto). */
      voceBersaglio?: IdVoce;
      /** Solo cura: il Guaio da togliere dall'Angolo. */
      guaio?: IdCarta;
    }
  | { tipo: 'dado'; faccia: string; dichiarazione: DichiarazioneDado };

export interface VocePila {
  id: IdVoce;
  autore: IdGiocatore;
  dettagli: DettagliVoce;
}

/** Finestra di reazione sulla cima della pila. */
export interface Finestra {
  voce: IdVoce;
  /** Chi deve ancora rispondere: tutti i non eliminati tranne l'autore della cima. */
  inAttesa: IdGiocatore[];
}

/** Scelta privata che un giocatore deve completare dopo che un effetto si è risolto. */
export type Richiesta =
  | { tipo: 'scarta_e_somma'; giocatore: IdGiocatore; carta: IdCarta }
  | { tipo: 'scarta_fino_a_tre'; giocatore: IdGiocatore; carta: IdCarta }
  | { tipo: 'guarda_due'; giocatore: IdGiocatore; carta: IdCarta; carte: IdCarta[] };

export type ModoVittoria = 'ovile_pieno' | 'ultima_pecora' | 'mazzo_finito';

export interface EsitoPartita {
  modo: ModoVittoria;
  vincitori: IdGiocatore[];
}

export type Luogo = IdGiocatore | 'gregge';

export type Evento =
  | { seq: number; tipo: 'round_iniziato'; round: number; ultimo: boolean }
  | { seq: number; tipo: 'guaio_rivelato'; carta: IdCarta | null }
  | { seq: number; tipo: 'guai_rimescolati'; quanti: number }
  | { seq: number; tipo: 'ripescata'; giocatore: IdGiocatore; scartate: number; pescate: number }
  | { seq: number; tipo: 'fuori_dal_round'; giocatore: IdGiocatore }
  | { seq: number; tipo: 'ha_scelto'; giocatore: IdGiocatore }
  | { seq: number; tipo: 'rivelazione'; giocate: Record<IdGiocatore, IdCarta[]> }
  | { seq: number; tipo: 'dichiarazione'; voce: IdVoce; autore: IdGiocatore; dettagli: DettagliVoce }
  | { seq: number; tipo: 'annullata'; voce: IdVoce; da: IdVoce }
  | { seq: number; tipo: 'risolta'; voce: IdVoce }
  | { seq: number; tipo: 'effetto'; giocatore: IdGiocatore; carta: IdCarta; esito: EsitoVoceEffetto }
  | { seq: number; tipo: 'punteggio'; giocatore: IdGiocatore; riga: RigaPunteggio; totale: number }
  | { seq: number; tipo: 'agnellini'; da: Luogo; a: Luogo; quanti: number; causa: string }
  | { seq: number; tipo: 'scartate'; giocatore: IdGiocatore; carte: IdCarta[]; causa: string }
  | {
      seq: number;
      tipo: 'pescate';
      giocatore: IdGiocatore;
      quante: number;
      /** Privato: visibile solo a `giocatore`. */
      carte?: IdCarta[];
    }
  | { seq: number; tipo: 'dado_lanciato'; giocatore: IdGiocatore; faccia: string }
  | { seq: number; tipo: 'testata'; giocatore: IdGiocatore; bersaglio: IdGiocatore; esito: number }
  | { seq: number; tipo: 'belato_finale'; rivelate: Record<IdGiocatore, IdCarta> }
  | { seq: number; tipo: 'guaio_preso'; giocatore: IdGiocatore; carta: IdCarta }
  | { seq: number; tipo: 'guaio_in_fondo'; carta: IdCarta }
  | { seq: number; tipo: 'guaio_deviato'; da: IdGiocatore; a: IdGiocatore }
  | { seq: number; tipo: 'guaio_curato'; giocatore: IdGiocatore; carta: IdCarta }
  | { seq: number; tipo: 'eliminato'; giocatore: IdGiocatore }
  | { seq: number; tipo: 'ultimo_round_annunciato'; round: number }
  | { seq: number; tipo: 'fine_partita'; esito: EsitoPartita };

/** Distribuisce Omit sui membri dell'unione (Omit semplice la appiattirebbe). */
export type SenzaSeq<T> = T extends unknown ? Omit<T, 'seq'> : never;
export type NuovoEvento = SenzaSeq<Evento>;

export interface Stato {
  config: ConfigPartita;
  /** Stato del generatore casuale con seme (uint32). Mai esposto nelle viste. */
  rng: number;
  /** Ordine dei posti. */
  giocatori: StatoGiocatore[];
  gregge: number;
  /** Mazzo principale, cima = indice 0. */
  mazzo: IdCarta[];
  scarti: IdCarta[];
  /** Mazzo Guai, cima = indice 0. */
  mazzoGuai: IdCarta[];
  /** Guai usciti dal gioco (Angoli degli eliminati): si rimescolano quando il mazzo Guai è vuoto. */
  guaiFuoriGioco: IdCarta[];
  /** Numero del round in corso (da 1). */
  round: number;
  /** Primo giocatore del round in corso: apre ripescate e pescate. Ruota a ogni round. */
  primoGiocatore: IdGiocatore;
  /** Numero dell'ultimo round, appena viene pescata l'ultima carta del mazzo principale. */
  ultimoRound: number | null;
  fase: Fase;
  datiRound: DatiRound;
  pila: VocePila[];
  finestra: Finestra | null;
  richiesta: Richiesta | null;
  prossimaVoce: IdVoce;
  esito: EsitoPartita | null;
  /** Ultimi eventi (al massimo 200), per animazioni e registro. */
  eventi: Evento[];
  prossimoEvento: number;
  /** Partita di prova: facce del dado da usare per prime, poi si torna al caso. Mai esposto nelle viste. */
  dadoPreparato?: string[];
}

// ─── Azioni ──────────────────────────────────────────────────────────────────

export type Azione =
  /** Sistema: fa avanzare le fasi automatiche (guaio, rivelazione, guaio_al_peggiore, fine_round, ultimo_round). */
  | { tipo: 'prosegui' }
  /** Sistema: tempo scaduto; tutti quelli ancora in attesa nella finestra corrente passano. */
  | { tipo: 'scadenza' }
  | { tipo: 'scegliTrovata'; giocatore: IdGiocatore; carte: IdCarta[] }
  | { tipo: 'attivaEffetto'; giocatore: IdGiocatore; carta: IdCarta; bersaglio?: IdGiocatore }
  | { tipo: 'rinunciaEffetto'; giocatore: IdGiocatore; carta: IdCarta }
  | { tipo: 'completaEffetto'; giocatore: IdGiocatore; carte: IdCarta[] }
  | {
      tipo: 'giocaBelato';
      giocatore: IdGiocatore;
      carta: IdCarta;
      bersaglio?: IdGiocatore;
      /** Beee-NO!: id della voce in cima alla pila. */
      voce?: IdVoce;
      /** Cura: Guaio da togliere dal proprio Angolo. */
      guaio?: IdCarta;
    }
  | {
      tipo: 'passa';
      giocatore: IdGiocatore;
      /**
       * A cosa si risponde: id della voce in cima alla pila (finestra di reazione), oppure null per passare
       * nella fase (Belati di punteggio, salvataggio). Se non corrisponde a ciò che è aperto adesso, l'azione è
       * rifiutata: con più dispositivi un "passa" non deve finire su una finestra che il giocatore non ha visto.
       * Se manca non si controlla.
       */
      voce?: IdVoce | null;
    }
  | { tipo: 'lanciaDado'; giocatore: IdGiocatore }
  | {
      tipo: 'dichiaraDado';
      giocatore: IdGiocatore;
      /** Furto: quanti agnellini a ciascun avversario. */
      furto?: Record<IdGiocatore, number>;
      /** Testata: avversario bersaglio. */
      bersaglio?: IdGiocatore;
    }
  | { tipo: 'esitoTestata'; giocatore: IdGiocatore; esito: number }
  | { tipo: 'sceltaFinale'; giocatore: IdGiocatore; carta: IdCarta }
  | { tipo: 'concludiConsolazione'; giocatore: IdGiocatore; scarta: IdCarta | null };

export type TipoAzione = Azione['tipo'];

/** Chi deve agire adesso. */
export interface Attesa {
  /** true se si aspetta un'azione di sistema (prosegui). */
  sistema: boolean;
  /** Giocatori da cui si aspetta un'azione (scelta, risposta in finestra, decisione). */
  giocatori: IdGiocatore[];
}

// ─── Vista per giocatore ─────────────────────────────────────────────────────

export interface VistaGiocatore extends Omit<StatoGiocatore, 'mano'> {
  /** Solo la propria mano; null per gli altri. */
  mano: IdCarta[] | null;
  carteInMano: number;
}

export type VistaFase =
  | Exclude<Fase, { nome: 'scelta' } | { nome: 'belato_finale' }>
  | { nome: 'scelta'; haScelto: Record<IdGiocatore, boolean>; miaScelta: IdCarta[] | null }
  | {
      nome: 'belato_finale';
      partecipanti: IdGiocatore[];
      haScelto: Record<IdGiocatore, boolean>;
      miaScelta: IdCarta | null;
      storico: Array<Record<IdGiocatore, IdCarta>>;
    };

export interface Vista {
  /** A chi è destinata la vista; null = vista "tavolo" senza mani. */
  per: IdGiocatore | null;
  config: ConfigPartita;
  giocatori: VistaGiocatore[];
  gregge: number;
  carteNelMazzo: number;
  scarti: IdCarta[];
  carteNelMazzoGuai: number;
  guaiFuoriGioco: IdCarta[];
  round: number;
  primoGiocatore: IdGiocatore;
  ultimoRound: number | null;
  fase: VistaFase;
  datiRound: DatiRound;
  pila: VocePila[];
  finestra: Finestra | null;
  /** Per gli altri giocatori le carte segrete di guarda_due sono sostituite da []. */
  richiesta: Richiesta | null;
  esito: EsitoPartita | null;
  eventi: Evento[];
  attesa: Attesa;
}

// ─── Errori ──────────────────────────────────────────────────────────────────

export class ErroreRegola extends Error {
  readonly codice: string;
  constructor(codice: string, messaggio: string) {
    super(messaggio);
    this.name = 'ErroreRegola';
    this.codice = codice;
  }
}

// ─── Partita di prova ────────────────────────────────────────────────────────

/** Preparazione dei primi round della partita di prova (engine/data/prova.json): si applica dopo la mescolata. */
export interface Preparazione {
  /** Mani iniziali (tipi di carta); se sono meno della mano iniziale si completano dalla cima del mazzo. */
  mani: Record<IdGiocatore, IdTipoCarta[]>;
  /** Carte da mettere in cima al mazzo principale, nell'ordine dato. */
  cimaMazzo: IdTipoCarta[];
  /** Guai da mettere in cima al mazzo Guai, nell'ordine dato. */
  cimaGuai: IdTipoCarta[];
  /** Facce del dado per i primi tiri. */
  dado: string[];
  primoGiocatore: IdGiocatore;
}
