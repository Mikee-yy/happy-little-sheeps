// Il recinto della Testata visto dall'alto, per le Regole: le zone sono quelle della fionda (`zonaDi` di
// scena/fionda/tiro.ts, numeri in fionda.json), disegnate in proporzione su un recinto fisso. Interno Menta con l'ellisse
// del centro Limone, staccionata Fango, fascia appena fuori tratteggiata con gli angoli tondi, tratto Notte; su ogni
// zona il numero di agnellini dei cerchi della mira, e "0" più in là. Il testo alternativo lo mette chi lo mostra
// (`testoAlternativo({ tipo: 'recinto' })`).
import { SETUP } from '../../../engine/src';
import { FIONDA, valoriCerchi, type Rett } from '../scena/fionda/tiro';

/** La cornice del disegno: c'è posto per la fascia e, a destra, per lo "0". */
const LARGO = 320;
const ALTO = 200;
/** Il recinto, in mezzo alla cornice. */
const RECINTO: Rett = { x0: 80, y0: 60, x1: 240, y1: 140 };

const NOTTE = 'var(--colore-inchiostro)';
const TRATTO = 2.5;

/** Le misure del disegno: il recinto, i raggi dell'ellisse del centro e la larghezza della fascia appena fuori. */
export function geometriaRecinto(): { recinto: Rett; centro: { rx: number; ry: number }; fascia: { x: number; y: number } } {
  const r = RECINTO;
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  return {
    recinto: { ...r },
    // In `zonaDi` il centro è l'ellisse con i semiassi del recinto ridotti di `cerchi.centro`
    centro: { rx: FIONDA.cerchi.centro * (w / 2), ry: FIONDA.cerchi.centro * (h / 2) },
    // …e la zona 1 arriva fino a `fasciaBordo` (frazione di larghezza e altezza) fuori dalla staccionata, tonda agli angoli
    fascia: { x: FIONDA.fasciaBordo.x * w, y: FIONDA.fasciaBordo.y * h },
  };
}

export function RecintoZone() {
  const { recinto: r, centro, fascia } = geometriaRecinto();
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const [tre, due, uno] = valoriCerchi(SETUP.testata.esitoMassimo);
  // Dove scrivere i numeri: al centro; dentro, a metà tra l'ellisse e la staccionata; sotto la staccionata, a metà della
  // fascia; a destra, oltre la fascia. La prova (recinto.test.ts) controlla che ogni numero stia nella sua zona.
  const scritte: [number, number, number][] = [
    [tre, cx, cy],
    [due, (r.x0 + cx - centro.rx) / 2, cy],
    [uno, cx, r.y1 + fascia.y / 2 + 2],
    [0, (r.x1 + fascia.x + LARGO) / 2, cy],
  ];
  const paletti = [
    [r.x0, r.y0],
    [r.x1, r.y0],
    [r.x0, r.y1],
    [r.x1, r.y1],
  ];
  return (
    <svg className="recinto-zone" viewBox={`0 0 ${LARGO} ${ALTO}`} aria-hidden="true" focusable="false">
      <rect
        className="recinto-fascia"
        x={r.x0 - fascia.x}
        y={r.y0 - fascia.y}
        width={w + 2 * fascia.x}
        height={h + 2 * fascia.y}
        rx={fascia.x}
        ry={fascia.y}
        fill="none"
        stroke={NOTTE}
        strokeWidth={TRATTO}
        strokeDasharray="7 6"
        strokeLinecap="round"
      />
      <rect className="recinto-interno" x={r.x0} y={r.y0} width={w} height={h} fill="var(--colore-menta)" />
      <ellipse className="recinto-centro" cx={cx} cy={cy} rx={centro.rx} ry={centro.ry} fill="var(--colore-limone)" stroke={NOTTE} strokeWidth={TRATTO} />
      {/* La staccionata: una banda Fango con il bordo Notte (sotto la stessa linea, più larga, in Notte) */}
      <rect x={r.x0} y={r.y0} width={w} height={h} fill="none" stroke={NOTTE} strokeWidth={10} strokeLinejoin="round" />
      <rect className="recinto-staccionata" x={r.x0} y={r.y0} width={w} height={h} fill="none" stroke="var(--colore-fango)" strokeWidth={5} strokeLinejoin="round" />
      {paletti.map(([x, y]) => (
        <rect key={`${x},${y}`} x={x! - 6} y={y! - 6} width={12} height={12} rx={2} fill="var(--colore-fango)" stroke={NOTTE} strokeWidth={TRATTO} />
      ))}
      {scritte.map(([n, x, y], i) => (
        <text
          key={i}
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={NOTTE}
          style={{ font: '800 20px var(--font-titoli)' }}
        >
          {n}
        </text>
      ))}
    </svg>
  );
}
