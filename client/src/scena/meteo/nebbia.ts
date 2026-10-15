// Nebbia fitta (bozza scena.src.html, righe 2367–2381): tre banchi bassi attraversano il prato, sfalsati;
// finché sono sul prato gli agnellini che ci finiscono sotto restano fermi, un po' spaesati. Senza ambiente non ci sono banchi.
import { T } from '../../testi';
import type { EffettoGuaio } from './comune';

const BANCHI: Array<[number, number, number]> = [
  [452, 0, 80],
  [250, -220, 74],
  [640, -480, 100],
];

export const nebbia: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const amb = s.palco.amb();
  const x0 = s.vista().x;
  const banchi = amb
    ? BANCHI.map(([y, ritardo, vel]) =>
        amb.nuovaNuvola(x0 - 300 + ritardo, { tipo: 'nebbia', temporanea: true, vel, y, contenitore: ctx.el.nebbiaSvg, bassa: true }),
      )
    : [];
  m.pulisci(() =>
    banchi.forEach((b) => {
      b.vel = 320;
    }),
  );
  const sulPrato = () => {
    const v = s.vista();
    return banchi.filter((b) => amb!.nuvole.includes(b) && b.x - b.W / 2 < v.x + v.w + 40);
  };
  s.palco.fumetto(chi, T.scena.fumetti.nebbia, 1800);
  for (let i = 0; i < 5; i++) m.dopo(() => s.palco.pecora(chi)?.fai('guarda', true), 1800 + i * 1800);
  for (let presenti = sulPrato(); presenti.length; presenti = sulPrato()) {
    for (const b of presenti) {
      for (const g of s.palco.agnelli()) {
        if (!g.regia && Math.abs(g.x - b.x) < b.W / 2 && Math.abs(g.y - b.y) < 90 && g.stato === 'cammina') g.guarda(b.x);
      }
    }
    await m.attesa(400);
  }
};
