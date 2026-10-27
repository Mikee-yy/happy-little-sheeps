// Le zone della fionda sul recinto del bersaglio, disegnate come le conta `zonaDi` (tiro.ts), con il numero di agnellini di
// ogni zona in un bollino (pillola di gesso con il bordo notte, come i fumetti dei belati):
// - la fascia della zona 1: il recinto allargato di `fasciaBordo` (frazione di larghezza e altezza), con gli angoli tondi
//   (quarti d'ellisse attorno agli spigoli), tratteggiata; il suo "1" sta nella fascia, a destra fuori dalla staccionata
//   (a sinistra se a destra uscirebbe dalla scena);
// - il recinto (zona 2, dalla staccionata in dentro): il suo "2" sulla destra, tra il centro e la staccionata;
// - l'ellisse del centro (zona 3): il "3" in mezzo.
// Li disegna solo la mira (sul recinto ingrandito, solo mentre si carica il tiro): dopo il lancio la Testata degli ordini
// non li mostra. Lo stile sta in scena.css (`.fionda-cerchi`).
import { W } from '../misure';
import { FIONDA, valoriCerchi, type Rett } from './tiro';

const NS = 'http://www.w3.org/2000/svg';

/** Un elemento svg con gli attributi dati. */
function crea<K extends keyof SVGElementTagNameMap>(tag: K, attributi: Record<string, number | string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attributi)) e.setAttribute(k, String(v));
  return e;
}

/** Mette nell'svg `dove` le tre zone e i tre bollini per il recinto `r`, con i numeri limitati a `massimo`. */
export function disegnaCerchi(dove: SVGSVGElement, r: Rett, massimo: number): void {
  const l = r.x1 - r.x0, h = r.y1 - r.y0;
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const mezzaL = l / 2, mezzaA = h / 2;
  const { centro } = FIONDA.cerchi;
  const fx = FIONDA.fasciaBordo.x * l, fy = FIONDA.fasciaBordo.y * h;
  const [v3, v2, v1] = valoriCerchi(massimo);
  const corpo = Math.max(FIONDA.bollini.corpo, Math.min(FIONDA.bollini.corpoMassimo, mezzaA * 0.45));
  const alto = corpo + 6, largo = corpo * 0.7 + 10;
  /** Un bollino centrato in (x, cy): la pillola larga quanto il numero (una cifra) più il respiro ai lati. */
  const bollino = (valore: number, x: number): SVGGElement => {
    const g = crea('g', { class: 'bollino' });
    const t = crea('text', { x, y: cy, 'font-size': corpo });
    t.textContent = String(valore);
    g.append(crea('rect', { x: x - largo / 2, y: cy - alto / 2, width: largo, height: alto, rx: alto / 2 }), t);
    return g;
  };
  // L'1 a metà della fascia, a destra; a sinistra se lì la pillola uscirebbe dalla scena
  const unoDestra = r.x1 + fx / 2;
  const uno = unoDestra + largo / 2 <= W ? unoDestra : r.x0 - fx / 2;
  dove.replaceChildren(
    crea('rect', { class: 'fascia', x: r.x0 - fx, y: r.y0 - fy, width: l + 2 * fx, height: h + 2 * fy, rx: fx, ry: fy }),
    crea('rect', { class: 'dentro', x: r.x0, y: r.y0, width: l, height: h }),
    crea('ellipse', { class: 'centro', cx, cy, rx: centro * mezzaL, ry: centro * mezzaA }),
    bollino(v3, cx),
    bollino(v2, cx + ((centro + 1) / 2) * mezzaL * 0.9),
    bollino(v1, uno),
  );
}
