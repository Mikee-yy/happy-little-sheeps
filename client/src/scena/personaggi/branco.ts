// Il branco: tutti gli agnellini della scena e le loro aree (bozza scena.src.html, righe 1131, 1212, 1544–1545,
// 1964–1971 e 2613–2622). La verità sui conti è il motore: `allinea` porta gli assegnati subito all'obiettivo
// e manda di corsa chi serve; i mostrati (i cartelli) seguono quando gli agnellini arrivano.
import type { Luogo } from '../../../../engine/src';
import type { Contesto } from '../contesto';
import { Agnello, ambienteMuto, inViaggioValido, type AmbienteAgnelli, type CorpoAgnello, type Dintorni } from './agnello';
import type { Area } from './aree';
import { creaPianificatore, pianificaGiochi, type Pianificatore } from './giochi';

/** Secondi tra la partenza di un agnellino e quella del successivo (bozza, riga 1969). */
const SCAGLIONE_S = 0.23;

export interface OpzioniBranco {
  /** L'ambiente del teatro; senza, un ambiente muto con la `prospettiva` del branco. */
  ambiente?: AmbienteAgnelli;
  /** Corpo di ogni nuovo agnellino (prove); senza, quello DOM. */
  corpo?: () => CorpoAgnello;
}

export class Branco {
  aree = new Map<Luogo, Area>();
  agnelli = new Set<Agnello>();
  /** Prospettiva dell'ambiente muto: [y della fila degli avversari, scala della loro pecora]. */
  prospettiva: readonly [number, number] = [170, 0.5];
  /** Chiamata quando cambia il numero degli arrivati di un'area (il teatro aggiorna il cartello). */
  suCambioConto: ((a: Area) => void) | null = null;
  readonly giochi: Pianificatore;
  private readonly dintorni: Dintorni;

  constructor(
    private readonly ctx: Contesto,
    private readonly o: OpzioniBranco = {},
  ) {
    const amb = o.ambiente ?? ambienteMuto(ctx, () => this.prospettiva);
    this.dintorni = { amb, vivi: this.agnelli, cambiato: (a) => this.suCambioConto?.(a) };
    this.giochi = creaPianificatore(ctx);
    // La regia chiede al branco chi è davvero in viaggio: in partenza, di corsa, in volo o preso per strada
    ctx.inViaggioValido = inViaggioValido;
  }

  private nuovo(a: Area): Agnello {
    return new Agnello(this.ctx, a, this.o.corpo?.(), this.dintorni);
  }

  /** Toglie tutti e crea gli agnellini già al loro posto. Le aree sono nell'ordine dei posti: la prima è chi sta in basso. */
  costruisci(aree: Area[], conti: Map<Luogo, number>): void {
    this.togli();
    this.aree = new Map(aree.map((a) => [a.nome, a]));
    for (const a of aree) {
      a.agnelli = [];
      a.mostrati = 0;
    }
    for (const [luogo, n] of conti) {
      const a = this.aree.get(luogo);
      if (!a) {
        console.error(`Branco: luogo sconosciuto "${luogo}"`);
        continue;
      }
      for (let i = 0; i < n; i++) this.nuovo(a);
    }
    for (const a of aree) this.suCambioConto?.(a);
    const giocatori = aree.filter((a) => a.nome !== 'gregge');
    Object.assign(this.giochi, {
      prossimo: 3,
      inBasso: giocatori[0] ?? null,
      gregge: this.aree.get('gregge') ?? null,
      altri: giocatori.slice(1),
    });
  }

