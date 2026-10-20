// Dalla vista a frasi leggibili: nomi, carte, voci della pila, eventi della cronaca, avvisi.
import { angoloElimina, defCarta } from '../../../engine/src';
import type {
  DefCarta,
  Evento,
  IdCarta,
  IdGiocatore,
  RigaPunteggio,
  TipoGuaioCarta,
  VistaGiocatore,
  Vista,
  VocePila,
} from '../../../engine/src';
import { elenco, T } from '../testi';

export const giocatoreDi = (v: Vista, id: IdGiocatore): VistaGiocatore => {
  const g = v.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} sconosciuto`);
  return g;
};
export const nome = (v: Vista, id: IdGiocatore): string => v.giocatori.find((g) => g.id === id)?.nome ?? id;
export const nomi = (v: Vista, ids: IdGiocatore[]): string => elenco(ids.map((id) => nome(v, id)));

export const carta = (c: IdCarta): DefCarta => defCarta(c);
export const nomeCarta = (c: IdCarta): string => defCarta(c).nome;
export const valoreCarta = (c: IdCarta): number => {
  const d = defCarta(c);
  return d.famiglia === 'trovata' ? d.valore : 0;
};
export const tipoGuaio = (c: IdCarta): TipoGuaioCarta => {
  const d = defCarta(c);
  return d.famiglia === 'guaio' ? d.tipo : 'tosatura';
};

export const totaleRighe = (righe: RigaPunteggio[] | undefined): number => (righe ?? []).reduce((t, r) => t + r.delta, 0);
export const totaleDi = (v: Vista, id: IdGiocatore): number => totaleRighe(v.datiRound.punteggi[id]);

/** Tipi di Guaio che, aggiunti all'Angolo, eliminerebbero il giocatore (vuoto: non è a rischio). */
export function tipiPericolosi(v: Vista, id: IdGiocatore): TipoGuaioCarta[] {
  const g = giocatoreDi(v, id);
  if (g.eliminato) return [];
  const tipi = g.angolo.map(tipoGuaio);
  return (['meteo', 'predatori', 'drammi', 'tosatura'] as TipoGuaioCarta[]).filter((t) =>
    angoloElimina([...tipi, t], v.config.regoleEliminazione),
  );
}

/** Agnellini che mancano per riempire l'Ovile. */
export const mancanti = (v: Vista, id: IdGiocatore): number => v.config.postiOvile - giocatoreDi(v, id).agnellini;

/** Un avviso per chi ha il dispositivo: titolo e testo (il pannello li mostra su due righe). */
export interface DatiAvviso {
  tipo: 'pericolo' | 'vittoria';
  titolo: string;
  testo: string;
}

/** Gli avvisi di un giocatore: un Guaio all'eliminazione, pochi agnellini alla vittoria. Vuoti se è eliminato. */
export function datiAvvisi(v: Vista, id: IdGiocatore): DatiAvviso[] {
  if (giocatoreDi(v, id).eliminato) return [];
  const avvisi: DatiAvviso[] = [];
  const pericolosi = tipiPericolosi(v, id);
  if (pericolosi.length > 0) {
    avvisi.push({
      tipo: 'pericolo',
      titolo: T.avvisi.pericoloTitolo,
      testo: T.avvisi.pericolo(elenco(pericolosi.map((t) => T.tipiGuaio[t]))),
    });
  }
  const mancano = mancanti(v, id);
  if (mancano <= 3) avvisi.push({ tipo: 'vittoria', titolo: T.avvisi.vittoriaTitolo(mancano), testo: T.avvisi.vittoria });
  return avvisi;
}

/** Gli stessi avvisi come frasi, per la scritta in alto della scena ("Titolo. Testo."). */
export const avvisiDi = (v: Vista, id: IdGiocatore): string[] => datiAvvisi(v, id).map((a) => `${a.titolo}. ${a.testo}`);

const segno = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** Cosa sta per succedere: testo della finestra di reazione. */
export function descriviVoce(v: Vista, voce: VocePila): string {
  const chi = nome(v, voce.autore);
  const d = voce.dettagli;
  switch (d.tipo) {
    case 'effetto_trovata': {
      const testo = (defCarta(d.carta) as { testo: string }).testo;
      const bersaglio = d.bersaglio ? ` (contro ${nome(v, d.bersaglio)})` : '';
      return `${chi} usa ${nomeCarta(d.carta)}: ${testo}${bersaglio}`;
    }
    case 'belato': {
      if (d.effetto === 'beee_no') {
        const sotto = v.pila.find((x) => x.id === d.voceBersaglio);
        return `${chi} gioca Beee-NO! contro ${sotto ? nome(v, sotto.autore) : 'la mossa precedente'}`;
      }
      if (d.effetto === 'modifica_punteggio') {
        const def = defCarta(d.carta);
        const valore = (def.famiglia === 'belato' ? def.valore ?? 0 : 0) * (v.datiRound.raddoppioBelati ? 2 : 1);
        return `${chi} gioca ${def.nome}: ${segno(valore)} a ${nome(v, d.bersaglio ?? '')}`;
      }
      if (d.effetto === 'devia_guaio') return `${chi} gioca ${nomeCarta(d.carta)}: il Guaio va a ${nome(v, d.bersaglio ?? '')}`;
      if (d.effetto === 'cura') return `${chi} gioca ${nomeCarta(d.carta)}: toglie ${d.guaio ? nomeCarta(d.guaio) : 'un Guaio'}`;
      return `${chi} gioca ${nomeCarta(d.carta)}: ${(defCarta(d.carta) as { testo: string }).testo}`;
    }
    case 'dado': {
      const dich = d.dichiarazione;
      if (dich.effetto === 'pascolo') return `${chi}: ${T.dado.facce[d.faccia]} → prende ${dich.quantita} agnellini dal Gregge`;
      if (dich.effetto === 'furto') {
        const parti = Object.entries(dich.daAvversari).map(([id, q]) => `${q} a ${nome(v, id)}`);
        if (dich.dalGregge > 0) parti.push(`${dich.dalGregge} dal Gregge`);
        return `${chi}: ${T.dado.facce[d.faccia]} → ${elenco(parti)}`;
      }
      return `${chi}: Testata del Montone contro l'Ovile di ${nome(v, dich.bersaglio)}`;
    }
  }
}

