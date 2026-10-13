// Ingresso unico delle azioni: copia lo stato, smista l'azione, gestisce la fine partita.
import { errore, giocatoreAttivo, InterruzioneFinePartita, richiediInMano } from './comune';
import { defBelato } from './dati';
import { dichiaraDado, esitoTestata, lanciaDado } from './dado';
import { attivaEffetto, completaEffetto, rinunciaEffetto } from './effetti';
import { concludiConsolazione, giocaBelatoSalvataggio, giocaCura, passaSalvataggio, sceltaFinale } from './guai';
import { prosegui, scegliTrovata } from './partita';
import { giocaBeeeNo, passaInFinestra, scadenzaFinestra } from './pila';
import { giocaBelatoPunteggio, chiudiPunteggio, passaPunteggio } from './punteggio';
import type { Azione, Stato } from './tipi';
import { ErroreRegola } from './tipi';

export function applica(stato: Stato, azione: Azione): Stato {
  if (stato.esito != null || stato.fase.nome === 'fine_partita') errore('partita_finita', 'La partita è finita');
  if (!azione || typeof azione !== 'object' || typeof azione.tipo !== 'string') {
    errore('azione_sconosciuta', 'Azione non riconosciuta');
  }
  const s = structuredClone(stato);
  try {
    esegui(s, azione);
  } catch (e) {
    if (e instanceof InterruzioneFinePartita) return s;
    throw e;
  }
  return s;
}

export function tentaApplica(
  stato: Stato,
  azione: Azione,
): { ok: true; stato: Stato } | { ok: false; errore: ErroreRegola } {
  try {
    return { ok: true, stato: applica(stato, azione) };
  } catch (e) {
    if (e instanceof ErroreRegola) return { ok: false, errore: e };
    throw e;
  }
}

function esegui(s: Stato, a: Azione): void {
  switch (a.tipo) {
    case 'prosegui':
      prosegui(s);
      return;
    case 'scadenza':
      if (s.richiesta) errore('richiesta_in_corso', 'Un giocatore deve completare un effetto');
      if (s.finestra) scadenzaFinestra(s);
      else if (s.fase.nome === 'belati_punteggio' && s.pila.length === 0) chiudiPunteggio(s);
      else errore('fase_errata', 'Nessuna finestra da chiudere');
      return;
    case 'passa':
      giocatoreAttivo(s, a.giocatore);
      if (s.richiesta) errore('richiesta_in_corso', 'Un giocatore deve completare un effetto');
      if (a.voce !== undefined && a.voce !== (s.finestra ? s.finestra.voce : null)) {
        errore('voce_non_in_cima', 'Ciò a cui rispondi non è più aperto');
      }
      if (s.finestra) passaInFinestra(s, a.giocatore);
      else if (s.fase.nome === 'belati_punteggio') passaPunteggio(s, a.giocatore);
      else if (s.fase.nome === 'belati_salvataggio') passaSalvataggio(s, a.giocatore);
      else errore('fase_errata', `Non si può passare nella fase ${s.fase.nome}`);
      return;
    case 'giocaBelato':
      giocaBelato(s, a);
      return;
    case 'completaEffetto':
      giocatoreAttivo(s, a.giocatore);
      completaEffetto(s, a);
      return;
    case 'scegliTrovata':
      scegliTrovata(s, a);
      return;
    case 'attivaEffetto':
      attivaEffetto(s, a);
      return;
    case 'rinunciaEffetto':
      rinunciaEffetto(s, a);
      return;
    case 'lanciaDado':
      lanciaDado(s, a);
      return;
    case 'dichiaraDado':
      dichiaraDado(s, a);
      return;
    case 'esitoTestata':
      esitoTestata(s, a);
      return;
    case 'sceltaFinale':
      sceltaFinale(s, a);
      return;
    case 'concludiConsolazione':
      concludiConsolazione(s, a);
      return;
    default:
      errore('azione_sconosciuta', `Azione sconosciuta: ${String((a as { tipo: unknown }).tipo)}`);
  }
}

function giocaBelato(s: Stato, a: Extract<Azione, { tipo: 'giocaBelato' }>): void {
  const g = giocatoreAttivo(s, a.giocatore);
  if (s.richiesta) errore('richiesta_in_corso', 'Un giocatore deve completare un effetto');
  const carta = richiediInMano(g, a.carta);
  const def = defBelato(carta);
  if (!def) errore('carta_non_valida', `${carta} non è un Belato`);
  // Parametri non previsti per questo Belato: rifiutati, come in attivaEffetto.
  const conBersaglio = def.effetto === 'modifica_punteggio' || def.effetto === 'devia_guaio';
  if (
    (a.bersaglio !== undefined && !conBersaglio) ||
    (a.voce !== undefined && def.effetto !== 'beee_no') ||
    (a.guaio !== undefined && def.effetto !== 'cura')
  ) {
    errore('scelta_non_valida', `Parametro non previsto per ${def.nome}`);
  }
  if (def.effetto === 'beee_no') {
    giocaBeeeNo(s, g.id, carta, a.voce);
    return;
  }
  if (s.pila.length > 0) errore('pila_non_vuota', 'Adesso si può rispondere solo con Beee-NO!');
  switch (def.effetto) {
    case 'modifica_punteggio':
    case 'scambia_punteggi':
      giocaBelatoPunteggio(s, g.id, carta, def, a.bersaglio);
      return;
    case 'guaio_in_fondo':
    case 'devia_guaio':
      giocaBelatoSalvataggio(s, g.id, carta, def, a.bersaglio);
      return;
    case 'cura':
      giocaCura(s, g.id, carta, a.guaio);
      return;
  }
}
