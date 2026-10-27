// L'agnellino: cervello (stati, passi, viaggi tra le aree) e corpo DOM (bozza scena.src.html, righe 1212–1381).
// Il cervello è la logica della bozza; il disegno passa da un CorpoAgnello, così le prove usano un corpo finto.
// Correzione rispetto alla bozza (la verità è il motore): in `vaiIn` l'appartenenza cambia subito, la partenza
// visiva aspetta nello stato 'parte', e il conto dell'area di partenza scende solo se l'agnellino era arrivato.
import type { Luce } from '../ambiente/cielo';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import type { OpzioniParticella, TipoParticella } from '../ambiente/particelle';
import type { Contesto } from '../contesto';
import { agitazione, clamp, dentro, profondita as prospettivaDi, puntoLibero, vicinoLibero, type Area } from './aree';
import { effetto, prendi, rilascia, saltello } from './giochi';

const NS = 'http://www.w3.org/2000/svg';

export type StatoAgnello = 'fermo' | 'cammina' | 'corre' | 'vola' | 'bruca' | 'dorme' | 'salta' | 'guarda' | 'atterra' | 'regia' | 'parte';

/** Di quanto sale (nel mondo, prima della prospettiva) un agnellino alzato dal teatro: sopra la staccionata. */
export const QUOTA_ALZATO = 36;
/** Velocità di salita e di discesa dell'agnellino alzato (unità del mondo al secondo). */
const VEL_SALITA = 170;
const VEL_DISCESA = 230;

/** Stati di chi va da un'area all'altra: non è ancora arrivato e non si ferma a giocare. */
const IN_VIAGGIO: ReadonlySet<StatoAgnello> = new Set<StatoAgnello>(['parte', 'corre', 'vola']);

/** Quello che l'agnellino usa dell'ambiente. L'`Ambiente` del teatro va bene così com'è. */
export interface AmbienteAgnelli {
  profondita(y: number): number;
  ventoIn(x: number): number;
  LUCE: Luce;
  fumata(x: number, y: number, n?: number, k?: number): void;
  zeta(x: number, y: number): void;
  particella(tipo: TipoParticella, x: number, y: number, o?: OpzioniParticella): unknown;
  decoro(html: string, x: number, y: number, fotogrammi: Keyframe[], durata: number): HTMLElement;
}

/** Ambiente senza cielo né particelle (teatro con `ambiente: false`, prove): stessa prospettiva, niente vento, niente decori. */
export function ambienteMuto(_ctx: Contesto, prospettiva: () => readonly [number, number] = () => [170, 0.5]): AmbienteAgnelli {
  return {
    profondita: (y) => prospettivaDi(y, prospettiva()),
    ventoIn: () => 0,
    LUCE: { lung: 0.45, op: 0.16, dx: -0.55, chiave: '' },
    fumata: () => undefined,
    zeta: () => undefined,
    particella: () => undefined,
    decoro: () => document.createElement('div'),
  };
}

/** Ciò che sta intorno all'agnellino: l'ambiente, l'insieme dei vivi (il branco) e chi aggiorna i cartelli. */
export interface Dintorni {
  amb: AmbienteAgnelli;
  vivi?: Set<Agnello>;
  /** Il numero degli arrivati di un'area è cambiato. */
  cambiato?: (a: Area) => void;
}

/** Per la regia: chi non è ancora arrivato nella sua area (in partenza, di corsa, in volo o preso per strada). */
export const inViaggioValido = (g: unknown): boolean => g instanceof Agnello && g.vivo && !g.giunto;

export interface CorpoAgnello {
  disegna(g: Agnello): void;
  togli(): void;
}

/** Spostamento guidato (giochi, meteo): `fine` risolve la promessa di chi l'ha chiesto. */
export interface Mossa {
  x: number;
  y: number;
  vel: number;
  salto: number;
  fine: () => void;
  /** Tempo della scena alla partenza (rete di sicurezza degli 8 s). */
  da: number;
}

/** Evento del meteo che tiene un agnellino (fulmine): si chiude da solo o con `pulisci`. */
export interface ManigliaMeteo {
  vivo: boolean;
  pulisci(fn: () => void): void;
}

