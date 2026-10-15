// Lupo vegetariano (bozza scena.src.html, righe 2513–2524): un cespuglio con due occhi spunta accanto al recinto
// e gli agnellini si stringono dal lato opposto, tremando e guardandolo.
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { FormaRecinto } from '../tavolo/recinti';
import type { EffettoGuaio } from './comune';

const CESPUGLIO = '<circle cx="-14" cy="-10" r="14"/><circle cx="4" cy="-18" r="18"/><circle cx="20" cy="-8" r="13"/><rect x="-26" y="-12" width="56" height="12" rx="6"/>';

export const lupo: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const f = CESPUGLIO;
  const A = s.area(chi), R = A.recinto as FormaRecinto, sx = (A.x0 + A.x1) / 2 < 195 ? -1 : 1;
  const io = chi === s.inBasso();
  const bx = io ? 10 : sx < 0 ? R.x - 18 * R.k : R.x + R.larg + 18 * R.k, by = io ? 478 : R.yDavanti;
  const c = s.svgLibero(
    bx,
    by,
    100 + Math.round(by) + 5,
    `<g transform="scale(${io ? 1 : R.k * 1.3})"><g fill="${P.notte}" stroke="${P.notte}" stroke-width="6">${f}</g><g fill="${P.menta}">${f}</g><g class="occhi-lupo"><ellipse cx="-2" cy="-14" rx="4" ry="2.4" fill="${P.limone}"/><ellipse cx="10" cy="-14" rx="4" ry="2.4" fill="${P.limone}"/><rect x="-2.6" y="-16" width="1.6" height="4" rx=".8" fill="${P.notte}"/><rect x="9.4" y="-16" width="1.6" height="4" rx=".8" fill="${P.notte}"/></g></g>`,
  );
  ctx.anima(c, [{ transform: 'translateX(-60px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, easing: 'ease-out', fill: 'forwards' });
  m.pulisci(() => {
    const via = () => c.remove();
    ctx.anima(c, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-60px)', opacity: 0 }], { duration: 900, fill: 'forwards' }).finished.then(via, via);
  });
  await m.attesa(700);
  s.palco.reagisci(chi, 'paura');
  const lontano = io || sx < 0 ? A.x1 - 20 * R.k : A.x0 + 20 * R.k;
  await s.rannicchia(m, A, [[lontano, (A.y0 + A.y1) / 2]], 3.5, { brivido: true, guarda: io ? 0 : bx, vel: 80 });
  m.ok();
};
