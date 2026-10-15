// Giochi tra agnellini: piccole scenette che partono da sole ogni tanto (bozza scena.src.html, righe 1382–1503).
// Se l'agnellino non è (più) guidato, per esempio perché è appena corso in un altro Ovile, si va avanti subito:
// nessuna scenetta e nessun meteo resta ad aspettarlo per sempre.
// Un agnellino intrappolato nel mulinello obbedisce solo alla trappola: gli altri comandi passano oltre.
// I setTimeout della bozza sono `ctx.orologio.dopo`: con il ciclo manuale anche i giochi avanzano a comando.
import { T as TESTI } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { Contesto } from '../contesto';
import type { Agnello } from './agnello';
import { clamp, dentro, type Area } from './aree';

/** I timer dei giochi sono solo decorazione: la regia non li conta come evento in corso. */
const DECORATIVO = { decorativo: true } as const;
const rand = (g: Agnello, a: number, b: number) => a + g.ctx.caso() * (b - a);
const tra = (q: number, a: number, b: number) => clamp((q - a) / (b - a), 0, 1);
/** Sale e scende dolcemente agli estremi di q in [0, 1] (bozza, riga 1552). */
export const busta = (q: number, att = 0.2) => {
  const s = Math.min(tra(q, 0, att), tra(1 - q, 0, att));
  return s * s * (3 - 2 * s);
};

export const muovi = (g: Agnello, x: number, y: number, vel = 40, salto = 3, trappola = false): Promise<void> => {
  if (!g.regia || (g.intrappolato && !trappola)) return Promise.resolve();
  const z = dentro(g.a, x, y);
  if (z) y = z[3] + 2; // una meta dietro un ostacolo si sposta appena sotto
  return new Promise((fine) => {
    g.mossa = { x, y, vel, salto, fine, da: g.ctx.T };
  });
};

export const effetto = (g: Agnello, fn: (dt: number) => boolean, trappola = false): Promise<void> =>
  g.regia && (!g.intrappolato || trappola)
    ? new Promise((fine) => {
        g.fx = fn;
        g.fxFine = fine;
      })
    : Promise.resolve();

export const perDurata = (sec: number, fn: (q: number) => void) => {
  let t = 0;
  return (dt: number): boolean => {
    t += dt;
    const q = Math.min(1, t / sec);
    fn(q);
    return q >= 1;
  };
};

export const saltello = (g: Agnello, h = 10) =>
  perDurata(0.5, (q) => {
    const s = Math.sin(q * Math.PI);
    g.hop = s * h;
    g.sy = 1 + 0.06 * s;
    g.sx = 1 / g.sy;
  });

const distanza = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
const libero = (g: Agnello) => !g.regia && ['fermo', 'bruca', 'cammina', 'guarda'].includes(g.stato);

export function prendi(gs: Agnello[]): void {
  gs.forEach((g) => {
    g.regia = true;
    g.stato = 'regia';
    g.mossa = null;
    g.fx = null;
    g.ox = 0;
    g.poi = null;
  });
}

export function rilascia(gs: Agnello[], trappola = false): void {
  gs.forEach((g) => {
    if (!g.regia || (g.intrappolato && !trappola)) return;
    g.annullaRegia();
    g.stato = 'fermo';
    g.t = rand(g, 0.8, 2.5);
    // Preso per strada (meteo): finita la scenetta riprende la corsa verso la sua area, con una meta nuova
    if (g.giunto) {
      g.tx = g.x;
      g.ty = g.y;
    } else g.riprendiViaggio();
  });
}

export const ancora = (...gs: Agnello[]) => gs.every((g) => g.regia && !g.intrappolato && g.vivo);

