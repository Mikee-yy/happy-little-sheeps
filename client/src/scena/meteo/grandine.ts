// Grandine a sorpresa (bozza scena.src.html, righe 2337–2344): cielo di tempesta, chicchi, e tutti si stringono saltellando.
import { T } from '../../testi';
import type { EffettoGuaio } from './comune';

export const grandine: EffettoGuaio = async (m, chi, s) => {
  const via = s.tempestaPer(m, 3);
  await m.attesa(900);
  s.stato.grandine = 1;
  m.pulisci(() => {
    s.stato.grandine = 0;
  });
  s.palco.giocatori().forEach((c, i) => m.dopo(() => s.palco.reagisci(c, 'paura'), i * 250));
  s.palco.fumetto(chi, T.scena.fumetti.grandine, 1500);
  await s.rannicchiaTutti(m, 4.2, { saltelli: true });
  m.ok();
  s.stato.grandine = 0;
  await m.attesa(900);
  via();
  s.impostaTempesta(false);
};
