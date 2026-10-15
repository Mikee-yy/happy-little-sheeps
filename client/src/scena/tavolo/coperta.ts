// La coperta (la tovaglia al centro del tavolo): pile del mazzo e dei Guai, scarti, Guaio del round e dado fermo.
// Bozza scena.src.html, righe 1784–1803 (pile e scarti) e 1976–1997 (facce e posa del dado).
// In questo pezzo mazzo, mazzo dei Guai e dado non reagiscono ai tocchi; il dado non rotola, sta sull'ultima faccia uscita.
import { SETUP } from '../../../../engine/src';
import type { FacciaDado, IdCarta } from '../../../../engine/src';
import { T } from '../../testi';
import { cartaSVG, retroSVG } from '../carte/carte';
import type { Contesto } from '../contesto';
import type { Fotografia } from '../fotografia';
import { entra, rng, semeDa, sincronizza, svuota, type Voce } from './comune';

export interface Coperta {
  /** Mette in pari pile, diciture, scarti, Guaio del round e dado con la fotografia. `subito`: senza dissolvenze. */
  aggiorna(f: Fotografia, subito?: boolean): void;
  /** Il dado fermo sulla faccia del lancio (id della faccia del motore), o sulla prima se null. */
  dado(faccia: string | null): void;
  distruggi(): void;
}

/** Il simbolo dello sprite per una faccia del dado. */
export function simboloFaccia(f: FacciaDado): string {
  if (f.effetto === 'pascolo') return 'd-p' + f.quantita;
  if (f.effetto === 'furto') return 'd-f' + f.quantita;
  return 'd-testata';
}

/** Le sei facce del cubo: simbolo, rotazione che la porta davanti e posizione sul cubo (bozza, righe 1976–1983). */
const FACCE_3D = [
  { id: 'd-p3', rx: 0, ry: 0, t: 'translateZ(24px)' },
  { id: 'd-p5', rx: 0, ry: 180, t: 'rotateY(180deg) translateZ(24px)' },
  { id: 'd-f2', rx: 0, ry: -90, t: 'rotateY(90deg) translateZ(24px)' },
  { id: 'd-f4', rx: 0, ry: 90, t: 'rotateY(-90deg) translateZ(24px)' },
  { id: 'd-testata', rx: -90, ry: 0, t: 'rotateX(90deg) translateZ(24px)' },
  { id: 'd-testata', rx: 90, ry: 0, t: 'rotateX(-90deg) translateZ(24px)' },
];

/** Inclinazione di partenza del dado sul tavolo. */
const ROT_Z = 18;

/** La rotazione che porta davanti la faccia del motore `faccia` (o la prima se null), con il simbolo dello sprite. */
export function posaDado(faccia: string | null): { simbolo: string; rx: number; ry: number; rz: number } {
  const def = faccia === null ? undefined : SETUP.dado.find((d) => d.id === faccia);
  const simbolo = def ? simboloFaccia(def) : FACCE_3D[0]!.id;
  const f = FACCE_3D.find((x) => x.id === simbolo) ?? FACCE_3D[0]!;
  return { simbolo: f.id, rx: f.rx, ry: f.ry, rz: ROT_Z };
}
const SCARTI_VISIBILI = 6;

function disegnaPila(el: HTMLElement, n: number, guai: boolean): void {
  if (n <= 0) {
    el.innerHTML = '<div class="vuoto"></div>';
    return;
  }
  const strati = Math.min(16, Math.max(1, Math.ceil(n / 3)));
  let s = '';
  for (let i = 0; i < strati; i++) s += `<div class="strato" style="transform:translateZ(${(i * 1.25).toFixed(2)}px)"></div>`;
  s += `<div class="strato cima" style="transform:translateZ(${(strati * 1.25).toFixed(2)}px)">${retroSVG(guai)}</div>`;
  el.innerHTML = s;
}

/** Cosa c'è disegnato in una pila: il numero degli strati (0 = vuota). Si ridisegna solo se cambia. */
const strati = (n: number): number => (n <= 0 ? 0 : Math.min(16, Math.max(1, Math.ceil(n / 3))));

