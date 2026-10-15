// Guida della partita di prova: dalla vista della partita decide quale consiglio mostrare.
// Ogni consiglio compare una volta sola, la prima volta che capita il suo momento, nell'ordine dei testi.
import { CATALOGO, defCarta } from '../../../engine/src';
import type { Azione, IdGiocatore, Vista } from '../../../engine/src';

export type IdConsiglio =
  | 'inizio'
  | 'guaio'
  | 'tratto'
  | 'scelta'
  | 'gemelle'
  | 'rivelazione'
  | 'belatoPunteggio'
  | 'tuoDado'
  | 'pascolo'
  | 'furto'
  | 'beeeNo'
  | 'testata'
  | 'guaioTuo'
  | 'guaioBot'
  | 'fineRound';

type Momento = (v: Vista, umano: IdGiocatore, azioni: Azione[]) => boolean;

const evento = (v: Vista, tipo: string) => v.eventi.some((e) => e.tipo === tipo);
const inAttesa = (v: Vista, umano: IdGiocatore) => v.attesa.giocatori.includes(umano);
/** Effetto della faccia uscita in un tiro: pascolo, furto o testata. */
const tirato = (v: Vista, effetto: string) =>
  v.eventi.some((e) => e.tipo === 'dado_lanciato' && v.config.dado.find((f) => f.id === e.faccia)?.effetto === effetto);
const guaioPreso = (v: Vista, diUmano: boolean, umano: IdGiocatore) =>
  v.eventi.some((e) => e.tipo === 'guaio_preso' && (e.giocatore === umano) === diUmano);
const belatoGiocabile = (azioni: Azione[], filtro: (tipo: string) => boolean) =>
  azioni.some((a) => a.tipo === 'giocaBelato' && filtro(defCarta(a.carta).id));

/** I momenti, nell'ordine dei testi 1–15 del progetto. */
const MOMENTI: Array<[IdConsiglio, Momento]> = [
  ['inizio', () => true],
  ['guaio', (v) => v.eventi.some((e) => e.tipo === 'guaio_rivelato' && e.carta !== null)],
  [
    'tratto',
    (v, umano) => {
      const guaio = v.datiRound.guaio;
      const pecora = v.giocatori.find((g) => g.id === umano)?.pecora;
      if (!guaio || !pecora) return false;
      const tipo = (defCarta(guaio) as { tipo?: string }).tipo;
      const def = CATALOGO.pecore[pecora];
      return tipo === def.bonus || tipo === def.malus;
    },
  ],
  ['scelta', (v, umano) => v.fase.nome === 'scelta' && inAttesa(v, umano)],
  [
    'gemelle',
    (v, umano) =>
      v.fase.nome === 'scelta' &&
      inAttesa(v, umano) &&
      (v.giocatori.find((g) => g.id === umano)?.mano ?? []).filter((c) => (defCarta(c) as { gemella?: boolean }).gemella).length >= 2,
  ],
  ['rivelazione', (v) => evento(v, 'rivelazione')],
  ['belatoPunteggio', (v, _u, azioni) => v.fase.nome === 'belati_punteggio' && belatoGiocabile(azioni, () => true)],
  ['tuoDado', (v, umano, azioni) => v.fase.nome === 'dado' && azioni.some((a) => a.tipo === 'lanciaDado' && a.giocatore === umano)],
  ['pascolo', (v) => tirato(v, 'pascolo')],
  ['furto', (v) => tirato(v, 'furto')],
  // Solo con un tiro di dado in cima alla pila: è lì che il Beee-NO! della prova serve (il Furto del round 2)
  [
    'beeeNo',
    (v, umano, azioni) =>
      !!v.finestra?.inAttesa.includes(umano) && v.pila[v.pila.length - 1]?.dettagli.tipo === 'dado' && belatoGiocabile(azioni, (id) => id === 'beee-no'),
  ],
  ['testata', (v) => tirato(v, 'testata')],
  ['guaioTuo', (v, umano) => guaioPreso(v, true, umano)],
  ['guaioBot', (v, umano) => guaioPreso(v, false, umano)],
  ['fineRound', (v) => v.eventi.some((e) => e.tipo === 'round_iniziato' && e.round >= 2)],
];

export function prossimoConsiglio(v: Vista, umano: IdGiocatore, azioni: Azione[], visti: ReadonlySet<IdConsiglio>): IdConsiglio | null {
  for (const [id, momento] of MOMENTI) if (!visti.has(id) && momento(v, umano, azioni)) return id;
  return null;
}

/** Finiti i tre round guidati (ed è iniziato il quarto), se la partita non è già finita. */
export function provaGuidataFinita(v: Vista): boolean {
  return !v.esito && v.eventi.some((e) => e.tipo === 'round_iniziato' && e.round >= 4);
}
