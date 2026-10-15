// Il pannello "Prova eventi" della pagina di sviluppo (bozza scena.src.html, righe 2641–2654 e 2696–2708).
// Solo sviluppo: i testi del pannello stanno qui, non in testi.ts (i giocatori non li vedono mai).
// Gli eventi chiedono le animazioni agli ordini del teatro senza toccare la partita: la fotografia successiva
// rimette la scena in pari con il motore. Niente regole finte: il ladro del furto è il posto dopo la vittima, non uno a caso.
import type { IdCarta, IdGiocatore } from '../../../../engine/src';
import { T } from '../../testi';
import type { Teatro } from '../teatro';

/** I testi del solo sviluppo (pagina e pannello). */
export const TESTI_SVILUPPO = {
  titolo: 'Scena: pagina di sviluppo',
  apriOpzioni: 'Opzioni',
  apriEventi: 'Prova eventi',
  aChi: 'A chi?',
  cosa: 'Cosa gli succede',
  furto: 'Gli rubano 2 agnellini',
  lupo: 'Prende il Lupo',
  meteo: 'Guai meteo',
  beeeNo: 'Gioca Beee-NO!',
  pascolo: 'Pascolo da 5',
  partita: 'Partita',
  giocatori: (n: number) => `${n} giocatori`,
  ricomincia: 'Ricomincia',
  passa: 'Passa il telefono',
  prossima: 'Prossima mossa',
  finita: 'Partita finita',
  recinti: 'Recinti',
  varianti: { base: 'base', A: 'A', B: 'B' } as Record<string, string>,
};

/** I Guai meteo del pannello (bozza, riga 2641). */
export const METEO_PROVA: Array<[IdCarta, string]> = [
  ['grandine-a-sorpresa', 'Grandine'],
  ['pioggia-di-traverso', 'Pioggia'],
  ['vento-dispettoso', 'Vento'],
  ['nebbia-fitta', 'Nebbia'],
  ['fulmine-curioso', 'Fulmine'],
  ['gelata-di-agosto', 'Gelata'],
  ['pozzanghera-senza-fondo', 'Pozzanghera'],
];
export const LUPO: IdCarta = 'lupo-vegetariano';

export type EventoProva = { tipo: 'furto' } | { tipo: 'guaio'; carta: IdCarta } | { tipo: 'beeeNo' } | { tipo: 'pascolo' };

/** Chi ruba a `chi`: il posto dopo il suo (bozza, riga 2527, senza il caso). */
export function ladroDi(chi: IdGiocatore, giocatori: IdGiocatore[]): IdGiocatore {
  const i = giocatori.indexOf(chi);
  return giocatori[(i + 1) % giocatori.length]!;
}

/** Esegue un evento del pannello su `chi` (bozza, righe 2702–2707). */
export function eseguiEvento(teatro: Teatro, ev: EventoProva, chi: IdGiocatore, giocatori: IdGiocatore[]): void {
  const { ordini } = teatro;
  const f = T.scena.fumetti;
  switch (ev.tipo) {
    case 'furto': {
      // Bozza, righe 2526–2531: fumetto e salto del ladro, poi dopo 400 ms gli agnellini corrono da lui
      const ladro = ladroDi(chi, giocatori);
      ordini.fumetto(ladro, f.furto(2));
      ordini.reagisci(ladro, 'salto');
      teatro.ctx.orologio.dopo(() => {
        if (ordini.spostaAgnellini(2, chi, ladro)) ordini.reagisci(chi, 'scossa');
      }, 400);
      return;
    }
    case 'guaio':
      void ordini.guaio(ev.carta, chi);
      return;
    case 'beeeNo':
      void ordini.beeeNo(chi);
      return;
    case 'pascolo':
      ordini.fumetto(chi, f.pascolo(5));
      ordini.spostaAgnellini(5, 'gregge', chi);
      return;
  }
}