export function creaCoperta(ctx: Contesto): Coperta {
  const { el } = ctx;
  const scarti = new Map<string, HTMLElement>();
  let pilaMazzo = -1;
  let pilaGuai = -1;
  let guaioRound: { id: IdCarta; el: HTMLElement } | null = null;
  const dicScarti = el.coperta.querySelector<HTMLElement>('.dic-scarti');

  el.dado.innerHTML = FACCE_3D.map((f) => `<div class="fd" style="transform:${f.t}"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#${f.id}"/></svg></div>`).join('');

  function dado(faccia: string | null): void {
    const f = posaDado(faccia);
    el.dado.dataset.faccia = f.simbolo;
    el.dado.style.transform = `translateZ(24px) rotateZ(${f.rz}deg) rotateX(${f.rx}deg) rotateY(${f.ry}deg)`;
  }

  /** Angolo e spostamento a caso ma stabili: dipendono solo dall'id della carta. */
  function posaScarto(id: IdCarta) {
    const r = rng(semeDa(id));
    return { dx: (r() * 14 - 7).toFixed(1), dy: (r() * 12 - 6).toFixed(1), rot: (r() * 28 - 14).toFixed(1) };
  }

  function aggiornaScarti(carte: IdCarta[], subito: boolean): void {
    el.scarti.querySelector('.vuoto')?.remove();
    const ultime = carte.slice(-SCARTI_VISIBILI);
    const voci: Voce[] = ultime.map((id) => ({
      chiave: id,
      crea: () => {
        const d = document.createElement('div');
        d.className = 'scarto';
        d.innerHTML = cartaSVG(id);
        return d;
      },
      posa: (e, i) => {
        const p = posaScarto(id);
        e.style.transform = `translate(${p.dx}px,${p.dy}px) translateZ(${(i * 1.4 + 0.5).toFixed(1)}px) rotate(${p.rot}deg)`;
      },
    }));
    sincronizza(ctx, el.scarti, scarti, voci, subito);
    if (ultime.length === 0) el.scarti.innerHTML = '<div class="vuoto"></div>';
  }

  /** Il Guaio del round, scoperto, a fianco del mazzo dei Guai (che sta a destra). */
  function aggiornaGuaioRound(id: IdCarta | null, subito: boolean): void {
    if (guaioRound && guaioRound.id === id) return;
    guaioRound?.el.remove();
    guaioRound = null;
    if (!id) return;
    const d = document.createElement('div');
    d.className = 'guaio-round';
    d.innerHTML = cartaSVG(id);
    el.coperta.appendChild(d);
    if (!subito) entra(ctx, d);
    guaioRound = { id, el: d };
  }

  function aggiorna(f: Fotografia, subito = false): void {
    if (strati(f.mazzo) !== pilaMazzo) {
      pilaMazzo = strati(f.mazzo);
      disegnaPila(el.mazzo, f.mazzo, false);
    }
    if (strati(f.mazzoGuai) !== pilaGuai) {
      pilaGuai = strati(f.mazzoGuai);
      disegnaPila(el.mazzoGuai, f.mazzoGuai, true);
    }
    el.dicMazzo.textContent = T.scena.mazzo(f.mazzo);
    el.dicGuai.textContent = T.scena.guai(f.mazzoGuai);
    if (dicScarti) dicScarti.textContent = T.scena.scarti;
    aggiornaScarti(f.scarti, subito);
    aggiornaGuaioRound(f.guaioRound, subito);
    dado(f.dado);
  }

  dado(null);

  return {
    aggiorna,
    dado,
    distruggi() {
      svuota(scarti);
      guaioRound?.el.remove();
      guaioRound = null;
      el.scarti.innerHTML = '';
      el.mazzo.innerHTML = '';
      el.mazzoGuai.innerHTML = '';
      pilaMazzo = pilaGuai = -1;
    },
  };
}
