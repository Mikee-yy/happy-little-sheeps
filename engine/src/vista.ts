// Vista per giocatore senza informazioni nascoste (sezione 10).
import { inAttesaDi } from './attesa';
import type { Evento, IdGiocatore, Stato, Vista, VistaFase } from './tipi';

/** Valore di `per` solo se è una chiave propria: per chi è fuori dal round, o per un id come "toString", undefined. */
function mioValore<T>(scelte: Record<IdGiocatore, T>, per: IdGiocatore | null): T | undefined {
  return per !== null && Object.hasOwn(scelte, per) ? scelte[per] : undefined;
}

function vistaFase(stato: Stato, per: IdGiocatore | null): VistaFase {
  const f = stato.fase;
  if (f.nome === 'scelta') {
    const haScelto = Object.fromEntries(Object.entries(f.scelte).map(([id, c]) => [id, c !== null]));
    const mia = mioValore(f.scelte, per);
    return { nome: 'scelta', haScelto, miaScelta: mia ? [...mia] : null };
  }
  if (f.nome === 'belato_finale') {
    const haScelto = Object.fromEntries(f.partecipanti.map((id) => [id, !!f.scelte[id]]));
    const mia = mioValore(f.scelte, per);
    return {
      nome: 'belato_finale',
      partecipanti: [...f.partecipanti],
      haScelto,
      miaScelta: mia ?? null,
      storico: structuredClone(f.storico),
    };
  }
  return structuredClone(f);
}

function vistaEvento(e: Evento, per: IdGiocatore | null): Evento {
  if (e.tipo === 'pescate' && e.giocatore !== per) {
    const { carte: _segrete, ...pubblico } = e;
    return { ...pubblico };
  }
  return structuredClone(e);
}

export function vistaPer(stato: Stato, per: IdGiocatore | null): Vista {
  const richiesta = stato.richiesta
    ? stato.richiesta.tipo === 'guarda_due' && stato.richiesta.giocatore !== per
      ? { ...stato.richiesta, carte: [] }
      : structuredClone(stato.richiesta)
    : null;
  return {
    per,
    config: structuredClone(stato.config),
    giocatori: stato.giocatori.map((g) => ({
      id: g.id,
      nome: g.nome,
      pecora: g.pecora,
      mano: per !== null && g.id === per ? [...g.mano] : null,
      carteInMano: g.mano.length,
      agnellini: g.agnellini,
      angolo: [...g.angolo],
      eliminato: g.eliminato,
    })),
    gregge: stato.gregge,
    carteNelMazzo: stato.mazzo.length,
    scarti: [...stato.scarti],
    carteNelMazzoGuai: stato.mazzoGuai.length,
    guaiFuoriGioco: [...stato.guaiFuoriGioco],
    round: stato.round,
    primoGiocatore: stato.primoGiocatore,
    ultimoRound: stato.ultimoRound,
    fase: vistaFase(stato, per),
    datiRound: structuredClone(stato.datiRound),
    pila: structuredClone(stato.pila),
    finestra: structuredClone(stato.finestra),
    richiesta,
    esito: structuredClone(stato.esito),
    eventi: stato.eventi.map((e) => vistaEvento(e, per)),
    attesa: inAttesaDi(stato),
  };
}
