// I testi alternativi delle figure della schermata Regole: chi non vede il disegno sente il suo nome (e, per una carta,
// anche il dettaglio e il testo, come sulla carta). Le frasi stanno in `T.regole`; nomi e numeri vengono dal catalogo
// e da setup.json. Puro: niente DOM, così si può usare anche dove le carte disegnate non sono ancora arrivate.
import { CATALOGO, SETUP, defCarta } from '../../../engine/src';
import { valoriCerchi } from '../scena/fionda/tiro';
import { T, type DisegnoRegole } from '../testi';

/** Il testo alternativo di un disegno delle Regole (mai vuoto). */
export function testoAlternativo(d: DisegnoRegole): string {
  const R = T.regole;
  switch (d.tipo) {
    case 'carta': {
      const c = defCarta(d.id);
      const dettaglio =
        c.famiglia === 'trovata' ? R.valore(c.valore) : c.famiglia === 'belato' ? R.alternativi.belato : R.guaioDi(c.tipo);
      // Come sulla carta (e nella carta dei pannelli): una Trovata senza effetto, non Gemella, dice "Nessun effetto"
      const senzaEffetto = c.famiglia === 'trovata' && c.effetto === null && !c.gemella;
      return R.carta(c.nome, dettaglio, senzaEffetto ? R.alternativi.senzaEffetto(c.testo) : c.testo);
    }
    case 'pecora':
      return CATALOGO.pecore[d.pecora].nome;
    case 'agnellino':
      return R.alternativi.agnellino;
    case 'montone':
      return R.alternativi.montone;
    case 'dado':
      return R.alternativi.dado;
    case 'faccia': {
      const f = SETUP.dado.find((x) => x.id === d.faccia);
      // Una faccia che setup.json non conosce: resta il nome del dado, mai un testo vuoto
      if (!f) return R.alternativi.dado;
      return f.effetto === 'testata' ? R.faccia.testata : R.faccia[f.effetto](f.quantita);
    }
    case 'guaio':
      return R.guaioDi(d.guaio);
    case 'recinto':
      return R.alternativi.recinto(...valoriCerchi(SETUP.testata.esitoMassimo));
  }
}
