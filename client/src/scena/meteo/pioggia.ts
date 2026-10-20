// Pioggia di traverso (bozza scena.src.html, righe 2345–2358): pioggia obliqua, pozze, pecore bagnate che poi si scrollano.
import type { FormaRecinto } from '../tavolo/recinti';
import type { EffettoGuaio } from './comune';

export const pioggia: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const via = s.tempestaPer(m, 3);
  await m.attesa(700);
  s.stato.pioggia = 1;
  s.stato.bagna = true;
  ctx.suona('pioggiaInizia');
  m.pulisci(() => {
    s.stato.pioggia = 0;
    s.stato.bagna = false;
    ctx.suona('pioggiaFine');
  });
  const pozze: Array<ReturnType<typeof s.pozza>> = [];
  m.pulisci(() => pozze.forEach((p) => void p.sparisci(2500)));
  for (let i = 0; i < 5; i++) {
    m.dopo(() => {
      if (!m.vivo) return;
      const t = s.terraACaso();
      if (t.y > 260 && t.y < 690) pozze.push(s.pozza(t.x, t.y, s.rand(12, 22) * s.palco.profondita(t.y), 101));
    }, 600 + i * 700);
  }
  m.dopo(() => {
    if (!m.vivo) return;
    const A = s.area(chi), k = (A.recinto as FormaRecinto).k;
    const p = s.pozza(A.x0 + (A.x1 - A.x0) * 0.32, (A.y0 + A.y1) / 2 + 6 * k, 20 * k, 100 + Math.round(A.y0) - 2);
    // La pozza nel recinto lo segue se torna alla forma normale
    s.seguiElemento(chi, p.el, () => 100 + Math.round(A.y0) - 2);
    pozze.push(p);
  }, 1500);
  await s.rannicchiaTutti(m, 5.5);
  m.ok();
  s.stato.pioggia = 0;
  s.stato.bagna = false;
  ctx.suona('pioggiaFine');
  await m.attesa(700);
  s.palco.giocatori().forEach((c, i) => m.dopo(() => s.scrollaAcqua(c), i * 300));
  via();
  s.impostaTempesta(false);
  await m.attesa(4000);
};
