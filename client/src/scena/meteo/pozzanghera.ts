// Pozzanghera senza fondo (bozza scena.src.html, righe 2434–2512): una nuvoletta piove sul recinto e lascia una pozza
// con un mulinello. Qualunque agnellino ci passi sopra (anche di corsa) resta intrappolato e gira finché la pozza non si chiude.
// Differenza dalla bozza: chi era di corsa riprende la strada da solo quando è rilasciato (`rilascia` → `riprendiViaggio`).
import { T } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { Agnello } from '../personaggi/agnello';
import { belino, busta, effetto, muovi, perDurata, prendi, rilascia, saltello } from '../personaggi/giochi';
import type { FormaRecinto } from '../tavolo/recinti';
import type { EffettoGuaio } from './comune';

const NUVOLETTA =
  '<circle cx="-16" cy="2" r="11"/><circle cx="0" cy="-5" r="14"/><circle cx="16" cy="3" r="10"/><rect x="-26" y="1" width="52" height="13" rx="6.5"/>';

/** Una spirale vera vista in prospettiva, che gira verso il centro. */
function spirale(giri: number, r0: number, r1: number, fase: number): string {
  const n = Math.round(giri * 28);
  let d = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = fase + t * giri * Math.PI * 2, r = r0 + (r1 - r0) * t;
    d += `${i ? ' L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
  }
  return d;
}

export const pozzanghera: EffettoGuaio = async (m, chi, s) => {
  const { ctx } = s.palco;
  const rand = s.rand;
  const A = s.area(chi);
  // Centro e scala della pozza: se il recinto ingrandito torna normale, si spostano e si stringono con lui
  let sc = (A.recinto as FormaRecinto).k;
  let X = (A.x0 + A.x1) / 2, Y = (A.y0 + A.y1) / 2 + 4 * sc;
  const zPozza = 100 + Math.round(A.y0) - 2;
  /** I giri degli intrappolati (raggio in proporzione alla pozza). */
  const giri = new Set<{ r: number }>();
  s.seguiRecinto(chi, (mp) => {
    if (!m.vivo && giri.size === 0) return false;
    ({ x: X, y: Y } = mp.punto(X, Y));
    sc *= mp.k;
    for (const g of giri) g.r *= mp.k;
  });
  const f = NUVOLETTA;
  const nuvola = s.svgLibero(
    X,
    Y - 62 * sc,
    1700,
    `<g transform="scale(${sc})"><g class="nuvoletta"><g fill="${P.notte}" stroke="${P.notte}" stroke-width="5">${f}</g><g fill="${P.nebbia}">${f}</g></g></g>`,
    'pozza',
  );
  s.seguiElemento(chi, nuvola);
  const nuvoletta = nuvola.querySelector('.nuvoletta')!;
  ctx.anima(nuvoletta, [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 700, easing: 'ease-out', fill: 'forwards' });
  m.pulisci(() => {
    const via = () => nuvola.remove();
    ctx.anima(nuvoletta, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.3)', opacity: 0 }], { duration: 700, fill: 'forwards' }).finished.then(via, via);
  });
  await m.attesa(600);
  const pioggerella = m.ogni(() => {
    for (let i = 0; i < 3; i++) s.particella('goccia', X + rand(-22, 22) * sc, Y - 48 * sc, { vx: 0, vy: 380, terra: Y + rand(-6, 6) * sc, vita: 1 });
  }, 60);
  m.pulisci(() => m.annulla(pioggerella));
  // Il mulinello è una spirale (più un secondo braccio più leggero) che gira verso il centro
  const mulinello =
    `<g transform="scale(${sc} ${0.32 * sc})"><g class="mulinello"><path d="${spirale(3.2, 4, 30, 0)}" fill="none" stroke="${P.notte}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${spirale(2.4, 6, 25, Math.PI)}" fill="none" stroke="${P.notte}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/><circle r="5" fill="${P.notte}"/></g></g>`;
  const p = s.pozza(X, Y, 32 * sc, zPozza, mulinello, 2600);
  s.seguiElemento(chi, p.el, () => 100 + Math.round(A.y0) - 2);
  m.pulisci(() => void p.sparisci(3000));
  // Ognuno su un giro diverso, così non si sovrappongono
  const intrappolati = new Set<Agnello>();
  let liberi = false;
  const intrappola = (g: Agnello) => {
    if (g.regia) g.annullaRegia();
    g.intrappolato = true;
    intrappolati.add(g);
    prendi([g]);
    belino(g, T.scena.belini.sorpreso, true);
    ctx.suona('beee', 1.8);
    // Il giro è in proporzione alla pozza (sc), così si stringe con lei
    const giro = 7 + ((intrappolati.size - 1) % 4) * 6, vel = 4.2 - giro * 0.06;
    let ang = Math.atan2((g.y - Y) / 0.32, g.x - X);
    const stato = { r: Math.max(8 * sc, Math.hypot(g.x - X, (g.y - Y) / 0.32)) };
    giri.add(stato);
    void effetto(
      g,
      (dt) => {
        ang -= dt * vel;
        stato.r += (giro * sc - stato.r) * Math.min(1, dt * 1.4);
        g.x = X + Math.cos(ang) * stato.r;
        g.y = Y + Math.sin(ang) * stato.r * 0.32;
        g.verso = Math.sin(ang) > 0 ? 1 : -1;
        g.incl = Math.sin(ctx.T * 9 + giro) * 9;
        g.hop = -2.5;
        g.sy = 0.9;
        g.sx = 1.08;
        return liberi || !m.vivo;
      },
      true,
    )
      .then(() => (g.regia ? muovi(g, X + Math.cos(ang) * 50 * sc, Y + Math.sin(ang) * 17 * sc, 70, 9, true) : undefined))
      .then(() => {
        giri.delete(stato);
        g.intrappolato = false;
        intrappolati.delete(g);
        rilascia([g], true);
      });
  };
  const trappola = m.ogni(() => {
    for (const g of s.palco.agnelli()) {
      if (g.intrappolato || g.stato === 'vola') continue;
      const dx = (g.x - X) / (30 * sc), dy = (g.y - Y) / (10 * sc);
      if (dx * dx + dy * dy < 1) intrappola(g);
    }
  }, 80);
  m.pulisci(() => {
    m.annulla(trappola);
    liberi = true;
  });
  await m.attesa(2600);
  m.annulla(pioggerella);
  ctx.anima(nuvoletta, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'translateY(-14px) scale(.3)', opacity: 0 }], { duration: 900, easing: 'ease-in', fill: 'forwards' });
  // Tre agnellini distratti attraversano la pozza, uno dopo l'altro
  const distratti = A.agnelli
    .filter(s.libero)
    .sort((a, b) => Math.abs(a.y - Y) - Math.abs(b.y - Y))
    .slice(0, 3);
  prendi(distratti);
  m.pulisci(() => rilascia(distratti));
  distratti.forEach((g, i) => {
    void (async () => {
      const lato = i % 2 ? 1 : -1;
      await muovi(g, X + lato * 66 * sc, Y + (i - 1) * 3 * sc, 45, 3);
      await m.pausa(i * 1400);
      if (!m.vivo || g.intrappolato) return;
      await muovi(g, X - lato * 66 * sc, Y + (i - 1) * 2 * sc, 22, 2.6); // la traversata: a metà strada il mulinello lo prende
      if (!g.intrappolato) rilascia([g]);
    })();
  });
  const curiosi = A.agnelli.filter((g) => s.libero(g) && !distratti.includes(g)).slice(0, 2);
  prendi(curiosi);
  m.pulisci(() => rilascia(curiosi));
  const dx = [-48, 48], dy = [-14, -12];
  await Promise.all(curiosi.map((g, i) => muovi(g, X + dx[i]! * sc, Y + dy[i]! * sc, 40, 3)));
  m.ok();
  curiosi.forEach((g) => {
    g.verso = g.x < X ? 1 : -1;
  });
  s.palco.fumetto(chi, T.scena.fumetti.pozzanghera, 1800);
  s.palco.pecora(chi)?.fai('bruca', true);
  const primo = curiosi[0];
  if (primo) {
    await effetto(
      primo,
      perDurata(1.2, (q) => {
        primo.incl = 18 * busta(q);
        primo.ox = 6 * busta(q);
      }),
    );
    m.ok();
    belino(primo, T.scena.belini.plop, true);
    ctx.suona('pop');
    for (let i = 0; i < 6; i++) s.particella('gocciolina', X - 32 * sc, Y - 6 * sc, { vx: rand(-40, 40), vy: rand(-120, -60), vita: 0.7 });
    await effetto(primo, saltello(primo, 14));
    m.ok();
  }
  await m.attesa(1500);
  rilascia(curiosi);
  await m.attesa(5000);
  m.annulla(trappola);
  liberi = true;
  await m.attesa(900);
};
