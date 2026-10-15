// Le postazioni dei giocatori (bozza scena.src.html, righe 1731–1739 e 1805–1840): pecora, targa con i segnalini,
// angolo dei Guai, e per gli avversari lo sterrato con il ventaglio di dorsi. Qui stanno anche le carte giocate nel round.
// Niente sbirciate: il DOM non contiene mai il nome di una carta coperta. La carta del round coperta è solo un dorso
// e i ventagli degli avversari sono solo dorsi, per quante carte hanno in mano.
import type { IdCarta, IdGiocatore } from '../../../../engine/src';
import { T } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import { cartaSVG, retroSVG } from '../carte/carte';
import type { Contesto } from '../contesto';
import type { Disposizione, PostoDisp } from '../disposizioni';
import type { Fotografia, PostoFoto } from '../fotografia';
import type { Lettura } from '../lettura';
import { ambienteMuto, type AmbienteAgnelli } from '../personaggi/agnello';
import { aggiornaFumetti, fumetto, Pecora, togliFumetti } from '../personaggi/pecora';
import { rng, sincronizza, svuota, type Voce } from './comune';
import { nomeLungo, spaziTarghe, stileSegnalini, stileTarga, type SpazioTarga } from './targhe';

const NS = 'http://www.w3.org/2000/svg';

export interface Postazioni {
  /** Le pecore dei giocatori, per id (si ricostruiscono se cambiano i giocatori o chi sta in basso). */
  readonly pecore: ReadonlyMap<IdGiocatore, Pecora>;
  /** Mette in pari targhe, segnalini, angoli, sterrati, ventagli e carte del round con la fotografia. `subito`: senza dissolvenze. */
  aggiorna(f: Fotografia, subito?: boolean): void;
  /** Un passo della scena: le pecore e i fumetti. */
  passo(dt: number): void;
  /** Un fumetto accanto alla pecora del giocatore. */
  fumetto(chi: IdGiocatore, testo: string, durata?: number): void;
  distruggi(): void;
}

export interface OpzioniPostazioni {
  /** L'ambiente del teatro (vento, luce, particelle); senza, un ambiente muto. */
  ambiente?: AmbienteAgnelli;
  /** Ingrandimento dell'inquadratura, per i fumetti. */
  zoom?: () => number;
}

/** Un giocatore al suo posto: tutti gli elementi che gli appartengono. */
class Postazione {
  readonly pecora: Pecora;
  private readonly targa: HTMLElement;
  private readonly segnalini: HTMLElement;
  private readonly terreno: SVGSVGElement | null = null;
  private readonly ventaglio: HTMLElement | null = null;
  private readonly carteRound: HTMLElement;
  private readonly minis = new Map<string, HTMLElement>();
  private readonly giocate = new Map<string, HTMLElement>();
  private chiaveSegnalini = '';
  private carteVentaglio = -1;

  constructor(
    private readonly ctx: Contesto,
    private readonly lettura: Lettura,
    readonly posto: number,
    foto: PostoFoto,
    private readonly p: PostoDisp,
    amb: AmbienteAgnelli,
    private readonly spazio: SpazioTarga,
  ) {
    const mondo = ctx.el.mondo;
    this.pecora = new Pecora(ctx, foto.id, foto.pecora, p, amb, posto);
    this.targa = document.createElement('div');
    this.targa.className = 'targa';
    this.targa.dataset.chi = foto.id;
    // La targa ha una fascia sua (larghezza massima e scivolamento ai bordi): i nomi lunghi non escono e non si sovrappongono
    this.targa.style.cssText = `${stileTarga(spazio)};top:${p.targa[1]}px;z-index:1400`;
    mondo.appendChild(this.targa);
    // I segnalini stanno sopra la targa e crescono verso l'alto
    this.segnalini = document.createElement('div');
    this.segnalini.className = 'segnalini';
    this.segnalini.dataset.chi = foto.id;
    this.segnalini.style.cssText = `${stileSegnalini(spazio)};top:${p.targa[1] - 3}px;z-index:1399`;
    mondo.appendChild(this.segnalini);
    if (p.tappetino) this.terreno = this.creaSterrato(foto.id, p.tappetino);
    if (p.ventaglio) {
      const v = document.createElement('div');
      v.className = 'ventaglio';
      v.dataset.chi = foto.id;
      v.style.cssText = `left:${p.ventaglio[0]}px;top:${p.ventaglio[1]}px;z-index:296`;
      mondo.appendChild(v);
      this.ventaglio = v;
    }
    this.carteRound = document.createElement('div');
    this.carteRound.className = 'carte-round';
    this.carteRound.dataset.chi = foto.id;
    const [cx, cy] = this.centroRound();
    this.carteRound.style.cssText = `left:${cx}px;top:${cy}px;z-index:${posto === 0 ? 785 : 310}`;
    mondo.appendChild(this.carteRound);
  }