export function stellina(g: Agnello, x: number, y: number): void {
  g.amb.decoro(
    `<svg viewBox="-10 -10 20 20" width="16" height="16"><path d="M0 -8 L2.4 -2.4 L8 -2 L3.6 1.6 L5 7.6 L0 4.4 L-5 7.6 L-3.6 1.6 L-8 -2 L-2.4 -2.4 Z" fill="${P.limone}" stroke="${P.notte}" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    x - 8,
    y - 8,
    [
      { transform: 'scale(0) rotate(0)', opacity: 1 },
      { transform: 'scale(1.3) rotate(90deg)', opacity: 1, offset: 0.4 },
      { transform: 'scale(.8) rotate(160deg) translateY(-6px)', opacity: 0 },
    ],
    650,
  );
}

export function cuore(g: Agnello, x: number, y: number): void {
  g.amb.decoro(
    `<svg viewBox="-8 -9 16 14" width="15" height="13"><path d="M0 4 C-7 -1 -5 -8 0 -4.5 C5 -8 7 -1 0 4 Z" fill="${P.albicocca}" stroke="${P.notte}" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
    x - 7,
    y - 7,
    [
      { transform: 'translateY(0) scale(.3)', opacity: 0 },
      { transform: 'translateY(-6px) scale(1.15)', opacity: 1, offset: 0.25 },
      { transform: 'translateY(-26px) scale(1)', opacity: 0 },
    ],
    1500,
  );
}

/** Fumetto di un belato sopra l'agnellino (anche il meteo lo usa). */
export function belino(g: Agnello, testo: string, piccolo = false): void {
  const k = g.amb.profondita(g.y);
  const d = g.amb.decoro(
    `<span class="belino${piccolo ? ' piccolo' : ''}"></span>`,
    g.x,
    g.y - 30 * k,
    [
      { transform: 'translateY(4px) scale(.5)', opacity: 0 },
      { transform: 'translateY(0) scale(1)', opacity: 1, offset: 0.2 },
      { transform: 'translateY(-10px)', opacity: 0 },
    ],
    1300,
  );
  const s = d.querySelector('.belino');
  if (s) s.textContent = testo;
}

type Gioco = (a: Agnello, b: Agnello) => Promise<void>;