export class Agnello {
  readonly ctx: Contesto;
  readonly amb: AmbienteAgnelli;
  a: Area;
  x = 0;
  y = 0;
  tx = 0;
  ty = 0;
  verso: 1 | -1 = 1;
  stato: StatoAgnello = 'fermo';
  t = 0;
  fase = 0;
  hop = 0;
  sx = 1;
  sy = 1;
  incl = 0;
  giro = 0;
  regia = false;
  intrappolato = false;
  mossa: Mossa | null = null;
  fx: ((dt: number) => boolean) | null = null;
  fxFine: (() => void) | null = null;
  ox = 0;
  brivido = 0;
  poi: 'dorme' | null = null;
  brina = 0;
  brinaMeta = 0;
  bruciato = 0;
  shockFino = 0;
  nSalti = 1;
  gx = 0;
  prossimaZeta = 0;
  /** Volo: punto di partenza, durata e verso della capriola. */
  x0 = 0;
  y0 = 0;
  durata = 1;
  versoGiro: 1 | -1 = 1;
  /** È arrivato nella sua area (conta nei `mostrati`). */
  giunto = true;
  /** È ancora nella scena. */
  vivo = true;
  /** Alzato dal teatro (furto): solo decorazione, resta fermo dov'è e sale sopra la staccionata; area e conti non cambiano. */
  sollevato = false;
  /** Di quanto è salito adesso (0 a terra, `QUOTA_ALZATO` in alto). */
  quota = 0;
  /** Secondi che mancano alla partenza (stato 'parte'). */
  attesa = 0;
  /**
   * L'effetto della regia che lo porta dritto attraverso gli ostacoli (la Testata: scansandosi passa dietro il cartello del
   * Gregge): finché `fx` è questo, `respingi` non lo sposta. Con un altro effetto, o senza, torna a valere il cartello.
   */
  attraversa: ((dt: number) => boolean) | null = null;
  private modoViaggio: 'corre' | 'vola' = 'corre';
  private daViaggio: Area;
  private readonly corpo: CorpoAgnello;
  private readonly dintorni: Dintorni;

  constructor(ctx: Contesto, a: Area, corpo?: CorpoAgnello, dintorni?: Dintorni) {
    this.ctx = ctx;
    this.dintorni = dintorni ?? { amb: ambienteMuto(ctx) };
    this.amb = this.dintorni.amb;
    this.a = a;
    this.daViaggio = a;
    const p = puntoLibero(a, this, ctx.caso);
    this.x = p.x;
    this.y = p.y;
    this.tx = p.x;
    this.ty = p.y;
    this.verso = ctx.caso() < 0.5 ? 1 : -1;
    this.t = this.rand(0.3, 3);
    this.corpo = corpo ?? new CorpoDom(ctx, this.amb, this);
    a.agnelli.push(this);
    a.mostrati++;
    this.dintorni.vivi?.add(this);
    this.dintorni.cambiato?.(a);
  }

  private rand(p: number, q: number): number {
    return p + this.ctx.caso() * (q - p);
  }

  /** In viaggio da un'area all'altra (in partenza, di corsa o in volo). */
  get inViaggio(): boolean {
    return IN_VIAGGIO.has(this.stato);
  }

  /** Può essere alzato dal teatro: è nel suo recinto, libero (né in viaggio, né preso dal meteo o da un gioco, né intrappolato). */
  get sollevabile(): boolean {
    return this.vivo && this.giunto && !this.regia && !this.inViaggio && !this.intrappolato;
  }

  /** Alza l'agnellino sopra la staccionata (decorazione): resta fermo finché non lo si abbassa. Falso se non si può. */
  alza(): boolean {
    if (!this.sollevabile) return false;
    this.sollevato = true;
    return true;
  }

  /** Lo rimette giù: scende e riprende la sua vita (con "Riduci movimento" subito). */
  abbassa(): void {
    this.sollevato = false;
  }

  togli(): void {
    if (!this.vivo) return;
    this.vivo = false;
    // Chi aspettava questo agnellino (un gioco, il meteo) va avanti subito
    if (this.regia) this.annullaRegia();
    this.corpo.togli();
    const i = this.a.agnelli.indexOf(this);
    if (i >= 0) this.a.agnelli.splice(i, 1);
    if (this.giunto) {
      this.a.mostrati--;
      this.dintorni.cambiato?.(this.a);
    }
    this.dintorni.vivi?.delete(this);
    this.ctx.regia.inViaggio.delete(this);
  }

