// Tipi delle scelte dentro la scena: la "domanda di adesso" (cosa si può toccare), i gesti che arrivano dal teatro,
// la scelta a metà e l'esito (una mossa del motore, "risponde" o "indietro"). Parte pura, senza DOM.
import type { Azione, IdCarta, IdGiocatore, Vista } from '../../../../engine/src';
import type { Scena } from '../../partita/regia';
import type { ScenaProva } from '../../prova/regiaProva';

export type IdPulsante =
  | 'gioca'
  | 'conferma'
  | 'continua'
  | 'nessuno'
  | 'passo'
  | 'annulla'
  | 'attiva'
  | 'rinuncia'
  | 'prendiGuaio'
  | 'nonScartare'
  | 'fatto';

export type Gesto =
  /** Tocco su una carta della mano. */
  | { tipo: 'carta'; carta: IdCarta }
  /** Carta rilasciata sulla tovaglia. */
  | { tipo: 'trascinata'; carta: IdCarta }
  /** Pecora, recinto o targa. */
  | { tipo: 'pecora'; chi: IdGiocatore }
  /** Agnellino alzato nel furto (lo rimette giù). */
  | { tipo: 'agnellino'; chi: IdGiocatore }
  | { tipo: 'dado' }
  /** Il Montone lasciato andare: quanti agnellini cadono (limitato al massimo della domanda). */
  | { tipo: 'fionda'; esito: number }
  /** Guaio del proprio angolo. */
  | { tipo: 'guaio'; carta: IdCarta }
  /** Carta grande sopra la tovaglia. */
  | { tipo: 'grande'; carta: IdCarta }
  | { tipo: 'pulsante'; id: IdPulsante }
  /** Tocco sul prato, fuori dalla mano, dalle zone, dai pulsanti e dal dado: abbassa le carte e spegne il bersaglio. */
  | { tipo: 'prato' };

export interface PulsanteDomanda {
  id: IdPulsante;
  testo: string;
  attivo: boolean;
  secondario?: boolean;
  sottoLaCarta?: boolean;
}

export interface Domanda {
  /** Stessa chiave = stessa domanda: la scelta a metà si conserva. */
  chiave: string;
  scritta: string;
  avvisi: string[];
  /** Carte della mano che rispondono al tocco. */
  carte: IdCarta[];
  sollevate: IdCarta[];
  /** Si giocano trascinandole sulla tovaglia. */
  trascinabili: IdCarta[];
  /** Illuminate e toccabili. */
  pecore: IdGiocatore[];
  dado: boolean;
  /** Guai del proprio angolo toccabili. */
  guai: IdCarta[];
  /** Il Guaio scelto con un tocco (resta evidenziato, in attesa della conferma); null se nessuno. */
  guaioScelto: IdCarta | null;
  /** Carte grandi da toccare (Guarda le prime 2). */
  grandi: IdCarta[];
  /** Carta al centro, solo da guardare. */
  centro: IdCarta | null;
  furto: { presi: Partial<Record<IdGiocatore, number>> } | null;
  pulsanti: PulsanteDomanda[];
  /**
   * La fionda della Testata: chi tira, il bersaglio e l'esito più alto permesso dal motore (0..massimo); null se non c'è.
   * `chi` (il lanciatore): con "Passa il telefono" spesso non è chi sta in basso, e il Montone parte vicino alla sua pecora;
   * senza, chi sta in basso.
   * `tentativo` (lo mette GiocoInScena, dati semplici): cambia quando la risposta torna valida (mossa rifiutata, attesa
   * scaduta). Con lo stesso tentativo un tiro già fatto resta fatto, anche se la domanda si toglie e torna; con uno
   * nuovo si mira di nuovo. Senza, un tiro resta fatto solo finché la domanda è mostrata.
   */
  fionda: { chi?: IdGiocatore; bersaglio: IdGiocatore; massimo: number; tentativo?: string } | null;
}

export interface Scelta {
  chiave: string;
  carte: IdCarta[];
  carta: IdCarta | null;
  furto: Record<IdGiocatore, number>;
  guaio: IdCarta | null;
}

export type Esito = { tipo: 'mossa'; azione: Azione } | { tipo: 'risponde'; chi: IdGiocatore } | { tipo: 'indietro' };

export interface Momento {
  /** Vista di chi agisce (con la sua mano) per le schermate private; del tavolo per le altre. */
  vista: Vista;
  schermo: Scena | ScenaProva;
  /** Mosse permesse a chi agisce. */
  azioni: Azione[];
  /** Mosse permesse al sistema (prosegui, scadenza). */
  sistema: Azione[];
  /** Dispositivo condiviso: "Annulla" torna a "Chi risponde?". Falso nella prova. */
  condiviso: boolean;
  /** La fotografia ha la mano scoperta (regola anti-sbirciata). */
  manoScoperta: boolean;
}

export interface Pensiero {
  titolo?: string;
  testo: string;
  pulsanti: Array<{ testo: string; secondario?: boolean; azione: () => void }>;
}
