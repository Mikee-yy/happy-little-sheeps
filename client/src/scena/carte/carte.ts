// Le carte disegnate (bozza scena.src.html, righe 563–703 senza `CARTE`): nome, valore e testo vengono dal catalogo del motore.
import { defCarta, tipoDi } from '../../../../engine/src';
import type { IdCarta } from '../../../../engine/src';
import { T } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';
import { piattaforma } from '../piattaforma';
import { illustrazioneDi, illustrazioneSVG } from './illustrazioni';

export { illustrazioneDi };

const esc = (t: string | number) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const COLORE_TIPO: Record<string, string> = { meteo: P.lilla, predatori: P.fango, drammi: P.albicocca, tosatura: P.limone };

function righe(testo: string, font: string, larg: number): string[] {
  const out: string[] = [];
  let r = '';
  for (const p of testo.split(' ')) {
    const t = r ? r + ' ' + p : p;
    if (r && piattaforma.larghezzaTesto(t, font) > larg) {
      out.push(r);
      r = p;
    } else r = t;
  }
  if (r) out.push(r);
  return out;
}

function nomeSVG(nome: string, y: number): string {
  const u = nome.toUpperCase();
  let size = 16.5;
  const w = piattaforma.larghezzaTesto(u, `800 ${size}px 'Bricolage Grotesque'`) + u.length * size * 0.02;
  if (w > 204) size = (size * 204) / w;
  return `<text x="125" y="${y}" text-anchor="middle" style="font:800 ${size.toFixed(2)}px 'Bricolage Grotesque',sans-serif;letter-spacing:.02em;fill:${P.notte}">${esc(u)}</text>`;
}

function testoSVG(testo: string, corsivo: boolean, y0: number, y1: number): string {
  const stile = corsivo ? 'italic 400' : '400';
  let size = 14;
  let passo = 19.5;
  let font = `${stile} ${size}px 'Atkinson Hyperlegible'`;
  let r = righe(testo, font, 206);
  if (r.length > 3) {
    size = 12.5;
    passo = 16.5;
    font = `${stile} ${size}px 'Atkinson Hyperlegible'`;
    r = righe(testo, font, 214);
  }
  const centro = (y0 + y1) / 2;
  const alto = centro - ((r.length - 1) * passo) / 2 + size * 0.35;
  return (
    `<text text-anchor="middle" style="font:${stile} ${size}px 'Atkinson Hyperlegible',sans-serif;fill:${P.notte}">` +
    r.map((l, i) => `<tspan x="125" y="${(alto + i * passo).toFixed(1)}">${esc(l)}</tspan>`).join('') +
    '</text>'
  );
}

const piede = (t: string) =>
  `<text x="226" y="334" text-anchor="end" style="font:700 10px 'Atkinson Hyperlegible',sans-serif;letter-spacing:.18em;fill:${P.notte}">${t}</text>`;
const cornice = (fondo: string) => `<rect x="3" y="3" width="244" height="344" rx="16" fill="${fondo}" stroke="${P.notte}" stroke-width="6"/>`;

const cacheCarte: Record<string, string> = {};

/** La carta intera come SVG 250×350. `animata`: le illustrazioni si muovono (carta in primo piano). */
export function cartaSVG(id: IdCarta, animata = false): string {
  const tipo = tipoDi(id);
  const chiave = tipo + (animata ? '+' : '');
  const inCache = cacheCarte[chiave];
  if (inCache) return inCache;
  const c = defCarta(tipo);
  const tc = T.scena.carte;
  let s = '';
  if (c.famiglia === 'trovata') {
    s += cornice(P.gesso) + illustrazioneSVG(tipo, animata, 22, 22, 206, 196, P.gesso);
    s += `<path d="M3 19 Q3 3 19 3 L72 3 L72 64 Q72 76 60 76 L3 76 Z" fill="${P.notte}"/>`;
    s += `<text x="37" y="60" text-anchor="middle" style="font:800 50px 'Bricolage Grotesque',sans-serif;fill:${P.limone}">${c.valore}</text>`;
    if (c.gemella)
      s += `<circle cx="208" cy="42" r="21" fill="${P.gesso}" stroke="${P.notte}" stroke-width="4"/><use href="#qf" x="194" y="28" width="28" height="28"/>`;
    s += `<rect x="14" y="204" width="222" height="40" rx="8" fill="${P.limone}" stroke="${P.notte}" stroke-width="4"/>` + nomeSVG(c.nome, 230);
    // Il testo senza regola (solo battuta) va in corsivo
    s += testoSVG(c.testo, c.effetto === null && !c.gemella, 252, 320) + piede(tc.piede.trovata);
  } else if (c.famiglia === 'belato') {
    s += cornice(P.gesso) + illustrazioneSVG(tipo, animata, 22, 80, 206, 126, P.gesso);
    s += `<path d="M14 22 Q14 14 22 14 L228 14 Q236 14 236 22 L236 50 Q236 58 228 58 L60 58 L44 72 L46 58 L22 58 Q14 58 14 50 Z" fill="${P.limone}" stroke="${P.notte}" stroke-width="4" stroke-linejoin="round"/>` + nomeSVG(c.nome, 43);
    s += `<rect x="22" y="216" width="206" height="28" rx="14" fill="${P.notte}"/><text x="125" y="234.5" text-anchor="middle" style="font:700 10.5px 'Atkinson Hyperlegible',sans-serif;letter-spacing:.06em;fill:${P.limone}">${esc(tc.quando[c.quando])}</text>`;
    s += testoSVG(c.testo, false, 254, 322) + piede(tc.piede.belato);
  } else {
    const colore = COLORE_TIPO[c.tipo] ?? P.lilla;
    s += cornice(colore) + `<path d="M3 19 Q3 3 19 3 L231 3 Q247 3 247 19 L247 58 L3 58 Z" fill="${P.notte}"/><use href="#ico-${c.tipo}" x="12" y="9" width="40" height="40"/>`;
    s += `<text x="62" y="37" style="font:800 15px 'Bricolage Grotesque',sans-serif;letter-spacing:.14em;fill:${P.gesso}">${tc.tipi[c.tipo]}</text>`;
    s += illustrazioneSVG(tipo, animata, 22, 72, 206, 146, colore);
    s += `<rect x="14" y="204" width="222" height="40" rx="8" fill="${P.gesso}" stroke="${P.notte}" stroke-width="4"/>` + nomeSVG(c.nome, 230);
    s += testoSVG(c.testo, true, 254, 320) + piede(tc.piede.guaio);
  }
  const svg = `<svg viewBox="0 0 250 350" aria-hidden="true"${animata ? ' class="anima"' : ''}>${s}</svg>`;
  // La versione animata di un disegno dello sprite, prodotta prima che lo sprite sia nella pagina, è il ripiego fermo: non si tiene
  const ill = illustrazioneDi(tipo);
  if (animata && ill.tipo === 'sprite' && !document.getElementById(ill.simbolo)) return svg;
  return (cacheCarte[chiave] = svg);
}

/** Il dorso: delle carte Guai (`guai`) o del mazzo principale. */
export const retroSVG = (guai: boolean): string =>
  `<svg viewBox="0 0 250 350" aria-hidden="true"><use href="#${guai ? 'back-guai' : 'back-main'}"/></svg>`;