  // Se finisce sopra un ostacolo (il cartello del gregge) scivola fuori dal lato più vicino: così ci gira intorno
  respingi(): void {
    if (this.inViaggio || (this.fx !== null && this.fx === this.attraversa)) return;
    // Dentro un recinto che si restringe, la staccionata spinge dentro chi è rimasto fuori
    const a = this.a;
    if (a.recinto && !this.regia) {
      this.x = clamp(this.x, a.x0, a.x1);
      this.y = clamp(this.y, a.y0, a.y1);
    }
    const z = dentro(a, this.x, this.y);
    if (!z) return;
    const [x0, , x1, y1] = z;
    const sx = this.x - x0, dx = x1 - this.x, giu = y1 - this.y;
    if (giu <= sx && giu <= dx) this.y = y1 + 0.5;
    else {
      // Respinto di lato: scivola lungo il bordo verso il basso, così prima o poi lo aggira invece di restare fermo
      this.x = sx < dx ? x0 - 0.5 : x1 + 0.5;
      this.y = Math.min(this.y + 1.4, y1 + 0.5);
    }
  }

  // Colpito dal fulmine: resta stordito, annerito e con i peli ritti, poi si scrolla
  fulmina(durata: number, m?: ManigliaMeteo): void {
    const ctx = this.ctx;
    prendi([this]);
    if (m) m.pulisci(() => rilascia([this]));
    this.shockFino = ctx.T + durata;
    this.bruciato = 1;
    const fine = this.shockFino;
    let prossimo = 0;
    void effetto(this, (dt) => {
      this.brivido = 0.6;
      this.sy = 0.95;
      this.sx = 1.05;
      prossimo -= dt;
      if (prossimo <= 0) {
        prossimo = this.rand(0.3, 0.55);
        const k = this.amb.profondita(this.y);
        this.amb.fumata(this.x, this.y - 16 * k, 1, 0.6 * k);
      }
      if (ctx.caso() < dt * 2) {
        this.amb.particella('scintilla', this.x, this.y - 14 * this.amb.profondita(this.y), {
          vx: this.rand(-40, 40),
          vy: this.rand(-70, -20),
          vita: 0.4,
          k: 0.45,
        });
      }
      return ctx.T >= fine || (!!m && !m.vivo);
    })
      .then(() => {
        this.brivido = 0;
        this.shockFino = 0;
        if (this.regia) return effetto(this, saltello(this, 10));
        return undefined;
      })
      .then(() => rilascia([this]));
  }

  salta(n = 1): void {
    // Chi è in viaggio non si ferma a saltare: perderebbe la strada (e il conto)
    if (this.inViaggio) return;
    this.stato = 'salta';
    this.fase = 0;
    this.nSalti = n;
  }

  guarda(x: number): void {
    if (this.stato === 'fermo' || this.stato === 'bruca' || this.stato === 'cammina') {
      this.stato = 'guarda';
      this.t = this.rand(0.9, 1.6);
      this.gx = x;
    }
  }

  // Un agnellino "in regia" è guidato da un gioco con un altro agnellino o da un evento meteo
  annullaRegia(): void {
    this.regia = false;
    this.ox = 0;
    this.poi = null;
    const fini = [this.mossa && this.mossa.fine, this.fxFine];
    this.mossa = null;
    this.fx = null;
    this.fxFine = null;
    fini.forEach((f) => f && f());
  }

