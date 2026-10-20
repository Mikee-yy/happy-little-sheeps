// Regia a più dispositivi: ogni dispositivo è un solo giocatore e vede sempre la propria mano.
// Decide il pannello dalle azioni che il giocatore può fare adesso; se non ne ha, mostra chi si aspetta.
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';
import { nome, nomi } from '../partita/descrizioni';
import type { PannelloPrivato } from '../partita/regia';
import type { Momento } from '../scena/scelte/tipi';
import { T } from '../testi';

export type ScenaRemota =
  | { tipo: 'fine' }
  | { tipo: 'automatica' }
  | { tipo: 'pannello'; pannello: PannelloPrivato | 'lancio' | 'dichiarazione' | 'testata' }
  /** Nessuna azione per me: si aspetta qualcun altro (o la fine di una finestra di reazione). */
  | { tipo: 'attesa'; di: IdGiocatore[]; finestra: boolean };

export function scenaRemota(v: Vista, io: IdGiocatore, azioni: Azione[]): ScenaRemota {
  if (v.esito || v.fase.nome === 'fine_partita') return { tipo: 'fine' };
  const attesa = v.attesa;
  if (attesa.sistema && attesa.giocatori.length === 0) return { tipo: 'automatica' };
  const finestraAperta = !!v.finestra || (v.fase.nome === 'belati_punteggio' && v.pila.length === 0);

  if (azioni.length > 0) {
    if (v.richiesta?.giocatore === io) return { tipo: 'pannello', pannello: 'richiesta' };
    if (v.finestra) return { tipo: 'pannello', pannello: 'reazione' };
    const f = v.fase;
    switch (f.nome) {
      case 'scelta':
        return { tipo: 'pannello', pannello: 'scelta' };
      case 'effetti':
        return { tipo: 'pannello', pannello: 'effetto' };
      case 'belati_punteggio':
        // Chi ha già passato può ancora giocare un Belato, ma non deve restare bloccato sul pannello.
        return f.inAttesa.includes(io) ? { tipo: 'pannello', pannello: 'punteggio' } : { tipo: 'attesa', di: f.inAttesa, finestra: true };
      case 'dado':
        return { tipo: 'pannello', pannello: 'lancio' };
      case 'risoluzione_dado':
        return { tipo: 'pannello', pannello: f.passo === 'esito_testata' ? 'testata' : 'dichiarazione' };
      case 'belato_finale':
        return { tipo: 'pannello', pannello: 'belato_finale' };
      case 'belati_salvataggio':
        return { tipo: 'pannello', pannello: 'salvataggio' };
      case 'consolazione':
        return { tipo: 'pannello', pannello: 'consolazione' };
      default:
        break;
    }
  }
  return { tipo: 'attesa', di: attesa.giocatori.filter((g) => g !== io), finestra: finestraAperta };
}

/**
 * Il momento delle domande per il telefono di `io`; null quando si aspetta qualcun altro o la partita è finita.
 * In stanza lo schermo è sempre quello di `io` (condiviso: falso, mano scoperta, niente mosse del sistema):
 * le fasi automatiche le fa avanzare chi ospita, quindi non hanno domanda.
 * @param vistaIo vista privata di `io` (con la sua mano), per gli schermi privati
 * @param tavolo vista del tavolo, per gli schermi pubblici
 */
export function momentoRemoto(sc: ScenaRemota, io: IdGiocatore, vistaIo: Vista, tavolo: Vista, azioni: Azione[]): Momento | null {
  if (sc.tipo !== 'pannello') return null;
  const base = { azioni, sistema: [], condiviso: false, manoScoperta: true };
  const p = sc.pannello;
  if (p === 'lancio' || p === 'dichiarazione' || p === 'testata') {
    return { ...base, vista: tavolo, schermo: { tipo: 'pubblica', giocatore: io, pannello: p } };
  }
  return { ...base, vista: vistaIo, schermo: { tipo: 'privata', giocatore: io, pannello: p } };
}

/** Testo della striscia quando si aspetta (gli stessi di prima): vuoto per gli schermi che non sono d'attesa. */
export function scrittaAttesa(sc: ScenaRemota, tavolo: Vista): string {
  if (sc.tipo !== 'attesa') return '';
  const f = tavolo.fase;
  if (sc.finestra) return T.stanza.attesaReazioni;
  if (f.nome === 'scelta' || f.nome === 'belato_finale') return T.stanza.attesaScelte;
  if (f.nome === 'risoluzione_dado' && f.passo === 'esito_testata' && f.dichiarazione?.effetto === 'testata') {
    return T.stanza.testataDi(nome(tavolo, f.lanciatore), nome(tavolo, f.dichiarazione.bersaglio));
  }
  if (f.nome === 'dado') return T.stanza.lancioDi(nomi(tavolo, sc.di));
  return T.stanza.attesaDi(nomi(tavolo, sc.di));
}
