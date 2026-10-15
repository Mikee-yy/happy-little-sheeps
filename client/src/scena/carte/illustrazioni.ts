// Illustrazioni delle carte (bozza scena.src.html, righe 585–669): quali carte hanno un disegno nel pacchetto grafico,
// quali un meteo disegnato qui, e il ripiego per tutte le altre (simbolo in grande sul colore della famiglia).
// Le parti animate si ricavano dal simbolo dello sprite; le animazioni partono solo dentro una carta con la classe "anima".
import { defCarta, tipoDi } from '../../../../engine/src';
import type { IdCarta } from '../../../../engine/src';
import { T } from '../../testi';
import { TAVOLOZZA as P } from '../ambiente/paesaggio';

export type Illustrazione =
  | { tipo: 'sprite'; simbolo: string }
  | { tipo: 'meteo'; svg: string }
  | { tipo: 'ripiego'; simbolo: string };

/** Carte con il disegno nel pacchetto grafico (id del simbolo nello sprite). */
export const SIMBOLI: Record<string, string> = {
  'sasso-comodo': 'c-sasso',
  'calzino-gemello': 'c-calzino',
  'ombrello-bucato': 'c-ombrello',
  'campanaccio-stonato': 'c-campanaccio',
  'beee-no': 'b-beeeno',
  'belato-di-gruppo': 'b-gruppo',
  'finta-svenuta': 'b-svenuta',
  'grandine-a-sorpresa': 'g-grandine',
  'lupo-vegetariano': 'g-lupo',
};

export const avvolgi = (cls: string, html: string, stile = ''): string =>
  `<g class="an ${cls}"${stile ? ` style="${stile}"` : ''}>${html}</g>`;

// Illustrazioni dei Guai meteo che nel pacchetto non ci sono ancora: disegnate nello stesso stile
const nuvolaIll = (cx: number, cy: number, colore: string): string => {
  const f = `<circle cx="${cx - 30}" cy="${cy + 4}" r="20"/><circle cx="${cx}" cy="${cy - 8}" r="26"/><circle cx="${cx + 30}" cy="${cy + 6}" r="18"/><rect x="${cx - 48}" y="${cy + 2}" width="96" height="24" rx="12"/>`;
  return `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="8">${f}</g><g fill="${colore}">${f}</g>`;
};
const fondoGuaio = `<rect x="22" y="72" width="206" height="146" rx="10" fill="${P.gesso}" stroke="${P.notte}" stroke-width="4"/>`;