  passoRegia(dt: number): void {
    if (this.fx) {
      if (this.fx(dt)) {
        const f = this.fxFine;
        this.fx = null;
        this.fxFine = null;
        if (f) f();
      }
      return;
    }
    const m = this.mossa;
    if (!m) return;
    const v = m.vel * this.amb.profondita(this.y), dx = m.x - this.x, dy = m.y - this.y, d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.6) this.verso = dx > 0 ? 1 : -1;
    // Rete di sicurezza: nessuno spostamento guidato dura più di 8 secondi, così niente resta mai ad aspettare
    if (d <= v * dt || this.ctx.T - m.da > 8) {
      this.x = m.x;
      this.y = m.y;
      this.mossa = null;
      m.fine();
      return;
    }
    this.x += (dx / d) * v * dt;
    this.y += (dy / d) * v * dt;
    this.fase += dt * 9;
    this.hop = Math.abs(Math.sin(this.fase)) * m.salto;
  }

  /**
   * Va in un'altra area. L'appartenenza cambia subito (il conto degli assegnati segue il motore); la corsa o il volo
   * partono dopo `ritardoS` secondi di scena (gli scaglioni di `sposta`), intanto l'agnellino aspetta in 'parte'.
   */
  vaiIn(a: Area, modo: 'corre' | 'vola' = 'corre', ritardoS = 0): void {
    if (this.regia) this.annullaRegia();
    // Chi cambia area esce anche dalla trappola: obbedisce al motore, non al mulinello
    this.intrappolato = false;
    this.sollevato = false;
    this.quota = 0;
    const da = this.a;
    const i = da.agnelli.indexOf(this);
    if (i >= 0) da.agnelli.splice(i, 1);
    // Chi era già per strada non era contato nei mostrati: rimandato altrove a metà strada non toglie due volte
    if (this.giunto) {
      da.mostrati--;
      this.dintorni.cambiato?.(da);
    }
    this.giunto = false;
    this.a = a;
    a.agnelli.push(this);
    const p = puntoLibero(a, this, this.ctx.caso);
    this.tx = p.x;
    this.ty = p.y;
    this.modoViaggio = modo;
    this.daViaggio = da;
    this.poi = null;
    this.ctx.regia.inViaggio.add(this);
    if (ritardoS > 0) {
      this.stato = 'parte';
      this.attesa = ritardoS;
    } else this.parti();
  }

  /** Dopo l'attesa la corsa o il volo cominciano davvero (bozza, righe 1286–1290). */
  private parti(): void {
    if (this.modoViaggio === 'vola') {
      this.stato = 'vola';
      this.x0 = this.x;
      this.y0 = this.y;
      this.fase = 0;
      this.durata = this.rand(0.8, 1.1);
      this.giro = 0;
      this.versoGiro = this.ctx.caso() < 0.5 ? 1 : -1;
    } else {
      this.stato = 'corre';
      this.fase = 0;
    }
    if (this.daViaggio !== this.a) this.ctx.suona('beee', 1.6);
  }

  /** Lasciato dalla regia a metà strada (meteo, gioco): riprende la corsa verso la sua area. */
  riprendiViaggio(): void {
    if (this.giunto || !this.vivo) return;
    // La meta si ricalcola: la regia può averlo portato ovunque, e una meta vecchia può essere quella sotto i piedi
    const p = puntoLibero(this.a, this, this.ctx.caso);
    this.tx = p.x;
    this.ty = p.y;
    this.stato = 'corre';
    this.fase = 0;
    this.ctx.regia.inViaggio.add(this);
  }

  private arrivato(): void {
    this.stato = 'atterra';
    this.t = 0.28;
    this.giunto = true;
    this.a.mostrati++;
    this.dintorni.cambiato?.(this.a);
    this.ctx.suona('pop');
    this.ctx.regia.inViaggio.delete(this);
    for (const o of this.a.agnelli) if (o !== this && this.ctx.caso() < 0.8) o.guarda(this.x);
  }

  private scegli(): void {
    const ctx = this.ctx;
    const ag = agitazione(this.a), r = ctx.caso(), gregge = this.a.nome === 'gregge';
    const pDorme = ctx.ridotto ? 0.1 : 0.04 + 0.32 * ctx.sera * (1 - ag);
    const pSalta = ctx.ridotto ? 0 : 0.05 + 0.45 * ag;
    const pBruca = gregge ? 0.55 : 0.32;
    if (r < pDorme && ctx.sera > 0.4 && !gregge && ctx.caso() < 0.75) {
      // Verso sera si addormentano vicini, tutti nello stesso angolo del recinto
      const k = this.amb.profondita(this.y);
      const c = { x: this.a.x0 + (this.a.x1 - this.a.x0) * 0.28, y: (this.a.y0 + this.a.y1) / 2 };
      this.tx = clamp(c.x + this.rand(-26, 26) * k, this.a.x0, this.a.x1);
      this.ty = clamp(c.y + this.rand(-14, 14) * k, this.a.y0, this.a.y1);
      this.stato = 'cammina';
      this.poi = 'dorme';
    } else if (r < pDorme) {
      this.stato = 'dorme';
      this.t = this.rand(4, 9);
      this.prossimaZeta = this.rand(0.5, 2);
    } else if (r < pDorme + pSalta) this.salta(1 + Math.floor(ctx.caso() * 2));
    else if (r < pDorme + pSalta + pBruca || ctx.ridotto) {
      this.stato = 'bruca';
      this.t = this.rand(2, 5);
    } else {
      const p = vicinoLibero(this, ctx.caso);
      this.tx = p.x;
      this.ty = p.y;
      this.stato = 'cammina';
    }
  }

  passo(dt: number, ora: number): void {
    this.t -= dt;
    this.incl = 0;
    this.sx = 1;
    this.sy = 1;
    this.hop = 0;
    if (this.sollevato && this.sollevabile) {
      // Alzato dal teatro: fermo, sale sopra la staccionata (subito con "Riduci movimento"); il resto della vita aspetta
      this.stato = 'fermo';
      this.t = 1;
      this.quota = this.ctx.ridotto ? QUOTA_ALZATO : Math.min(QUOTA_ALZATO, this.quota + dt * VEL_SALITA);
      this.hop = this.quota;
      this.disegna();
      return;
    }
    if (this.regia) {
      // Preso dal meteo o da un gioco mentre era alzato: torna a terra
      this.sollevato = false;
      this.quota = 0;
      this.passoRegia(dt);
      this.respingi();
      this.disegna();
      return;
    }
    switch (this.stato) {
      case 'fermo':
        if (this.t <= 0) this.scegli();
        break;
      case 'parte':
        this.attesa -= dt;
        if (this.attesa <= 0) this.parti();
        break;
      case 'cammina':
      case 'corre': {
        const corre = this.stato === 'corre', ag = agitazione(this.a);
        const v = (corre ? 150 : 16 + ag * 26) * this.amb.profondita(this.y);
        const dx = this.tx - this.x, dy = this.ty - this.y, d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.6) this.verso = dx > 0 ? 1 : -1;
        if (d <= v * dt) {
          this.x = this.tx;
          this.y = this.ty;
          if (corre) this.arrivato();
          else if (this.poi === 'dorme') {
            this.poi = null;
            this.stato = 'dorme';
            this.t = this.rand(6, 12);
            this.prossimaZeta = this.rand(0.5, 1.5);
          } else {
            this.stato = 'fermo';
            this.t = this.rand(0.6, 2.5);
          }
        } else {
          this.x += (dx / d) * v * dt;
          this.y += (dy / d) * v * dt;
        }
        this.fase += dt * (corre ? 12 : 7.5);
        this.hop = Math.abs(Math.sin(this.fase)) * (corre ? 10 : 2.6);
        this.sy = 1 + Math.cos(this.fase * 2) * (corre ? 0.07 : 0.03);
        this.sx = 1 / this.sy;
        break;
      }
      case 'bruca':
        this.incl = 9 + Math.sin(ora * 0.009 + this.x) * 4;
        if (this.t <= 0) {
          this.stato = 'fermo';
          this.t = this.rand(0.5, 2);
        }
        break;
      case 'dorme':
        this.sy = 0.86 + Math.sin(ora * 0.002 + this.x) * 0.025;
        this.sx = 1.08;
        this.incl = -3;
        this.prossimaZeta -= dt;
        if (this.prossimaZeta <= 0) {
          this.prossimaZeta = this.rand(1.4, 2.6);
          this.amb.zeta(this.x, this.y - 24 * this.amb.profondita(this.y));
        }
        if (this.t <= 0) {
          this.stato = 'fermo';
          this.t = this.rand(0.5, 2);
        }
        break;
      case 'salta': {
        this.fase += dt * 10;
        const s = Math.sin(this.fase);
        if (s >= 0) {
          this.hop = s * 13;
          this.sy = 1 + s * 0.08;
          this.sx = 1 / this.sy;
        } else {
          this.sy = 1 + s * 0.22;
          this.sx = 1 / this.sy;
        }
        if (this.fase >= Math.PI * 2 * this.nSalti) {
          this.stato = 'fermo';
          this.t = this.rand(0.4, 1.5);
        }
        break;
      }
      case 'guarda':
        this.verso = this.gx > this.x ? 1 : -1;
        if (this.t <= 0) {
          this.stato = 'fermo';
          this.t = this.rand(0.3, 1.2);
        }
        break;
      case 'atterra': {
        const p = 1 - Math.max(0, this.t) / 0.28;
        this.sy = 1 - 0.28 * Math.sin(p * Math.PI);
        this.sx = 1 / this.sy;
        if (this.t <= 0) {
          this.stato = 'fermo';
          this.t = this.rand(0.6, 2);
        }
        break;
      }
      case 'vola': {
        this.fase += dt / this.durata;
        const p = Math.min(1, this.fase);
        this.x = this.x0 + (this.tx - this.x0) * p;
        this.y = this.y0 + (this.ty - this.y0) * p;
        this.hop = Math.sin(p * Math.PI) * 90;
        this.incl = p * 360 * this.versoGiro;
        this.verso = this.tx > this.x0 ? 1 : -1;
        if (p >= 1) {
          this.incl = 0;
          this.arrivato();
        }
        break;
      }
      case 'regia':
        // Lasciato dalla regia senza un nuovo stato: riprende la strada, o torna libero
        if (!this.giunto) this.riprendiViaggio();
        else {
          this.stato = 'fermo';
          this.t = this.rand(0.8, 2.5);
        }
        break;
    }
    // Appena abbassato: scende piano piano (subito con "Riduci movimento")
    if (this.quota > 0) {
      this.quota = this.ctx.ridotto ? 0 : Math.max(0, this.quota - dt * VEL_DISCESA);
      this.hop += this.quota;
    }
    this.respingi();
    this.disegna();
  }

  /** Brina e fuliggine seguono la loro meta piano piano; poi il corpo disegna (bozza, righe 1351–1353). */
  disegna(): void {
    this.brina += (this.brinaMeta - this.brina) * 0.03;
    if (!this.shockFino && this.bruciato > 0) this.bruciato = Math.max(0, this.bruciato - 0.012);
    this.corpo.disegna(this);
  }
}

