// Chi deve agire (sezione 11) e quali azioni sono valide (sezione 2). Funzioni pure.
import { trovaGiocatore } from './comune';
import { defBelato, defTrovata, eTrovata, tipoDi } from './dati';
import { bersagliTestata, faccia, lanciatoreCorrente, massimoEsitoTestata, ripartizioniFurto } from './dado';
import { bersagliSposta, voceCorrente } from './effetti';
import { bersagliDeviazione } from './guai';
import type { Attesa, Azione, EffettoBelato, IdCarta, IdGiocatore, NomeFase, Richiesta, Stato } from './tipi';

const FASI_AUTOMATICHE: NomeFase[] = ['guaio', 'rivelazione', 'guaio_al_peggiore', 'fine_round', 'ultimo_round'];

export function eFaseAutomatica(nome: NomeFase): boolean {
  return FASI_AUTOMATICHE.includes(nome);
}

export function inAttesaDi(stato: Stato): Attesa {
  const nessuno: Attesa = { sistema: false, giocatori: [] };
  if (stato.esito != null || stato.fase.nome === 'fine_partita') return nessuno;
  if (stato.richiesta) return { sistema: false, giocatori: [stato.richiesta.giocatore] };
  if (stato.finestra) return { sistema: false, giocatori: [...stato.finestra.inAttesa] };
  const f = stato.fase;
  if (eFaseAutomatica(f.nome)) return { sistema: true, giocatori: [] };
  switch (f.nome) {
    case 'scelta':
      return { sistema: false, giocatori: Object.keys(f.scelte).filter((id) => f.scelte[id] === null) };
    case 'belato_finale':
      return { sistema: false, giocatori: f.partecipanti.filter((id) => !f.scelte[id]) };
    case 'effetti': {
      const v = voceCorrente(stato);
      return { sistema: false, giocatori: v ? [v.giocatore] : [] };
    }
    case 'belati_punteggio':
      return { sistema: false, giocatori: [...f.inAttesa] };
    case 'dado': {
      const l = lanciatoreCorrente(stato);
      return { sistema: false, giocatori: l ? [l] : [] };
    }
    case 'risoluzione_dado':
      return f.passo === 'reazione' ? nessuno : { sistema: false, giocatori: [f.lanciatore] };
    case 'belati_salvataggio':
    case 'consolazione':
      return { sistema: false, giocatori: [f.destinatario] };
    default:
      return nessuno;
  }
}

/** Una istanza per tipo, nell'ordine della mano. */
function unaPerTipo(carte: IdCarta[]): IdCarta[] {
  const visti = new Set<string>();
  return carte.filter((c) => {
    const t = tipoDi(c);
    if (visti.has(t)) return false;
    visti.add(t);
    return true;
  });
}

function belatiInMano(mano: IdCarta[], effetti: EffettoBelato[]): IdCarta[] {
  return unaPerTipo(mano.filter((c) => {
    const def = defBelato(c);
    return def !== null && effetti.includes(def.effetto);
  }));
}

function sottoinsiemi(carte: IdCarta[], massimo: number): IdCarta[][] {
  const risultati: IdCarta[][] = [];
  const visita = (inizio: number, parziale: IdCarta[]): void => {
    risultati.push([...parziale]);
    if (parziale.length === massimo) return;
    for (let i = inizio; i < carte.length; i++) visita(i + 1, [...parziale, carte[i] as IdCarta]);
  };
  visita(0, []);
  return risultati;
}

function opzioniRichiesta(stato: Stato, r: Richiesta): Azione[] {
  const g = trovaGiocatore(stato, r.giocatore);
  if (!g) return [];
  const completa = (carte: IdCarta[]): Azione => ({ tipo: 'completaEffetto', giocatore: g.id, carte });
  switch (r.tipo) {
    case 'scarta_e_somma':
      return unaPerTipo(g.mano.filter(eTrovata)).map((c) => completa([c]));
    case 'scarta_fino_a_tre':
      return sottoinsiemi(g.mano, 3).map(completa);
    case 'guarda_due':
      return r.carte.map((c) => completa([c]));
  }
}

function azioniSistema(stato: Stato): Azione[] {
  if (stato.esito != null || stato.fase.nome === 'fine_partita' || stato.richiesta) return [];
  if (stato.finestra) return [{ tipo: 'scadenza' }];
  if (stato.pila.length > 0) return [];
  if (eFaseAutomatica(stato.fase.nome)) return [{ tipo: 'prosegui' }];
  if (stato.fase.nome === 'belati_punteggio') return [{ tipo: 'scadenza' }];
  return [];
}

