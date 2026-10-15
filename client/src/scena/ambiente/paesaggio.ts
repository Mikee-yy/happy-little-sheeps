// Paesaggio: colline, alberi, prato e la stalla lontana (bozza scena.src.html, righe 329 e 704–724).
// Disegnato una volta sola nell'SVG `.paesaggio`.

/** La tavolozza della bozza (riga 329), solo per i valori dentro gli SVG e la tela generati nel codice. */
export const TAVOLOZZA = {
  notte: '#23264A',
  gesso: '#FBFAF5',
  menta: '#9ED9C3',
  lilla: '#C4B3EE',
  albicocca: '#F7B98B',
  limone: '#F2E27A',
  fango: '#CDB08F',
  nebbia: '#E4E9F2',
  celeste: '#B5D6F2',
} as const;

/** Grigio del fumo e della lana di vento (bozza, riga 2234). */
export const GRIGIO_FUMO = '#AAAFBF';

const P = TAVOLOZZA;

export function disegnaPaesaggio(svg: SVGSVGElement): void {
  const doppio = (forme: string, colore: string) =>
    `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="5" stroke-linejoin="round">${forme}</g><g style="fill:${colore}">${forme}</g>`;
  const ell = (l: number[][]) => l.map(([cx, cy, rx, ry]) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`).join('');
  const albero = (x: number, y: number, k: number) => {
    const chioma = `<circle cx="${x}" cy="${y - 20 * k}" r="${11 * k}"/><circle cx="${x - 9 * k}" cy="${y - 12 * k}" r="${9 * k}"/><circle cx="${x + 9 * k}" cy="${y - 12 * k}" r="${9 * k}"/>`;
    return `<rect x="${x - 2.5 * k}" y="${y - 8 * k}" width="${5 * k}" height="${12 * k}" rx="${2 * k}" fill="${P.notte}"/>` + doppio(chioma, 'var(--menta)');
  };
  let s = '';
  s += doppio(ell([[-430, 182, 440, 100], [52, 156, 150, 54], [246, 146, 168, 48], [478, 158, 196, 60], [930, 182, 440, 100]]), 'var(--collina)');
  s += albero(36, 112, 1) + albero(292, 104, 0.9) + albero(-90, 120, 1.1) + albero(500, 108, 1);
  s += doppio(ell([[-520, 214, 600, 66], [195, 186, 300, 32], [910, 214, 600, 66]]) + `<rect x="-1400" y="194" width="3190" height="2400"/>`, 'var(--prato)');
  // In lontananza: una piccola stalla sulla collina
  const bx = 176, by = 111;
  s += `<g stroke="${P.notte}" stroke-width="2" stroke-linejoin="round"><rect x="${bx - 13}" y="${by - 14}" width="26" height="14" fill="${P.gesso}"/>` +
    `<path d="M${bx - 17} ${by - 12} L${bx} ${by - 26} L${bx + 17} ${by - 12} Z" fill="${P.albicocca}"/><rect x="${bx - 4}" y="${by - 9}" width="8" height="9" fill="${P.fango}" stroke-width="1.6"/>` +
    `<path d="M${bx - 11} ${by} L${bx + 11} ${by}"/></g>`;
  svg.innerHTML = s;
}