const ILL_METEO: Record<string, () => string> = {
  'fulmine-curioso': () =>
    fondoGuaio +
    avvolgi('an-nuvola', nuvolaIll(125, 104, P.nebbia)) +
    avvolgi(
      'an-lampo',
      `<path d="M131 130 L111 168 L126 168 L114 208 L150 158 L134 158 L145 130 Z" fill="${P.limone}" stroke="${P.notte}" stroke-width="4" stroke-linejoin="round"/>` +
        avvolgi('an-pupille', `<circle cx="127" cy="153" r="2.4" fill="${P.notte}"/><circle cx="135" cy="151" r="2.4" fill="${P.notte}"/>`),
    ),
  'pioggia-di-traverso': () =>
    fondoGuaio +
    avvolgi(
      'an-pioggia',
      [62, 88, 114, 140, 166, 192, 218]
        .map((x) => `<path d="M${x} 126 L${x - 26} 216" stroke="${P.notte}" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 12"/>`)
        .join(''),
    ) +
    avvolgi('an-nuvola', nuvolaIll(125, 100, P.nebbia)),
  'nebbia-fitta': () => {
    const f = `<circle cx="100" cy="178" r="20"/><circle cx="125" cy="164" r="26"/><circle cx="150" cy="178" r="20"/><rect x="82" y="176" width="86" height="18" rx="9"/>`;
    const banchi: Array<[number, number, number, string]> = [
      [24, 116, 140, ''],
      [96, 148, 128, ' an-r2'],
      [30, 182, 120, ''],
    ];
    return (
      fondoGuaio +
      `<g fill="${P.notte}"><rect x="96" y="190" width="7" height="18" rx="3.5"/><rect x="110" y="192" width="7" height="16" rx="3.5"/><rect x="134" y="192" width="7" height="16" rx="3.5"/><rect x="148" y="190" width="7" height="18" rx="3.5"/></g>` +
      avvolgi('an-cespuglio', `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="8">${f}</g><g fill="${P.menta}">${f}</g>`) +
      banchi
        .map(([x, y, w, r]) =>
          avvolgi('an-banco' + r, `<rect x="${x}" y="${y}" width="${w}" height="16" rx="8" fill="${P.nebbia}" stroke="${P.notte}" stroke-width="3"/>`),
        )
        .join('')
    );
  },
  'vento-dispettoso': () =>
    fondoGuaio +
    avvolgi(
      'an-vortice',
      `<path d="M34 126 Q74 104 114 126 T190 122 q24 -6 18 -24 q-5 -12 -17 -5" fill="none" stroke="${P.notte}" stroke-width="4" stroke-linecap="round" stroke-dasharray="26 9"/>` +
        `<path d="M46 170 Q88 150 128 170 T204 166" fill="none" stroke="${P.notte}" stroke-width="4" stroke-linecap="round" stroke-dasharray="20 8"/>`,
    ) +
    avvolgi('an-ciuffo', `<g transform="translate(150 192) scale(.42) translate(-125 -104)">${nuvolaIll(125, 104, P.gesso)}</g>`),
  'gelata-di-agosto': () => {
    let r = '';
    for (const a of [0, 60, 120]) r += `<path d="M0 -42 L0 42 M-9 -30 L0 -21 L9 -30 M-9 30 L0 21 L9 30" transform="rotate(${a})"/>`;
    return (
      fondoGuaio +
      avvolgi('an-pulsa', `<circle cx="188" cy="100" r="13" fill="${P.limone}" stroke="${P.notte}" stroke-width="3"/>`) +
      avvolgi(
        'an-ruota',
        `<g transform="translate(116 150)" fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="${P.notte}" stroke-width="10">${r}</g><g stroke="${P.celeste}" stroke-width="5">${r}</g></g>`,
      )
    );
  },
  'pozzanghera-senza-fondo': () =>
    fondoGuaio +
    `<ellipse cx="125" cy="178" rx="84" ry="27" fill="${P.celeste}" stroke="${P.notte}" stroke-width="4"/><ellipse cx="125" cy="181" rx="50" ry="14" fill="${P.lilla}" stroke="${P.notte}" stroke-width="3"/><ellipse cx="125" cy="183" rx="20" ry="5.5" fill="${P.notte}"/>` +
    avvolgi('an-increspa', `<ellipse cx="125" cy="178" rx="34" ry="10" fill="none" stroke="${P.notte}" stroke-width="2.5"/>`) +
    avvolgi('an-increspa an-r2', `<ellipse cx="125" cy="178" rx="34" ry="10" fill="none" stroke="${P.notte}" stroke-width="2.5"/>`) +
    avvolgi('an-gocce', `<path d="M125 104 q6 10 0 14 q-6 -4 0 -14 Z" fill="${P.celeste}" stroke="${P.notte}" stroke-width="2.5" stroke-linejoin="round"/>`),
};

/** Che disegno ha una carta. Accetta anche gli id d'istanza ("beee-no#2"). */
export function illustrazioneDi(id: IdCarta): Illustrazione {
  const tipo = tipoDi(id);
  const simbolo = SIMBOLI[tipo];
  if (simbolo) return { tipo: 'sprite', simbolo };
  const meteo = ILL_METEO[tipo];
  if (meteo) return { tipo: 'meteo', svg: meteo() };
  const d = defCarta(tipo);
  if (d.famiglia === 'guaio') return { tipo: 'ripiego', simbolo: `ico-${d.tipo}` };
  if (d.famiglia === 'trovata') return { tipo: 'ripiego', simbolo: 'agnello' };
  return { tipo: 'ripiego', simbolo: 'fumetto' };
}

/** Il fumetto "Beee!" dei Belati senza disegno (originale semplice, tratto notte come le nuvole). */
function fumettoBeee(): string {
  const f = 'M40 70 Q40 42 70 42 L180 42 Q210 42 210 70 L210 108 Q210 136 180 136 L108 136 L76 164 L84 136 L70 136 Q40 136 40 108 Z';
  return (
    `<path d="${f}" fill="${P.gesso}" stroke="${P.notte}" stroke-width="5" stroke-linejoin="round"/>` +
    `<text x="125" y="104" text-anchor="middle" style="font:800 40px 'Bricolage Grotesque',sans-serif;fill:${P.notte}">${T.scena.carte.beee}</text>`
  );
}

/** Colore di fondo del ripiego per le famiglie senza un colore proprio. */
const COLORE_RIPIEGO = { trovata: P.menta, belato: P.albicocca } as const;