export const GIOCHI: Record<'testate' | 'coccola' | 'rincorsa' | 'cavallina', Gioco> & { coro(gs: Agnello[]): Promise<void> } = {
  async testate(a, b) {
    if (a.x > b.x) [a, b] = [b, a];
    const A = a.a, k = a.amb.profondita((a.y + b.y) / 2), d = 10 * k;
    const mx = clamp((a.x + b.x) / 2, A.x0 + d, A.x1 - d), my = (a.y + b.y) / 2;
    await Promise.all([muovi(a, mx - d, my, 34), muovi(b, mx + d, my, 34)]);
    for (let i = 0; i < 2; i++) {
      if (!ancora(a, b)) return;
      a.verso = 1;
      b.verso = -1;
      const cozzo = (g: Agnello, dir: number) =>
        perDurata(0.62, (q) => {
          if (q < 0.45) {
            const s = q / 0.45;
            g.ox = dir * 5 * k * s;
            g.incl = -12 * s;
            g.hop = 3 * s;
          } else if (q < 0.6) {
            const s = (q - 0.45) / 0.15;
            g.ox = dir * 5 * k * (1 - s) - dir * 2.5 * k * s;
            g.incl = -12 + 22 * s;
            g.hop = 3 * (1 - s);
          } else {
            const s = (q - 0.6) / 0.4;
            g.ox = -dir * 2.5 * k * (1 - s);
            g.incl = 10 * (1 - s);
            g.sy = 1 - 0.18 * Math.sin(s * Math.PI);
            g.sx = 1 / g.sy;
          }
        });
      a.ctx.orologio.dopo(() => {
        if (ancora(a, b)) {
          stellina(a, mx, my - 22 * k);
          a.ctx.suona('pop');
        }
      }, 330, DECORATIVO);
      await Promise.all([effetto(a, cozzo(a, -1)), effetto(b, cozzo(b, 1))]);
    }
    if (ancora(a, b)) await Promise.all([effetto(a, saltello(a)), effetto(b, saltello(b))]);
  },

  async coccola(a, b) {
    if (a.x > b.x) [a, b] = [b, a];
    const A = a.a, k = a.amb.profondita((a.y + b.y) / 2), d = 7.5 * k;
    const mx = clamp((a.x + b.x) / 2, A.x0 + d, A.x1 - d), my = (a.y + b.y) / 2;
    await Promise.all([muovi(a, mx - d, my, 26, 2), muovi(b, mx + d, my, 26, 2)]);
    if (!ancora(a, b)) return;
    a.verso = 1;
    b.verso = -1;
    a.ctx.orologio.dopo(() => {
      if (ancora(a, b)) cuore(a, mx, my - 24 * k);
    }, 350, DECORATIVO);
    const strofina = (g: Agnello, ph: number) =>
      perDurata(1.7, (q) => {
        g.incl = 7 * Math.sin(q * Math.PI * 4 + ph) * busta(q);
        g.sy = 1 - 0.05 * busta(q);
        g.sx = 1 / g.sy;
      });
    await Promise.all([effetto(a, strofina(a, 0)), effetto(b, strofina(b, 1.6))]);
  },

  async rincorsa(a, b) {
    const insegui = (g: Agnello, preda: Agnello, sec: number) => {
      let t = 0, fase = 0;
      return (dt: number): boolean => {
        t += dt;
        const k = g.amb.profondita(g.y), v = 52 * k, dx = preda.x - g.x, dy = preda.y - g.y, d = Math.hypot(dx, dy);
        if (d > 13 * k) {
          g.x += (dx / d) * v * dt;
          g.y += (dy / d) * v * dt;
        }
        g.verso = dx > 0 ? 1 : -1;
        fase += dt * 11;
        g.hop = Math.abs(Math.sin(fase)) * 5;
        // Se la preda non gioca più (è corsa in un altro Ovile, è uscita di scena) si smette subito
        return t > sec || d <= 14 * k || !ancora(preda) || preda.a !== g.a;
      };
    };
    for (const [scappa, segue] of [[b, a], [a, b]] as const) {
      if (!ancora(a, b)) return;
      let meta = { x: scappa.x, y: scappa.y }, lontano = -1;
      for (let i = 0; i < 8; i++) {
        const p = { x: rand(scappa, scappa.a.x0, scappa.a.x1), y: rand(scappa, scappa.a.y0, scappa.a.y1) };
        const d = distanza(p, segue);
        if (d > lontano) {
          lontano = d;
          meta = p;
        }
      }
      belino(scappa, TESTI.scena.belini.scappa, true);
      await Promise.all([muovi(scappa, meta.x, meta.y, 50, 6), effetto(segue, insegui(segue, scappa, 3))]);
    }
    if (ancora(a, b)) await Promise.all([effetto(a, saltello(a, 12)), effetto(b, saltello(b, 12))]);
  },

  async cavallina(a, b) {
    const A = a.a, k = a.amb.profondita(b.y), salto = 22 * k;
    // La cavallina si sposta prima un po' verso il centro, così c'è spazio da entrambi i lati
    const bx = clamp(b.x, A.x0 + salto + 2, A.x1 - salto - 2);
    if (Math.abs(bx - b.x) > 1) {
      await muovi(b, bx, b.y, 30, 2);
      if (!ancora(a, b)) return;
    }
    const lato = a.x < b.x ? -1 : 1;
    const da = { x: b.x + lato * salto, y: b.y }, a2 = { x: b.x - lato * salto, y: b.y };
    await muovi(a, da.x, da.y, 40, 3);
    if (!ancora(a, b)) return;
    a.verso = lato > 0 ? -1 : 1;
    const x0 = a.x, x1 = a2.x;
    const accucciato = perDurata(0.9, (q) => {
      b.sy = 1 - 0.2 * busta(q, 0.3);
      b.sx = 1 / b.sy;
    });
    const balzo = perDurata(0.75, (q) => {
      a.x = x0 + (x1 - x0) * q;
      a.hop = Math.sin(q * Math.PI) * 24;
      a.incl = -14 + 26 * q;
      if (q >= 1) a.incl = 0;
    });
    a.ctx.orologio.dopo(() => a.ctx.suona('pop'), 380, DECORATIVO);
    await Promise.all([effetto(b, accucciato), effetto(a, balzo)]);
    if (ancora(a, b)) {
      await effetto(
        a,
        perDurata(0.3, (q) => {
          a.sy = 1 - 0.25 * Math.sin(q * Math.PI);
          a.sx = 1 / a.sy;
        }),
      );
    }
  },

  async coro(gs) {
    const [primo, ...altri] = gs;
    if (!primo) return;
    const bela = (g: Agnello) =>
      perDurata(0.9, (q) => {
        g.incl = -16 * busta(q, 0.25);
      });
    belino(primo, TESTI.scena.belini.coro);
    primo.ctx.suona('beee', 1.5);
    const tutti = [effetto(primo, bela(primo))];
    altri.forEach((g, i) =>
      tutti.push(
        new Promise<void>((r) => {
          g.ctx.orologio.dopo(() => {
            if (!ancora(g)) return r();
            belino(g, TESTI.scena.belini.risposta, true);
            g.ctx.suona('beee', 1.7 + i * 0.12);
            void effetto(g, bela(g)).then(r);
          }, 650 + i * 420, DECORATIVO);
        }),
      ),
    );
    await Promise.all(tutti);
  },
};