  /** Dove stanno le carte del round: davanti a te, a sinistra della mano; per gli avversari sul loro sterrato. */
  private centroRound(): [number, number] {
    const t = this.p.tappetino;
    if (this.posto === 0 || !t) return [10, 560];
    return [t[0] + t[2] / 2, t[1] + t[3] - 3];
  }

  /** Un pezzetto di terra battuta davanti all'avversario, dove posa le sue carte (bozza, righe 1825–1835). */
  private creaSterrato(chi: IdGiocatore, [tx, ty, tw, th]: [number, number, number, number]): SVGSVGElement {
    const caso = rng(5 + this.posto * 4);
    const cx = tw / 2;
    const cy = th / 2;
    const punti: Array<[number, number]> = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 1 + (caso() - 0.5) * 0.14;
      punti.push([cx + Math.cos(a) * (tw / 2 + 4) * r, cy + Math.sin(a) * (th / 2 + 3) * r]);
    }
    const mezzo = (p: [number, number], q: [number, number]): [number, number] => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    let d = `M${mezzo(punti[13]!, punti[0]!).map((v) => v.toFixed(1)).join(' ')}`;
    punti.forEach((p, i) => {
      const m = mezzo(p, punti[(i + 1) % 14]!);
      d += ` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
    });
    const t = document.createElementNS(NS, 'svg');
    t.setAttribute('class', 'terreno');
    t.dataset.chi = chi;
    t.setAttribute('width', String(tw));
    t.setAttribute('height', String(th));
    t.setAttribute('aria-hidden', 'true');
    t.style.left = tx + 'px';
    t.style.top = ty + 'px';
    t.innerHTML = `<path d="${d}" style="fill:var(--sabbia)" stroke="${P.notte}" stroke-width="2" stroke-linejoin="round"/>`;
    this.ctx.el.mondo.appendChild(t);
    return t;
  }

  aggiorna(f: PostoFoto, postiOvile: number, subito: boolean): void {
    // Targa
    const scritta = f.eliminato ? `${f.nome} · ${T.tavolo.eliminata}` : f.nome;
    if (this.targa.textContent !== scritta) {
      this.targa.textContent = scritta;
      // Il nome intero resta leggibile anche quando la targa lo taglia con l'ellissi
      this.targa.title = scritta;
      this.targa.setAttribute('aria-label', scritta);
      this.targa.classList.toggle('lunga', nomeLungo(f.nome, this.spazio.larghezza));
    }
    this.targa.classList.toggle('turno', f.deveAgire);
    this.pecora.svenuta(f.eliminato);
    this.aggiornaSegnalini(f, postiOvile);
    this.aggiornaVentaglio(f);
    this.aggiornaAngolo(f, subito);
    this.aggiornaRound(f, subito);
  }

  private aggiornaSegnalini(f: PostoFoto, postiOvile: number): void {
    const voci: string[] = [];
    if (!f.eliminato) {
      if (f.unGuaioAllEliminazione) {
        voci.push(`<span class="segnalino un-guaio"><span class="avviso-icona" aria-hidden="true">!</span>${T.scena.segnalini.unGuaio}</span>`);
      }
      if (f.quasiPieno) voci.push(`<span class="segnalino quasi-pieno">${T.scena.segnalini.quasiPieno(Math.max(0, postiOvile - f.agnellini))}</span>`);
      if (f.fuoriDalRound) voci.push(`<span class="segnalino fuori">${T.scena.fuoriDalRound}</span>`);
    }
    const html = voci.join('');
    if (html === this.chiaveSegnalini) return;
    this.chiaveSegnalini = html;
    this.segnalini.innerHTML = html;
  }

  /** Il ventaglio dell'avversario: solo dorsi, tanti quante le carte che ha in mano. */
  private aggiornaVentaglio(f: PostoFoto): void {
    const v = this.ventaglio;
    if (!v) return;
    const n = f.eliminato ? 0 : f.carteInMano;
    if (n === this.carteVentaglio) return;
    this.carteVentaglio = n;
    v.innerHTML = Array.from({ length: n }, (_, i) => `<i style="transform:rotate(${(i - (n - 1) / 2) * 11}deg)">${retroSVG(false)}</i>`).join('');
  }

  /** Le mini-carte dei Guai (bozza, righe 1806–1820): toccandone una si apre la lettura. */
  private aggiornaAngolo(f: PostoFoto, subito: boolean): void {
    const io = this.posto === 0;
    const voci: Voce[] = f.angolo.map((id) => ({
      chiave: id,
      crea: () => {
        const m = document.createElement('div');
        m.className = 'mini';
        m.dataset.chi = f.id;
        m.style.cursor = 'pointer';
        m.innerHTML = cartaSVG(id);
        m.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          this.lettura.apri(id, false);
        });
        return m;
      },
      posa: (m, i, n) => {
        const rot = (i - (n - 1) / 2) * (io ? 7 : 9);
        if (io) {
          m.style.cssText += `;left:${10 + i * 25}px;top:${626 + (i % 2) * 3}px;width:38px;height:53px;transform:rotate(${rot}deg);z-index:${780 + i}`;
        } else {
          const [x0, y0] = this.p.guai;
          m.style.cssText += `;left:${x0 + i * 13}px;top:${y0 + (i % 2) * 2}px;width:24px;height:34px;transform:rotate(${rot}deg);z-index:${300 + i}`;
        }
      },
    }));
    sincronizza(this.ctx, this.ctx.el.mondo, this.minis, voci, subito);
  }

  /** Le carte giocate nel round: un dorso se coperte, le carte in piccolo se rivelate (toccandone una si apre la lettura). */
  private aggiornaRound(f: PostoFoto, subito: boolean): void {
    const io = this.posto === 0;
    const l = io ? { w: 38, h: 53 } : { w: 26, h: 36 };
    const g = f.giocata;
    const carte: Array<{ chiave: string; id: IdCarta | null }> = !g ? [] : g.coperta ? [{ chiave: '#coperta', id: null }] : g.carte.map((id) => ({ chiave: id, id }));
    const voci: Voce[] = carte.map(({ chiave, id }) => ({
      chiave,
      crea: () => {
        const c = document.createElement('div');
        c.className = 'carta-round';
        if (id === null) c.innerHTML = retroSVG(false);
        else {
          c.innerHTML = cartaSVG(id);
          c.style.cursor = 'pointer';
          c.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.lettura.apri(id, false);
          });
        }
        return c;
      },
      posa: (c, i, n) => {
        const d = i - (n - 1) / 2;
        const sx = io ? i * (l.w + 4) : d * 18 - l.w / 2;
        const sy = io ? 0 : -l.h;
        c.style.cssText += `;left:${sx}px;top:${sy}px;width:${l.w}px;height:${l.h}px;transform:rotate(${(d * 6).toFixed(1)}deg);transform-origin:50% 100%;z-index:${i}`;
      },
    }));
    sincronizza(this.ctx, this.carteRound, this.giocate, voci, subito);
  }

  togli(): void {
    this.pecora.togli();
    this.targa.remove();
    this.segnalini.remove();
    this.terreno?.remove();
    this.ventaglio?.remove();
    this.carteRound.remove();
    svuota(this.minis);
    svuota(this.giocate);
  }
}

export function creaPostazioni(ctx: Contesto, disp: Disposizione, lettura: Lettura, o: OpzioniPostazioni = {}): Postazioni {
  const amb = o.ambiente ?? ambienteMuto(ctx, () => disp.prospettiva);
  const zoom = o.zoom ?? (() => 1);
  let postazioni: Postazione[] = [];
  let assetto = '';
  const pecore = new Map<IdGiocatore, Pecora>();
  const spazi = spaziTarghe(disp);

  function togliTutto(): void {
    for (const p of postazioni) p.togli();
    postazioni = [];
    pecore.clear();
    togliFumetti(ctx);
  }

  function aggiorna(f: Fotografia, subito = false): void {
    const posti = f.posti.slice(0, disp.posti.length);
    // Chi sta dove (e con quale pecora): se cambia, le postazioni si ricostruiscono
    const chiave = posti.map((p) => `${p.id}:${p.pecora}`).join('|');
    if (chiave !== assetto) {
      togliTutto();
      assetto = chiave;
      posti.forEach((p, i) => {
        const postazione = new Postazione(ctx, lettura, i, p, disp.posti[i]!, amb, spazi[i]!);
        postazioni.push(postazione);
        pecore.set(p.id, postazione.pecora);
      });
    }
    posti.forEach((p, i) => postazioni[i]!.aggiorna(p, f.postiOvile, subito));
  }

  return {
    pecore,
    aggiorna,
    passo(dt) {
      for (const p of postazioni) p.pecora.passo(dt);
      aggiornaFumetti(ctx, zoom);
    },
    fumetto(chi, testo, durata) {
      const i = postazioni.findIndex((p) => p.pecora.chi === chi);
      if (i >= 0) fumetto(ctx, disp.posti[i]!, chi, testo, durata, zoom);
    },
    distruggi() {
      togliTutto();
      assetto = '';
    },
  };
}