function ripiego(id: IdCarta, simbolo: string, colorePerGuaio: string): string {
  const d = defCarta(id);
  const colore = d.famiglia === 'guaio' ? colorePerGuaio : COLORE_RIPIEGO[d.famiglia];
  const sfondo = `<rect x="22" y="72" width="206" height="146" rx="10" fill="${colore}" stroke="${P.notte}" stroke-width="4"/>`;
  if (simbolo === 'fumetto') return sfondo + fumettoBeee();
  return sfondo + `<use href="#${simbolo}" x="70" y="96" width="110" height="110"/>`;
}

/** Parti animate del simbolo dello sprite (bozza, righe 595–636). Senza lo sprite nella pagina, o con un simbolo diverso: null. */
function illAnimata(ill: string): string | null {
  const sim = document.getElementById(ill);
  if (!sim) return null;
  const ch = [...sim.children];
  const h = (...i: number[]) => i.map((n) => ch[n]!.outerHTML).join('');
  const figli = (n: number, cls: string, passo: number) => {
    const g = ch[n]!;
    const tr = g.getAttribute('transform');
    return (
      `<g style="${g.getAttribute('style') || ''}"${tr ? ` transform="${tr}"` : ''}>` +
      [...g.children].map((c, k) => avvolgi(cls, c.outerHTML, `animation-delay:${(k * passo).toFixed(2)}s`)).join('') +
      '</g>'
    );
  };
  try {
    switch (ill) {
      case 'c-sasso':
        return (
          h(1, 2, 3, 4) +
          avvolgi('an-germoglio', h(5)) +
          avvolgi(
            'an-luccica',
            `<path d="M0 -7 L1.8 -1.8 L7 0 L1.8 1.8 L0 7 L-1.8 1.8 L-7 0 L-1.8 -1.8 Z" transform="translate(178 118)" fill="${P.gesso}" stroke="${P.notte}" stroke-width="2" stroke-linejoin="round"/>`,
          )
        );
      case 'c-calzino':
        return h(1) + avvolgi('an-calza', h(2)) + avvolgi('an-calza an-r2', h(3));
      case 'c-ombrello':
        return h(1) + avvolgi('an-ondeggia', h(2, 3, 4)) + avvolgi('an-gocce', h(5));
      case 'c-campanaccio': {
        const g = ch[2]!;
        const p = [...g.children].map((c) => c.outerHTML);
        return (
          h(1) +
          `<g style="${g.getAttribute('style')}" transform="${g.getAttribute('transform')}">` +
          avvolgi('an-campana', p[0]! + p[1]! + p[2]! + avvolgi('an-batacchio', p[3]!)) +
          avvolgi('an-onde', p[4]!) +
          '</g>'
        );
      }
      case 'b-beeeno':
        return h(1) + avvolgi('an-urlo', h(2, 3, 4));
      case 'b-gruppo': {
        const g = ch[2]!;
        const p = [...g.children].map((c) => c.outerHTML);
        return (
          h(1) +
          `<g style="${g.getAttribute('style')}">` +
          [0, 2, 4].map((i, k) => avvolgi('an-pop', p[i]! + p[i + 1]!, `animation-delay:${k * 0.35}s`)).join('') +
          '</g>' +
          avvolgi('an-tratteggio', h(3))
        );
      }
      case 'b-svenuta':
        return h(1) + avvolgi('an-zampe', h(2)) + h(3) + figli(4, 'an-stella', 0.4);
      case 'g-grandine':
        return h(4) + avvolgi('an-nuvola', h(5, 6)) + figli(7, 'an-chicco', 0.3);
      case 'g-lupo':
        return h(4) + avvolgi('an-cespuglio', h(5, 6)) + h(7) + avvolgi('an-occhi', h(8) + avvolgi('an-pupille', h(9)));
      default:
        return null;
    }
  } catch {
    return null; // simbolo con meno parti del previsto: si usa il disegno fermo
  }
}

/** L'illustrazione dentro la carta, nel riquadro (x, y, w, h). `colorePerGuaio` serve solo al ripiego dei Guai. */
export function illustrazioneSVG(id: IdCarta, animata: boolean, x: number, y: number, w: number, h: number, colorePerGuaio: string): string {
  const ill = illustrazioneDi(id);
  let interno: string;
  if (ill.tipo === 'meteo') interno = ill.svg;
  else if (ill.tipo === 'sprite') interno = (animata && illAnimata(ill.simbolo)) || `<use href="#${ill.simbolo}" width="250" height="350"/>`;
  else interno = ripiego(id, ill.simbolo, colorePerGuaio);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${interno}</svg>`;
}
