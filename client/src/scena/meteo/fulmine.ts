// Fulmine curioso (bozza scena.src.html, righe 2382–2408): colpisce a caso la pecora di chi ha il Guaio,
// un suo agnellino o l'erba accanto al recinto; chi è colpito resta stordito e bruciacchiato per 5–10 s.
import type { IdGiocatore } from '../../../../engine/src';
import { T } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { Agnello } from '../personaggi/agnello';
import { belino } from '../personaggi/giochi';
import type { FormaRecinto } from '../tavolo/recinti';
import type { EffettoGuaio } from './comune';

export const fulmine: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const via = s.tempestaPer(m, 2);
  await m.attesa(900);
  const durata = s.rand(5, 10), tiro = ctx.caso();
  const agnelli = s.area(chi).agnelli.filter(s.libero);
  let colpita: IdGiocatore | null = null;
  let agnello: Agnello | null = null;
  if (tiro < 0.5) colpita = chi;
  else if (tiro < 0.88 && agnelli.length) agnello = s.scegliUno(agnelli);
  let punto: [number, number];
  if (colpita) {
    const d = s.dorsoPecora(colpita);
    punto = [d.x, d.y];
  } else if (agnello) {
    const k = s.palco.profondita(agnello.y);
    punto = [agnello.x, agnello.y - 16 * k];
  } else {
    const A = s.area(chi), k = (A.recinto as FormaRecinto).k;
    punto = [A.x1 + 14 * k, A.y1 + 10 * k];
  }
  s.saetta([punto[0] + s.rand(40, 90), -120], punto);
  const w = colpita ? (s.palco.posto(colpita)?.w ?? 124) : 124;
  s.fumata(punto[0], punto[1], 12, colpita ? (1.2 * w) / 124 + 0.3 : 0.8);
  for (const g of s.palco.agnelli()) if (g !== agnello && !g.regia && !g.inViaggio) m.dopo(() => g.salta(1), s.rand(0, 300));
  if (colpita) {
    const p = s.palco.pecora(colpita);
    if (p) {
      p.fulmina(durata);
      m.pulisci(() => p.fulmina(0));
    }
    s.palco.reagisci(colpita, 'paura');
    s.palco.fumetto(colpita, T.scena.fumetti.fulmine, 1800);
  } else if (agnello) {
    agnello.fulmina(durata, m);
    belino(agnello, T.scena.belini.fulminato, true);
  } else {
    const segno = s.svgLibero(punto[0], punto[1], 101, `<ellipse rx="16" ry="5" fill="${P.notte}" opacity=".35"/>`);
    m.pulisci(() => {
      const viaSegno = () => segno.remove();
      ctx.anima(segno, [{ opacity: 1 }, { opacity: 0 }], { duration: 1500, fill: 'forwards' }).finished.then(viaSegno, viaSegno);
    });
    const fumoTerra = m.ogni(() => s.fumata(punto[0], punto[1], 2, 0.8), 450);
    m.pulisci(() => m.annulla(fumoTerra));
  }
  await m.attesa(1800);
  via();
  s.impostaTempesta(false);
  await m.attesa(durata * 1000 - 1800);
};