export function azioniPossibili(stato: Stato, chi: IdGiocatore | 'sistema'): Azione[] {
  if (chi === 'sistema') return azioniSistema(stato);
  const g = trovaGiocatore(stato, chi);
  if (!g || g.eliminato || stato.esito != null || stato.fase.nome === 'fine_partita') return [];
  const id = g.id;
  if (stato.richiesta) return stato.richiesta.giocatore === id ? opzioniRichiesta(stato, stato.richiesta) : [];
  if (stato.pila.length > 0) {
    const f = stato.finestra;
    if (!f || !f.inAttesa.includes(id)) return [];
    const azioni: Azione[] = [{ tipo: 'passa', giocatore: id, voce: f.voce }];
    for (const carta of belatiInMano(g.mano, ['beee_no'])) {
      azioni.push({ tipo: 'giocaBelato', giocatore: id, carta, voce: f.voce });
    }
    return azioni;
  }

  const fase = stato.fase;
  const azioni: Azione[] = [];
  switch (fase.nome) {
    case 'scelta': {
      if (!Object.hasOwn(fase.scelte, id)) break;
      const trovate = unaPerTipo(g.mano.filter(eTrovata));
      for (const c of trovate) azioni.push({ tipo: 'scegliTrovata', giocatore: id, carte: [c] });
      const gemelle = g.mano.filter((c) => eTrovata(c) && defTrovata(c).gemella);
      const coppie = new Set<string>();
      for (let i = 0; i < gemelle.length; i++) {
        for (let j = i + 1; j < gemelle.length; j++) {
          const a = gemelle[i] as IdCarta;
          const b = gemelle[j] as IdCarta;
          const chiave = [tipoDi(a), tipoDi(b)].sort().join('+');
          if (coppie.has(chiave)) continue;
          coppie.add(chiave);
          azioni.push({ tipo: 'scegliTrovata', giocatore: id, carte: [a, b] });
        }
      }
      break;
    }
    case 'effetti': {
      const v = voceCorrente(stato);
      if (!v || v.giocatore !== id) break;
      azioni.push({ tipo: 'rinunciaEffetto', giocatore: id, carta: v.carta });
      if (v.effetto === 'sposta_agnellino') {
        for (const b of bersagliSposta(stato, id)) {
          azioni.push({ tipo: 'attivaEffetto', giocatore: id, carta: v.carta, bersaglio: b });
        }
      } else {
        azioni.push({ tipo: 'attivaEffetto', giocatore: id, carta: v.carta });
      }
      break;
    }
    case 'belati_punteggio': {
      if (fase.inAttesa.includes(id)) azioni.push({ tipo: 'passa', giocatore: id, voce: null });
      for (const carta of belatiInMano(g.mano, ['modifica_punteggio'])) {
        for (const b of stato.datiRound.partecipanti) {
          azioni.push({ tipo: 'giocaBelato', giocatore: id, carta, bersaglio: b });
        }
      }
      for (const carta of belatiInMano(g.mano, ['scambia_punteggi'])) {
        azioni.push({ tipo: 'giocaBelato', giocatore: id, carta });
      }
      break;
    }
    case 'dado':
      if (lanciatoreCorrente(stato) === id) azioni.push({ tipo: 'lanciaDado', giocatore: id });
      break;
    case 'risoluzione_dado': {
      if (fase.lanciatore !== id) break;
      const uscita = faccia(stato, fase.faccia);
      if (fase.passo === 'dichiarazione') {
        if (uscita.effetto === 'furto') {
          for (const furto of ripartizioniFurto(stato, id, uscita.quantita)) {
            azioni.push({ tipo: 'dichiaraDado', giocatore: id, furto });
          }
        } else if (uscita.effetto === 'testata') {
          for (const b of bersagliTestata(stato, id)) azioni.push({ tipo: 'dichiaraDado', giocatore: id, bersaglio: b });
        }
      } else if (fase.passo === 'esito_testata') {
        for (let e = 0; e <= massimoEsitoTestata(stato); e++) azioni.push({ tipo: 'esitoTestata', giocatore: id, esito: e });
      }
      break;
    }
    case 'belato_finale':
      if (!fase.partecipanti.includes(id)) break;
      for (const c of unaPerTipo(g.mano.filter(eTrovata))) azioni.push({ tipo: 'sceltaFinale', giocatore: id, carta: c });
      break;
    case 'belati_salvataggio':
      if (fase.destinatario !== id) break;
      azioni.push({ tipo: 'passa', giocatore: id, voce: null });
      for (const carta of belatiInMano(g.mano, ['guaio_in_fondo'])) azioni.push({ tipo: 'giocaBelato', giocatore: id, carta });
      for (const carta of belatiInMano(g.mano, ['devia_guaio'])) {
        for (const b of bersagliDeviazione(stato, id)) azioni.push({ tipo: 'giocaBelato', giocatore: id, carta, bersaglio: b });
      }
      break;
    case 'consolazione':
      if (fase.destinatario !== id) break;
      azioni.push({ tipo: 'concludiConsolazione', giocatore: id, scarta: null });
      for (const c of unaPerTipo(g.mano)) azioni.push({ tipo: 'concludiConsolazione', giocatore: id, scarta: c });
      for (const carta of belatiInMano(g.mano, ['cura'])) {
        for (const guaio of g.angolo) azioni.push({ tipo: 'giocaBelato', giocatore: id, carta, guaio });
      }
      break;
    default:
      break;
  }
  return azioni;
}