/** Strato extra sopra l'agnellino (fuliggine, peli elettrici, occhio sgranato, brina): creato solo quando serve. */
interface Extra {
  fuliggine: SVGGElement;
  peli: SVGGElement;
  occhio: SVGGElement;
  brinaG: SVGGElement;
  base: SVGSVGElement;
}

/** Il corpo nel DOM: ombra, sagoma e strato extra (bozza, righe 1218–1223, 1241–1251 e 1350–1380). */
class CorpoDom implements CorpoAgnello {
  private readonly el: HTMLDivElement;
  private readonly ombra: SVGSVGElement;
  private readonly corpo: HTMLDivElement;
  private extra: Extra | null = null;

  constructor(
    private readonly ctx: Contesto,
    private readonly amb: AmbienteAgnelli,
    g: Agnello,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'agn';
    this.el.innerHTML =
      '<svg class="ombra" viewBox="0 0 40 40" aria-hidden="true"><use href="#agnello"/></svg><div class="corpo"><svg viewBox="0 0 40 40" aria-hidden="true"><use href="#agnello"/></svg></div>';
    this.ombra = this.el.querySelector<SVGSVGElement>('svg.ombra')!;
    this.corpo = this.el.querySelector<HTMLDivElement>('.corpo')!;
    // L'agnellino toccato salta e bela (chi è in viaggio no)
    this.corpo.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!g.inViaggio) {
        g.salta(2);
        ctx.suona('beee', 1.7);
      }
    });
    ctx.el.mondo.appendChild(this.el);
  }

  private creaExtra(): Extra {
    const N = P.notte, s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 40 40');
    s.setAttribute('class', 'extra');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML =
      `<g class="x-fuliggine" opacity="0" fill="${N}"><ellipse cx="14" cy="21" rx="3.2" ry="2" opacity=".5"/><ellipse cx="22" cy="15" rx="3.6" ry="2.2" opacity=".5"/><ellipse cx="21" cy="25" rx="3" ry="1.8" opacity=".5"/></g>` +
      `<g class="x-peli" opacity="0" fill="none" stroke="${N}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7.4 l-1.6 -2 l2.6 -1.4 l-1.4 -2.4"/><path d="M12 13.6 l-2.4 -0.8 l0.6 -2.6 l-2.4 -0.8"/><path d="M27 15 l2.2 -1.4 l-0.6 -2.4 l2.2 -1.2"/><path d="M6 21.5 l-2.4 0.4 l-0.6 -2.4 l-2.2 0.2"/></g>` +
      `<g class="x-occhio" opacity="0"><circle cx="32.8" cy="13.2" r="2.7" fill="${P.gesso}" stroke="${N}" stroke-width="1"/><circle cx="33.2" cy="13.5" r="0.95" fill="${N}"/></g>` +
      `<g class="x-brina" opacity="0" stroke="${N}" stroke-linejoin="round"><ellipse cx="20" cy="8.4" rx="6.8" ry="2.6" fill="${P.gesso}" stroke-width="1.2"/><ellipse cx="12.6" cy="14.2" rx="4" ry="1.7" fill="${P.gesso}" stroke-width="1.1"/><ellipse cx="26.6" cy="15.8" rx="3.6" ry="1.6" fill="${P.gesso}" stroke-width="1.1"/><path d="M16.6 31.4 L18.2 36 L19.8 31.4 Z" fill="${P.celeste}" stroke-width="0.9"/></g>`;
    this.corpo.appendChild(s);
    return {
      fuliggine: s.querySelector<SVGGElement>('.x-fuliggine')!,
      peli: s.querySelector<SVGGElement>('.x-peli')!,
      occhio: s.querySelector<SVGGElement>('.x-occhio')!,
      brinaG: s.querySelector<SVGGElement>('.x-brina')!,
      base: this.corpo.firstElementChild as SVGSVGElement,
    };
  }

  disegna(g: Agnello): void {
    const ctx = this.ctx, amb = this.amb;
    const k = amb.profondita(g.y);
    if (g.brina > 0.01 || g.bruciato > 0.01 || g.shockFino) {
      if (!this.extra) this.extra = this.creaExtra();
      const x = this.extra;
      x.brinaG.setAttribute('opacity', g.brina.toFixed(2));
      x.fuliggine.setAttribute('opacity', g.bruciato.toFixed(2));
      x.peli.setAttribute('opacity', g.shockFino ? (0.7 + ctx.caso() * 0.3).toFixed(2) : '0');
      x.occhio.setAttribute('opacity', g.shockFino ? '1' : '0');
      x.base.style.filter =
        g.bruciato > 0.01 ? `brightness(${(1 - 0.35 * g.bruciato).toFixed(3)}) sepia(${(0.4 * g.bruciato).toFixed(3)})` : '';
    } else if (this.extra) {
      this.extra.base.style.filter = '';
      this.extra.brinaG.setAttribute('opacity', '0');
      this.extra.fuliggine.setAttribute('opacity', '0');
    }
    const sf = g.a.sfumata ? '0' : g.a.attenuata !== undefined ? String(g.a.attenuata) : '';
    if (this.el.style.opacity !== sf) this.el.style.opacity = sf;
    const brr = g.brivido > 0 ? Math.sin(ctx.T * 70 + g.x) * 0.9 * g.brivido : 0;
    this.el.style.transform = `translate(${(g.x + g.ox + brr).toFixed(1)}px,${g.y.toFixed(1)}px)`;
    this.el.style.zIndex = String(100 + Math.round(g.y) + (g.stato === 'vola' || g.stato === 'corre' || g.quota > 0 ? 600 : 0));
    // Alzato dal teatro (furto): serve a chi vuole riconoscerlo
    if (this.el.classList.contains('alzato') !== g.sollevato) this.el.classList.toggle('alzato', g.sollevato);
    const piega = g.stato === 'vola' ? 0 : clamp(-amb.ventoIn(g.x) * 11, -14, 6);
    this.corpo.style.transform = `translate(-14px,${(-25.8 - g.hop * k).toFixed(1)}px) skewX(${piega.toFixed(1)}deg) scale(${(g.verso * g.sx * k).toFixed(3)},${(g.sy * k).toFixed(3)}) rotate(${g.incl.toFixed(1)}deg)`;
    // Ombra: la sagoma dell'agnellino proiettata a terra dalla parte opposta al sole; resta giù quando salta, e si stringe
    const L = amb.LUCE;
    const su = Math.max(0.5, 1 - g.hop / 50), a = L.dx * L.lung, b = 0.42 * L.lung;
    this.ombra.style.transform = `matrix(1,0,${(-a).toFixed(3)},${(-b).toFixed(3)},0,0) scale(${(g.verso * k * su).toFixed(3)},${(k * su).toFixed(3)})`;
  }

  togli(): void {
    this.el.remove();
  }
}
