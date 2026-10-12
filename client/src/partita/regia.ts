// Regia della modalità "Passa il telefono": dalla vista del tavolo decide quale schermata mostrare,
// chi deve agire e se la schermata è privata (serve passare il dispositivo) o pubblica.
import type { IdGiocatore, NomeFase, Vista } from '../../../engine/src';

export type PannelloPrivato =
  | 'scelta'
  | 'effetto'
  | 'richiesta'
  | 'reazione'
  | 'punteggio'
  | 'belato_finale'
  | 'salvataggio'
  | 'consolazione';

export type Scena =
  | { tipo: 'fine' }
  | { tipo: 'automatica'; fase: NomeFase }
  /** Domanda a tutti ("Qualcuno gioca…?"): chi vuole tocca il proprio nome. */
  | { tipo: 'domanda'; contesto: 'reazione' | 'punteggio'; candidati: IdGiocatore[] }
  | { tipo: 'privata'; giocatore: IdGiocatore; pannello: PannelloPrivato }
  | { tipo: 'pubblica'; giocatore: IdGiocatore; pannello: 'lancio' | 'dichiarazione' | 'testata' };

/** Primo giocatore della lista in ordine di posto a partire dal primo giocatore del round. */
function primoInOrdine(v: Vista, ids: IdGiocatore[]): IdGiocatore | undefined {
  const posti = v.giocatori.map((g) => g.id);
  const inizio = Math.max(0, posti.indexOf(v.primoGiocatore));
  const ordine = [...posti.slice(inizio), ...posti.slice(0, inizio)];
  return ordine.find((id) => ids.includes(id));
}

/**
 * @param v vista del tavolo (nessuna mano)
 * @param scelto chi ha toccato il proprio nome in una scena "domanda", se c'è
 */
export function scena(v: Vista, scelto: IdGiocatore | null): Scena {
  if (v.esito || v.fase.nome === 'fine_partita') return { tipo: 'fine' };
  const attesa = v.attesa;
  if (attesa.sistema && attesa.giocatori.length === 0) return { tipo: 'automatica', fase: v.fase.nome };

  if (v.richiesta) return { tipo: 'privata', giocatore: v.richiesta.giocatore, pannello: 'richiesta' };

  if (v.finestra) {
    const candidati = v.finestra.inAttesa;
    if (scelto && candidati.includes(scelto)) return { tipo: 'privata', giocatore: scelto, pannello: 'reazione' };
    return { tipo: 'domanda', contesto: 'reazione', candidati };
  }

  const primo = primoInOrdine(v, attesa.giocatori) ?? attesa.giocatori[0];
  const f = v.fase;
  switch (f.nome) {
    case 'scelta':
      return { tipo: 'privata', giocatore: primo!, pannello: 'scelta' };
    case 'effetti':
      return { tipo: 'privata', giocatore: primo!, pannello: 'effetto' };
    case 'belati_punteggio':
      if (scelto && f.inAttesa.includes(scelto)) return { tipo: 'privata', giocatore: scelto, pannello: 'punteggio' };
      return { tipo: 'domanda', contesto: 'punteggio', candidati: f.inAttesa };
    case 'dado':
      return { tipo: 'pubblica', giocatore: primo!, pannello: 'lancio' };
    case 'risoluzione_dado':
      return { tipo: 'pubblica', giocatore: f.lanciatore, pannello: f.passo === 'esito_testata' ? 'testata' : 'dichiarazione' };
    case 'belato_finale':
      return { tipo: 'privata', giocatore: primo!, pannello: 'belato_finale' };
    case 'belati_salvataggio':
      return { tipo: 'privata', giocatore: f.destinatario, pannello: 'salvataggio' };
    case 'consolazione':
      return { tipo: 'privata', giocatore: f.destinatario, pannello: 'consolazione' };
    default:
      return { tipo: 'automatica', fase: f.nome };
  }
}