/** Una riga di cronaca per evento; null per gli eventi che non serve raccontare. */
export function descriviEvento(v: Vista, e: Evento): string | null {
  switch (e.tipo) {
    case 'round_iniziato':
      return e.ultimo ? `Inizia il round ${e.round}: è l'ultimo!` : `Inizia il round ${e.round}.`;
    case 'guaio_rivelato':
      return e.carta ? `Guaio del round: ${nomeCarta(e.carta)} (${T.tipiGuaio[tipoGuaio(e.carta)]}).` : 'Nessun Guaio questo round.';
    case 'guai_rimescolati':
      return `Il mazzo Guai era finito: si rimescolano ${e.quanti} Guai.`;
    case 'ripescata':
      return `${nome(v, e.giocatore)} non aveva Trovate: scarta ${e.scartate} carte e ne pesca ${e.pescate}.`;
    case 'fuori_dal_round':
      return `${nome(v, e.giocatore)} non ha Trovate e salta il round.`;
    case 'dado_lanciato':
      return `${nome(v, e.giocatore)} lancia il dado: ${T.dado.facce[e.faccia] ?? e.faccia}.`;
    case 'annullata': {
      const da = v.eventi.find((x) => x.tipo === 'dichiarazione' && x.voce === e.da);
      return da && da.tipo === 'dichiarazione' ? `Beee-NO! di ${nome(v, da.autore)}: annullato!` : 'Annullato da un Beee-NO!';
    }
    case 'agnellini': {
      const da = e.da === 'gregge' ? 'dal Gregge' : `da ${nome(v, e.da)}`;
      const a = e.a === 'gregge' ? 'nel Gregge' : `a ${nome(v, e.a)}`;
      return `${e.quanti} ${e.quanti === 1 ? 'agnellino' : 'agnellini'} ${da} ${a}.`;
    }
    case 'testata':
      return `Testata sull'Ovile di ${nome(v, e.bersaglio)}: ${T.testata.risultato(e.esito)}`;
    case 'belato_finale':
      return `Belato Finale: ${Object.entries(e.rivelate).map(([id, c]) => `${nome(v, id)} ${valoreCarta(c)}`).join(', ')}.`;
    case 'guaio_preso':
      return `${nome(v, e.giocatore)} prende ${nomeCarta(e.carta)}.`;
    case 'guaio_in_fondo':
      return T.guai.inFondo;
    case 'guaio_deviato':
      return `${nome(v, e.da)} passa il Guaio a ${nome(v, e.a)}!`;
    case 'guaio_curato':
      return `Garzina cura ${nome(v, e.giocatore)}: via ${nomeCarta(e.carta)}.`;
    case 'eliminato':
      return `${nome(v, e.giocatore)} è eliminata!`;
    case 'ultimo_round_annunciato':
      return `Il mazzo è finito: il round ${e.round} sarà l'ultimo.`;
    case 'scartate':
      return e.causa === 'ripescata' ? null : `${nome(v, e.giocatore)} scarta ${e.carte.map(nomeCarta).join(', ')}.`;
    default:
      return null;
  }
}
