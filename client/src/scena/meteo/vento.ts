// Vento dispettoso (bozza scena.src.html, righe 2359–2366): il vento del meteo sale, le carte svolazzano, la pecora si spettina.
// Il meteo scrive solo la meta del vento: l'ambiente la insegue.
import { T } from '../../testi';
import type { EffettoGuaio } from './comune';

export const vento: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const meta = (v: number) => {
    const atm = s.palco.amb()?.atmosfera;
    if (atm) atm.ventoMeta = v;
  };
  meta(1.5);
  ctx.suona('folata', 1.8, 5.5);
  ctx.el.mano.classList.add('ventoso');
  m.pulisci(() => {
    meta(0);
    ctx.el.mano.classList.remove('ventoso');
  });
  s.palco.fumetto(chi, T.scena.fumetti.vento, 1600);
  s.palco.pecora(chi)?.fai('scuoti', true);
  await m.attesa(4200);
  meta(0);
  ctx.el.mano.classList.remove('ventoso');
  const p = s.palco.pecora(chi);
  if (p) p.spettinata = 1;
  await m.attesa(1200);
};