  /**
   * Porta gli assegnati di ogni luogo all'obiettivo (che viene dal motore, quindi è già valido: niente limite di posti).
   * Restituisce quanti agnellini partono. Il totale non cambia mai: un obiettivo con un altro totale è un errore,
   * si scrive in console e si ricostruisce tutto con `costruisci`.
   */
  allinea(obiettivo: Map<Luogo, number>): number {
    let totale = 0;
    for (const n of obiettivo.values()) totale += n;
    const sconosciuto = [...obiettivo.keys()].some((l) => !this.aree.has(l));
    if (totale !== this.agnelli.size || sconosciuto) {
      if (totale !== this.agnelli.size) console.error(`Branco: l'obiettivo ha ${totale} agnellini, la scena ${this.agnelli.size}; si ricostruisce`);
      this.costruisci([...this.aree.values()], obiettivo);
      return 0;
    }
    const scarto = new Map<Luogo, number>();
    for (const [nome, a] of this.aree) scarto.set(nome, a.agnelli.length - (obiettivo.get(nome) ?? 0));
    // Il gregge ha la precedenza, come origine e come destinazione
    const primaIlGregge = (l: Luogo[]) => l.sort((p, q) => Number(q === 'gregge') - Number(p === 'gregge'));
    const origini = primaIlGregge([...scarto].filter(([, d]) => d > 0).map(([l]) => l));
    const destinazioni = primaIlGregge([...scarto].filter(([, d]) => d < 0).map(([l]) => l));
    let partiti = 0;
    for (const o of origini) {
      const da = this.aree.get(o)!;
      let eccesso = scarto.get(o)!;
      for (const d of destinazioni) {
        if (eccesso <= 0) break;
        const mancano = -scarto.get(d)!;
        if (mancano <= 0) continue;
        const a = this.aree.get(d)!;
        const n = Math.min(eccesso, mancano);
        for (const g of this.scegliPerAllinea(da, a, n)) g.vaiIn(a, 'corre', SCAGLIONE_S * partiti++);
        eccesso -= n;
        scarto.set(d, scarto.get(d)! + n);
      }
    }
    return partiti;
  }

  /** Prima gli arrivati e non intrappolati, poi gli altri; a parità i più vicini alla destinazione. */
  private scegliPerAllinea(da: Area, a: Area, n: number): Agnello[] {
    const cx = (a.x0 + a.x1) / 2, cy = (a.y0 + a.y1) / 2;
    const gruppo = (g: Agnello) => (g.giunto && !g.intrappolato ? 0 : 1);
    return [...da.agnelli]
      .sort((p, q) => gruppo(p) - gruppo(q) || Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))
      .slice(0, n);
  }

  /** Sposta fino a `n` agnellini (bozza, riga 1964): limitato dai posti liberi e da chi c'è; partono a scaglioni. */
  sposta(n: number, da: Luogo, a: Luogo, modo: 'corre' | 'vola' = 'corre'): number {
    const D = this.aree.get(da), A = this.aree.get(a);
    if (!D || !A) return 0;
    const liberi = A.posti === Infinity ? Infinity : A.posti - A.agnelli.length;
    const quanti = Math.min(n, liberi, D.agnelli.length);
    if (quanti <= 0) return 0;
    const cx = (A.x0 + A.x1) / 2, cy = (A.y0 + A.y1) / 2;
    const scelti = D.agnelli
      .filter((g) => !g.inViaggio && !g.intrappolato)
      .sort((p, q) => Math.hypot(p.x - cx, p.y - cy) - Math.hypot(q.x - cx, q.y - cy))
      .slice(0, quanti);
    scelti.forEach((g, i) => g.vaiIn(A, modo, i * SCAGLIONE_S));
    return scelti.length;
  }

  conti(): Map<Luogo, { assegnati: number; mostrati: number }> {
    return new Map([...this.aree].map(([nome, a]) => [nome, { assegnati: a.agnelli.length, mostrati: a.mostrati }]));
  }

  /** Quanti non sono ancora arrivati nella loro area. */
  inViaggio(): number {
    let n = 0;
    for (const g of this.agnelli) if (!g.giunto) n++;
    return n;
  }

  intrappolati(): number {
    let n = 0;
    for (const g of this.agnelli) if (g.intrappolato) n++;
    return n;
  }

  /** Un passo della scena: prima gli agnellini, poi i giochi (bozza, righe 1544–1545). */
  passo(dt: number, ora: number): void {
    for (const g of this.agnelli) g.passo(dt, ora);
    pianificaGiochi(this.giochi, dt);
  }

  togli(): void {
    for (const g of [...this.agnelli]) g.togli();
    this.agnelli.clear();
  }
}
