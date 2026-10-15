// Gelata di agosto (bozza scena.src.html, righe 2409–2433): brina e cristalli sul prato, ghiaccioli sui recinti,
// pecore e agnellini infreddoliti che si stringono tremando; il fiato si vede.
import { T } from '../../testi';
import type { EffettoGuaio } from './comune';

export const gelata: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const amb = s.palco.amb();
  const gelo = document.createElement('div');
  gelo.className = 'gelo';
  ctx.el.mondo.appendChild(gelo);
  ctx.anima(gelo, [{ opacity: 0 }, { opacity: 0.24 }], { duration: 1500, fill: 'forwards' });
  for (let i = 0; i < 110; i++) {
    const t = s.terraACaso();
    s.particella('cristallo', t.x, t.y, { vita: s.rand(6.5, 8), vx: 0, vy: 0, rot: s.rand(0, 1) });
  }
  // Brina e ghiaccioli su pecore e agnellini, stalattiti sui recinti, erba gelata
  s.pecore().forEach((p) => {
    p.brivido = 1;
    p.geloMeta = 1;
  });
  for (const g of s.palco.agnelli()) g.brinaMeta = 1;
  if (amb) amb.atmosfera.geloErbaMeta = 1;
  const io = s.inBasso();
  const ghiacci = s.palco.giocatori().map((c) => s.stalattiti(c, c === io ? 7 : 3));
  const disgela = () => {
    s.pecore().forEach((p) => {
      p.geloMeta = 0;
    });
    for (const g of s.palco.agnelli()) g.brinaMeta = 0;
    if (amb) {
      amb.atmosfera.geloErbaMeta = 0;
      for (const p of amb.particelle) if (p.tipo === 'cristallo') p.vita = Math.min(p.vita, s.rand(0.4, 1.2));
    }
    ghiacci.forEach((el) => {
      el.querySelectorAll('path').forEach((p) => {
        // getBBox manca senza disegno (jsdom): niente gocce, ma il ghiaccio si scioglie lo stesso
        if (typeof p.getBBox !== 'function') return;
        const b = p.getBBox();
        s.particella('gocciolina', parseFloat(el.style.left) + b.x + b.width / 2, parseFloat(el.style.top) + b.y + b.height, { vx: 0, vy: 20, vita: 0.8 });
      });
      const via = () => el.remove();
      ctx
        .anima(el.firstChild as Element, [{ transform: 'scaleY(1)', opacity: 1 }, { transform: 'scaleY(0)', opacity: 0 }], { duration: 1800, easing: 'ease-in', fill: 'forwards' })
        .finished.then(via, via);
    });
    const viaGelo = () => gelo.remove();
    ctx.anima(gelo, [{ opacity: 0.24 }, { opacity: 0 }], { duration: 2000, fill: 'forwards' }).finished.then(viaGelo, viaGelo);
  };
  m.pulisci(disgela);
  s.palco.fumetto(chi, T.scena.fumetti.gelata, 1800);
  const fiato = m.ogni(
    () =>
      s.palco.giocatori().forEach((c) => {
        const p = s.palco.pecora(c);
        if (!p) return;
        const t = s.testaPecora(c);
        s.particella('vapore', t.x + p.verso * 8, t.y + 4, { vita: 1.3, k: p.g.w / 124 });
      }),
    900,
  );
  m.pulisci(() => m.annulla(fiato));
  await s.rannicchiaTutti(m, 6.5, { brivido: true });
  m.ok();
  await m.attesa(400);
};