/** Chi può giocare: il branco tiene aggiornate le aree; `attivo` false a fine partita. */
export interface Pianificatore {
  ctx: Contesto;
  prossimo: number;
  attivo: boolean;
  inBasso: Area | null;
  gregge: Area | null;
  altri: Area[];
}

export function creaPianificatore(ctx: Contesto): Pianificatore {
  return { ctx, prossimo: 3, attivo: true, inBasso: null, gregge: null, altri: [] };
}

const TIPI = ['testate', 'testate', 'coccola', 'rincorsa', 'rincorsa', 'cavallina', 'cavallina', 'coro'] as const;

/** Ogni 3–6,5 s due agnellini liberi e vicini (o un coro fino a 4) fanno una scenetta (bozza, righe 1481–1503). */
export function pianificaGiochi(p: Pianificatore, dt: number): void {
  const ctx = p.ctx;
  const caso = ctx.caso;
  const scegliUno = <E>(l: readonly E[]): E => l[Math.floor(caso() * l.length)]!;
  p.prossimo -= dt;
  if (p.prossimo > 0 || !p.attivo || ctx.ridotto) return;
  p.prossimo = 3 + caso() * 3.5;
  // L'Ovile di chi sta in basso conta tre volte, il gregge due
  const candidate = [p.inBasso, p.inBasso, p.inBasso, p.gregge, p.gregge, ...p.altri].filter((a): a is Area => !!a);
  if (!candidate.length) return;
  const a = scegliUno(candidate);
  const liberi = a.agnelli.filter(libero);
  if (liberi.length < 2) return;
  const tipo = scegliUno(TIPI);
  let gruppo: Agnello[];
  if (tipo === 'coro') gruppo = liberi.sort(() => caso() - 0.5).slice(0, Math.min(4, liberi.length));
  else {
    const g1 = scegliUno(liberi);
    const g2 = liberi.filter((g) => g !== g1).sort((x, y) => distanza(x, g1) - distanza(y, g1))[0];
    if (!g2 || distanza(g1, g2) > 120 * g1.amb.profondita(g1.y)) return;
    gruppo = [g1, g2];
  }
  prendi(gruppo);
  void (tipo === 'coro' ? GIOCHI.coro(gruppo) : GIOCHI[tipo](gruppo[0]!, gruppo[1]!)).finally(() => rilascia(gruppo));
}
