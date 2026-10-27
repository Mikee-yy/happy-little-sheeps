// Illustrazioni delle carte (bozza scena.src.html, righe 585–669): quali carte hanno un disegno nel pacchetto grafico,
// quali un disegno fatto in codice qui (meteo, Trovate, Belati e Predatori), e il ripiego per tutte le altre (simbolo in grande sul colore della famiglia).
// Le parti animate si ricavano dal simbolo dello sprite; le animazioni partono solo dentro una carta con la classe "anima".
import { defCarta, tipoDi } from '../../../../engine/src';
import type { IdCarta } from '../../../../engine/src';
import { GRIGIO_FUMO, TAVOLOZZA as P } from '../ambiente/paesaggio';

export type Illustrazione =
  | { tipo: 'sprite'; simbolo: string }
  | { tipo: 'disegno'; svg: string }
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
// (riviste con l'utente il 21 ottobre: pioggia, fulmine, gelata e nebbia)
/** Una nuvola a tre gobbe; `kx` e `ky` la allargano o la alzano senza ingrossare il tratto. */
const nuvolaIll = (cx: number, cy: number, colore: string, kx = 1, ky = 1): string => {
  const e = (x: number, y: number, r: number) => `<ellipse cx="${cx + x * kx}" cy="${cy + y * ky}" rx="${r * kx}" ry="${r * ky}"/>`;
  const f = e(-30, 4, 20) + e(0, -8, 26) + e(30, 6, 18) + `<rect x="${cx - 48 * kx}" y="${cy + 2 * ky}" width="${96 * kx}" height="${24 * ky}" rx="${12 * ky}"/>`;
  return `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="8">${f}</g><g fill="${colore}">${f}</g>`;
};
const fondoGuaio = `<rect x="22" y="72" width="206" height="146" rx="10" fill="${P.gesso}" stroke="${P.notte}" stroke-width="4"/>`;
/** La nuvola del temporale: Notte appena schiarito, quasi nera ma staccata dal contorno. */
const NUVOLA_TEMPORALE = '#3A3D5C';

/** Una fascia di nebbia: fila di gobbe tonde larga quanto il riquadro. */
const fasciaNebbia = (y: number, sfasa = 0): string => {
  let f = '';
  for (let x = 36 + sfasa; x <= 214; x += 30) f += `<circle cx="${x}" cy="${y}" r="14"/>`;
  f += `<rect x="30" y="${y}" width="190" height="16" rx="8"/>`;
  return `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="6" stroke-linejoin="round">${f}</g><g fill="${P.nebbia}">${f}</g>`;
};

/** Il sole d'agosto ghiacciato: calotta di ghiaccio sopra, due ghiaccioli sotto, raggi celesti. */
const soleGhiacciato = (x: number, y: number, r: number): string => {
  let raggi = '';
  for (let a = 0; a < 360; a += 45) raggi += `<path d="M0 ${-(r + 5)} L0 ${-(r + 10)}" transform="rotate(${a})"/>`;
  const calotta = `M${-r - 2} 1 A${r + 2} ${r + 2} 0 0 1 ${r + 2} 1 Q${r / 2} -3 0 2 Q${-r / 2} -3 ${-r - 2} 1 Z`;
  return (
    `<g transform="translate(${x} ${y})"><g stroke="${P.celeste}" stroke-width="3" stroke-linecap="round">${raggi}</g>` +
    `<circle r="${r}" fill="${P.limone}" stroke="${P.notte}" stroke-width="3"/>` +
    `<path d="${calotta}" fill="${P.celeste}" stroke="${P.notte}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="M-6 ${r - 1} L-2 ${r - 1} L-4 ${r + 8} Z M2 ${r - 1} L6 ${r - 1} L4 ${r + 11} Z" fill="${P.celeste}" stroke="${P.notte}" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="${-r / 3}" cy="${-r / 2}" r="1.6" fill="${P.gesso}"/></g>`
  );
};

const ILL_METEO: Record<string, () => string> = {
  'fulmine-curioso': () =>
    fondoGuaio +
    avvolgi('an-nuvola', nuvolaIll(125, 112, NUVOLA_TEMPORALE)) +
    avvolgi(
      'an-lampo',
      `<path d="M131 136 L111 172 L126 172 L114 210 L150 162 L134 162 L145 136 Z" fill="${P.limone}" stroke="${P.notte}" stroke-width="4" stroke-linejoin="round"/>` +
        avvolgi('an-pupille', `<circle cx="127" cy="157" r="2.4" fill="${P.notte}"/><circle cx="135" cy="155" r="2.4" fill="${P.notte}"/>`),
    ),
  // La pioggia scende tutta da sotto la nuvola, di traverso
  'pioggia-di-traverso': () => {
    let gocce = '';
    for (let x = 66; x <= 186; x += 20)
      gocce += `<path d="M${x} 150 L${x - 16} 208" stroke="${P.notte}" stroke-width="4" stroke-linecap="round" stroke-dasharray="10 12"/>`;
    return fondoGuaio + avvolgi('an-pioggia', gocce) + avvolgi('an-nuvola', nuvolaIll(125, 119, GRIGIO_FUMO, 1.6, 1));
  },
  // Nella nebbia spuntano solo la cima e gli occhi del "gregge": un cespuglio
  'nebbia-fitta': () =>
    fondoGuaio +
    avvolgi(
      'an-cespuglio',
      `<g fill="${P.notte}"><ellipse cx="98" cy="98" rx="11" ry="5.5" transform="rotate(-25 98 98)"/><ellipse cx="152" cy="98" rx="11" ry="5.5" transform="rotate(25 152 98)"/></g>` +
        `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="8" stroke-linejoin="round"><circle cx="106" cy="108" r="16"/><circle cx="125" cy="100" r="20"/><circle cx="144" cy="108" r="16"/></g>` +
        `<g fill="${P.menta}"><circle cx="106" cy="108" r="16"/><circle cx="125" cy="100" r="20"/><circle cx="144" cy="108" r="16"/></g>` +
        `<circle cx="117" cy="105" r="3.2" fill="${P.notte}"/><circle cx="133" cy="105" r="3.2" fill="${P.notte}"/>`,
    ) +
    avvolgi('an-banco', fasciaNebbia(122)) +
    avvolgi('an-banco an-r2', fasciaNebbia(144, 15)) +
    avvolgi('an-banco', fasciaNebbia(166)) +
    `<rect x="24" y="178" width="202" height="38" rx="8" fill="${P.nebbia}"/>` +
    // I banchi che ondeggiano escono dai lati: il bordo del riquadro si ridisegna sopra
    `<rect x="22" y="72" width="206" height="146" rx="10" fill="none" stroke="${P.notte}" stroke-width="4"/>`,
  'vento-dispettoso': () =>
    fondoGuaio +
    avvolgi(
      'an-vortice',
      `<path d="M34 126 Q74 104 114 126 T190 122 q24 -6 18 -24 q-5 -12 -17 -5" fill="none" stroke="${P.notte}" stroke-width="4" stroke-linecap="round" stroke-dasharray="26 9"/>` +
        `<path d="M46 170 Q88 150 128 170 T204 166" fill="none" stroke="${P.notte}" stroke-width="4" stroke-linecap="round" stroke-dasharray="20 8"/>`,
    ) +
    avvolgi('an-ciuffo', `<g transform="translate(150 192) scale(.42) translate(-125 -104)">${nuvolaIll(125, 104, P.gesso)}</g>`),
  // Una margherita chiusa in un cubetto di ghiaccio, sotto il sole d'agosto ghiacciato anche lui
  'gelata-di-agosto': () => {
    let petali = '';
    for (let a = 0; a < 360; a += 45) petali += `<ellipse cx="0" cy="-14" rx="5.5" ry="10" transform="rotate(${a})"/>`;
    return (
      fondoGuaio +
      avvolgi('an-pulsa', soleGhiacciato(196, 94, 11)) +
      `<rect x="80" y="84" width="88" height="88" rx="14" fill="${P.celeste}" stroke="${P.notte}" stroke-width="4"/>` +
      `<path d="M124 164 Q120 150 124 134" fill="none" stroke="${P.notte}" stroke-width="4" stroke-linecap="round"/>` +
      `<path d="M123 154 q-12 -4 -14 -13 q12 2 14 13 Z" fill="${P.menta}" stroke="${P.notte}" stroke-width="2.5" stroke-linejoin="round"/>` +
      `<g transform="translate(124 118)"><g fill="${P.gesso}" stroke="${P.notte}" stroke-width="2.5">${petali}</g><circle r="6.5" fill="${P.limone}" stroke="${P.notte}" stroke-width="2.5"/></g>` +
      `<path d="M92 100 L92 114 M100 95 L110 95" stroke="${P.gesso}" stroke-width="4" stroke-linecap="round"/>`
    );
  },
  'pozzanghera-senza-fondo': () =>
    fondoGuaio +
    `<ellipse cx="125" cy="178" rx="84" ry="27" fill="${P.celeste}" stroke="${P.notte}" stroke-width="4"/><ellipse cx="125" cy="181" rx="50" ry="14" fill="${P.lilla}" stroke="${P.notte}" stroke-width="3"/><ellipse cx="125" cy="183" rx="20" ry="5.5" fill="${P.notte}"/>` +
    avvolgi('an-increspa', `<ellipse cx="125" cy="178" rx="34" ry="10" fill="none" stroke="${P.notte}" stroke-width="2.5"/>`) +
    avvolgi('an-increspa an-r2', `<ellipse cx="125" cy="178" rx="34" ry="10" fill="none" stroke="${P.notte}" stroke-width="2.5"/>`) +
    avvolgi('an-gocce', `<path d="M125 104 q6 10 0 14 q-6 -4 0 -14 Z" fill="${P.celeste}" stroke="${P.notte}" stroke-width="2.5" stroke-linejoin="round"/>`),
};

// Illustrazioni delle Trovate (riquadro 22,22 206×196: fondo menta e terra compresi), una per ogni carta
const NOTTE = P.notte;
/** Attributi di tratto Notte con spessore `w`, angoli e capi tondi. */
const tratto = (w = 4): string => `stroke="${NOTTE}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const fondoTrovata = `<rect x="22" y="22" width="206" height="196" rx="10" fill="${P.menta}" stroke="${NOTTE}" stroke-width="4"/>`;
const terra = `<path d="M36 188 L214 188" stroke="${NOTTE}" stroke-width="4" stroke-linecap="round"/>`;
/** L'ombra a terra: ellisse tenue centrata in `cx`, larga `rx`. */
const ombra = (cx: number, rx: number): string => `<ellipse cx="${cx}" cy="188" rx="${rx}" ry="5" fill="${NOTTE}" opacity=".15"/>`;

/** Lana: gruppo di cerchi [x, y, r] con il contorno sotto e il riempimento sopra. */
function lana(cerchi: [number, number, number][], colore: string = P.gesso, w = 8): string {
  const f = cerchi.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('');
  return `<g fill="${NOTTE}" stroke="${NOTTE}" stroke-width="${w}">${f}</g><g fill="${colore}">${f}</g>`;
}

/** Una margherita in (x, y), grande `k` volte la misura base. */
function margherita(x: number, y: number, k = 1): string {
  let p = '';
  for (let a = 0; a < 360; a += 45) p += `<ellipse cx="0" cy="${-8 * k}" rx="${3.6 * k}" ry="${6.5 * k}" transform="rotate(${a})"/>`;
  return `<g transform="translate(${x} ${y})"><g fill="${P.gesso}" stroke="${NOTTE}" stroke-width="2">${p}</g><circle r="${4.2 * k}" fill="${P.limone}" stroke="${NOTTE}" stroke-width="2"/></g>`;
}

/**
 * Perno invisibile delle parti animate: cerchio senza tratto né riempimento centrato in (x, y), di raggio `r` tale da
 * contenere tutta la parte. Allarga il riquadro del gruppo (transform-box: fill-box) attorno a quel punto, così con
 * l'origine al 50% 50% il gruppo gira proprio lì. Nella carta ferma non si vede.
 */
const perno = (x: number, y: number, r: number): string => `<circle cx="${x}" cy="${y}" r="${r}" fill="none"/>`;

/** Una goccia (di sudore) celeste con la punta in alto in (x, y). */
const goccia = (x: number, y: number): string =>
  `<path d="M${x} ${y} q7 11 0 16 q-7 -5 0 -16 Z" fill="${P.celeste}" stroke="${P.notte}" stroke-width="2" stroke-linejoin="round"/>`;

/** Una pecorella semplice (corpo di lana, testa Notte, zampe), centrata in (0,0), scalata di `k`. `testa` avvolge la testa (per animarla). */
function pecorella(k = 1, testa = (h: string): string => h): string {
  return (
    `<g transform="scale(${k})">` +
    `<g fill="${NOTTE}"><rect x="-16" y="10" width="7" height="18" rx="3.5"/><rect x="8" y="10" width="7" height="18" rx="3.5"/></g>` +
    lana([[-16, 0, 15], [0, -8, 18], [16, 0, 15], [0, 8, 16]]) +
    testa(
      `<ellipse cx="26" cy="-6" rx="11" ry="13" fill="${NOTTE}"/><ellipse cx="21" cy="-17" rx="7" ry="3.5" fill="${NOTTE}" transform="rotate(-30 21 -17)"/>` +
        `<circle cx="30" cy="-8" r="2.6" fill="${P.gesso}"/>`,
    ) +
    `</g>`
  );
}

// Le parti avvolte con `avvolgi` si muovono solo nella carta in primo piano (classe "anima"): classi in scena.css e carte/animazioni.css
const ILL_TROVATE: Record<string, () => string> = {
  // Una carta nascosta nel ciuffo di lana: animata, sbuca un poco e rientra
  'scorta-nel-vello': () =>
    fondoTrovata + terra + ombra(125, 62) +
    avvolgi('an-sbuca', `<g transform="rotate(14 150 104)"><rect x="132" y="78" width="40" height="56" rx="6" fill="${P.limone}" ${tratto()}/><path d="M142 92 L162 92 M142 102 L158 102" ${tratto(3)}/></g>`) +
    lana([[80, 158, 24], [108, 140, 28], [142, 146, 28], [170, 162, 22], [125, 170, 22], [96, 172, 18], [156, 176, 16]]) +
    `<path d="M88 160 q2 -8 10 -6 M150 140 q4 -6 10 -2 M128 172 q4 -5 9 -2" fill="none" ${tratto(3)}/>`,
  // Un agnellino da solo che si guarda intorno, con due gocce di sudore per la preoccupazione:
  // animato, gira la testa, le gocce scivolano giù e il punto di domanda ondeggia
  'agnellino-smarrito': () =>
    fondoTrovata + terra + ombra(118, 40) +
    `<g transform="translate(116 160)">${pecorella(1.25, (h) => avvolgi('an-guarda', perno(18, -2, 27) + h))}</g>` +
    avvolgi('an-sudore', goccia(135, 121)) +
    avvolgi('an-sudore', goccia(163, 117), 'animation-delay:-.9s') +
    avvolgi('an-ondeggia', `<path d="M168 96 q0 -16 16 -16 q16 0 16 14 q0 10 -12 14 l0 8" fill="none" ${tratto(5)}/><circle cx="188" cy="128" r="3.5" fill="${NOTTE}"/>`),
  // Gemella: due ciliegie unite dal picciolo; animate, dondolano appese al picciolo
  'ciliegie-appaiate': () =>
    fondoTrovata + terra + ombra(125, 54) +
    avvolgi(
      'an-dondola',
      perno(128, 92, 114) +
        `<path d="M98 150 Q104 108 128 92 M152 152 Q148 112 128 92" fill="none" ${tratto(4)}/>` +
        `<path d="M128 92 q20 -18 44 -6 q-22 16 -44 6 Z" fill="${P.menta}" ${tratto(3.5)}/><path d="M134 92 q16 -6 30 -5" fill="none" ${tratto(2.5)}/>` +
        `<circle cx="96" cy="160" r="26" fill="${P.albicocca}" ${tratto()}/><circle cx="154" cy="162" r="26" fill="${P.albicocca}" ${tratto()}/>` +
        `<path d="M84 150 q4 -6 10 -7 M142 152 q4 -6 10 -7" fill="none" stroke="${P.gesso}" stroke-width="4" stroke-linecap="round"/>`,
    ),
  // Fischietto con il cordino e le note: animati, a intervalli il fischietto trema come se ci soffiassero dentro,
  // la nota sale e svanisce, le onde pulsano
  'fischietto-da-richiamo': () =>
    fondoTrovata + terra + ombra(118, 50) +
    avvolgi(
      'an-soffia',
      `<path d="M90 130 L150 130 L150 120 L176 120 L176 146 L150 146 Q150 176 118 176 Q86 176 86 150 Q86 136 90 130 Z" fill="${P.limone}" ${tratto()}/>` +
        `<circle cx="116" cy="152" r="9" fill="${NOTTE}"/><rect x="132" y="128" width="12" height="7" rx="2" fill="${NOTTE}"/>`,
    ) +
    avvolgi('an-onda-lenta', `<path d="M186 108 q12 -8 20 0" fill="none" ${tratto(3.5)}/>`) +
    avvolgi('an-onda-lenta', `<path d="M184 94 q16 -12 30 0" fill="none" ${tratto(3.5)}/>`, 'animation-delay:.3s') +
    avvolgi('an-nota', `<g fill="${NOTTE}"><circle cx="196" cy="140" r="5"/><rect x="199" y="118" width="3" height="22" rx="1.5"/></g>`),
  // Pantofola con il pon pon: animato, il pon pon fa un saltello
  'pantofola-gemella': () =>
    fondoTrovata + terra + ombra(126, 70) +
    `<path d="M58 186 Q52 160 80 156 L130 150 Q150 128 176 134 Q200 140 198 168 Q196 186 176 186 Z" fill="${P.lilla}" ${tratto()}/>` +
    `<path d="M58 186 L198 186" ${tratto(4)}/><path d="M120 152 Q150 150 176 158" fill="none" ${tratto(3)}/>` +
    avvolgi('an-saltella', lana([[160, 130, 12], [172, 124, 11], [168, 138, 10]], P.gesso, 6)),
  // Scopa, nuvolette di polvere e un fiorellino: animati, la scopa spazza (perno in cima al manico) e la polvere si alza
  'pulizie-di-primavera': () =>
    fondoTrovata + terra + ombra(118, 56) +
    avvolgi(
      'an-spazza',
      perno(160, 70, 148) +
        `<path d="M160 70 L120 150" ${tratto(9)}/><path d="M160 70 L120 150" stroke="${P.fango}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M104 146 L136 160 L126 186 L74 186 Z" fill="${P.limone}" ${tratto()}/><path d="M92 170 L88 186 M106 172 L104 186 M118 174 L118 186" ${tratto(2.5)}/>`,
    ) +
    avvolgi('an-sbuffo', lana([[64, 176, 8], [52, 168, 6]], P.nebbia, 5)) +
    avvolgi('an-sbuffo', lana([[178, 178, 7]], P.nebbia, 5), 'animation-delay:-.7s') +
    margherita(190, 176, 0.9),
  // Gemella: cerchietto con la perla e un luccichio; animati, l'orecchino dondola appeso in cima e il luccichio brilla
  'orecchino-gemello': () =>
    fondoTrovata + terra + ombra(125, 34) +
    avvolgi(
      'an-dondola',
      perno(125, 86, 104) +
        `<circle cx="125" cy="120" r="34" fill="none" stroke="${NOTTE}" stroke-width="13"/><circle cx="125" cy="120" r="34" fill="none" stroke="${P.limone}" stroke-width="6"/>` +
        `<path d="M125 154 L125 162" ${tratto(4)}/><circle cx="125" cy="174" r="12" fill="${P.gesso}" ${tratto()}/><circle cx="121" cy="170" r="3" fill="${P.nebbia}"/>`,
    ) +
    avvolgi('an-luccica', `<path d="M180 92 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="${P.gesso}" ${tratto(2.5)}/>`),
  // Tre foglie, una lente che cerca la quarta: animata, la lente gira qua e là
  'trifoglio-qualunque': () => {
    const foglia = (a: number) => `<path d="M0 0 Q-20 -10 -16 -30 Q-4 -40 0 -26 Q4 -40 16 -30 Q20 -10 0 0 Z" transform="rotate(${a})" fill="${P.menta}" ${tratto(3.5)}/>`;
    return (
      fondoTrovata + terra + ombra(110, 44) +
      `<circle cx="110" cy="128" r="46" fill="${P.gesso}" ${tratto(3)}/>` +
      `<path d="M110 132 Q114 160 104 188" fill="none" ${tratto(4)}/>` +
      `<g transform="translate(110 132)">${foglia(-70)}${foglia(0)}${foglia(70)}</g>` +
      avvolgi(
        'an-cerca',
        `<circle cx="176" cy="150" r="18" fill="${P.celeste}" ${tratto()}/><path d="M188 164 L204 182" ${tratto(7)}/><path d="M170 144 q4 -4 10 -3" fill="none" stroke="${P.gesso}" stroke-width="3" stroke-linecap="round"/>`,
      )
    );
  },
  // Una pecorella a testa in giù dentro la freccia del giro: animata, fa il giro intero attorno al centro della freccia
  capriola: () =>
    fondoTrovata + terra + ombra(125, 46) +
    `<path d="M74 150 A54 54 0 1 1 168 168" fill="none" stroke="${NOTTE}" stroke-width="4" stroke-dasharray="10 9" stroke-linecap="round"/>` +
    `<path d="M160 160 L172 172 L178 156" fill="none" ${tratto(4)}/>` +
    avvolgi('an-capriola', perno(125.7, 134.4, 56) + `<g transform="translate(124 128) rotate(160)">${pecorella(1)}</g>`),
  // Già abitata: una pecorella sbuca dalla tana nel fieno. Animata: a intervalli si nasconde giù nella tana e
  // risbuca, con qualche filo di paglia che cade dal bordo; e sbatte le palpebre
  'balla-di-fieno': () =>
    fondoTrovata + terra + ombra(125, 74) +
    `<rect x="54" y="112" width="142" height="76" rx="18" fill="${P.limone}" ${tratto()}/>` +
    `<path d="M54 136 L196 136 M54 164 L196 164" ${tratto(3)}/><path d="M92 112 L92 188 M158 112 L158 188" stroke="${P.fango}" stroke-width="6"/>` +
    `<path d="M70 112 l-6 -12 M120 112 l2 -14 M176 112 l8 -10 M196 150 l12 -4" ${tratto(3)}/>` +
    `<path d="M103 164 Q103 132 125 132 Q147 132 147 164 Z" fill="${P.fango}" ${tratto(3)}/>` +
    // La pecorella sta in un <svg> annidato che finisce al fondo della tana: scendendo sparisce tutta (ciuffo compreso),
    // senza clipPath e quindi senza id ripetuti tra le carte
    `<svg x="95" y="100" width="60" height="64" viewBox="95 100 60 64">` +
    avvolgi(
      'an-sbircia',
      `<ellipse cx="112" cy="145" rx="7" ry="3.5" fill="${NOTTE}" transform="rotate(-25 112 145)"/><ellipse cx="138" cy="145" rx="7" ry="3.5" fill="${NOTTE}" transform="rotate(25 138 145)"/>` +
        `<ellipse cx="125" cy="151" rx="11" ry="13" fill="${NOTTE}"/>` +
        lana([[119, 139, 5], [125, 136, 6], [131, 139, 5]], P.gesso, 4) +
        avvolgi('an-occhi', `<circle cx="120.5" cy="149" r="2.6" fill="${P.gesso}"/><circle cx="129.5" cy="149" r="2.6" fill="${P.gesso}"/>`),
    ) +
    `</svg><path d="M101 164 L149 164" ${tratto(3)}/>` +
    // Fili di paglia che cadono dal bordo della tana quando la pecorella entra o esce: nella carta ferma non si vedono
    avvolgi(
      'an-pagliuzze',
      [['M104 144 l6 5', P.limone], ['M120 131 l8 -2', P.fango], ['M140 143 l7 -4', P.limone]]
        .map(([d, c]) => `<path d="${d}" ${tratto(4.5)}/><path d="${d}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`)
        .join(''),
      'opacity:0',
    ),
  // Megafono con le onde: animate, escono a impulsi una dopo l'altra
  'megafono-di-latta': () =>
    fondoTrovata + terra + ombra(110, 56) +
    `<path d="M70 130 L130 108 L130 180 L70 160 Z" fill="${P.nebbia}" ${tratto()}/>` +
    `<rect x="56" y="130" width="16" height="30" rx="5" fill="${P.celeste}" ${tratto()}/>` +
    `<path d="M96 170 L96 188 M86 188 L106 188" ${tratto(4)}/><path d="M86 140 L118 128" fill="none" stroke="${P.gesso}" stroke-width="4" stroke-linecap="round"/>` +
    ['M148 124 q12 20 0 40', 'M164 112 q22 32 0 64', 'M182 100 q30 44 0 88']
      .map((d, i) => avvolgi('an-onda-lenta', `<path d="${d}" fill="none" ${tratto(4)}/>`, `animation-delay:${(i * 0.25).toFixed(2)}s`))
      .join(''),
  // Coperte piegate con le cuciture e, sotto, una pecora che dorme beata: spunta la testa a un capo della pila.
  // Animata: la testa ondeggia piano nel sonno e una "z" sale e svanisce
  'coperta-di-lana': () =>
    fondoTrovata + terra + ombra(132, 82) +
    avvolgi(
      'an-sonnecchia',
      perno(78, 172, 56) +
        `<ellipse cx="40" cy="154" rx="10" ry="5" fill="${NOTTE}" transform="rotate(-30 40 154)"/>` +
        `<ellipse cx="62" cy="164" rx="19" ry="21" fill="${NOTTE}"/>` +
        lana([[50, 146, 8], [61, 141, 9], [72, 146, 8]], P.gesso, 5) +
        `<path d="M46 163 q4 4 8 0 M59 163 q4 4 8 0" fill="none" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>` +
        `<path d="M52 175 q4 3 8 0" fill="none" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>`,
    ) +
    avvolgi('an-sospiro', `<path d="M30 120 l10 0 l-10 10 l10 0" fill="none" ${tratto(3)}/>`) +
    `<rect x="70" y="156" width="138" height="32" rx="10" fill="${P.lilla}" ${tratto()}/>` +
    `<rect x="76" y="124" width="126" height="32" rx="10" fill="${P.albicocca}" ${tratto()}/>` +
    `<rect x="84" y="92" width="110" height="32" rx="10" fill="${P.lilla}" ${tratto()}/>` +
    `<path d="M94 108 L184 108 M88 140 L190 140 M82 172 L196 172" fill="none" stroke="${P.gesso}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>`,
  // Sul treppiede, punta verso una stellina: animata, la stellina brilla
  cannocchiale: () =>
    fondoTrovata + terra + ombra(112, 44) +
    `<path d="M112 140 L84 188 M112 140 L140 188 M112 140 L112 188" ${tratto(4)}/>` +
    `<g transform="rotate(-28 112 132)"><rect x="66" y="120" width="56" height="24" rx="6" fill="${P.fango}" ${tratto()}/><rect x="120" y="116" width="44" height="32" rx="6" fill="${P.limone}" ${tratto()}/><rect x="160" y="112" width="12" height="40" rx="4" fill="${P.fango}" ${tratto()}/></g>` +
    avvolgi('an-stella', `<path d="M190 70 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="${P.limone}" ${tratto(2.5)}/>`),
  // Vasca, ruota e manici: animata, la carriola beccheggia sulla ruota e la ruota gira (i raggi si vedono solo allora)
  carriola: () =>
    fondoTrovata + terra + ombra(122, 66) +
    avvolgi(
      'an-beccheggia',
      perno(80, 172, 124) +
        `<path d="M150 150 L200 176" ${tratto(5)}/><path d="M138 168 L190 186" ${tratto(5)}/>` +
        `<path d="M58 118 L170 118 L152 162 L82 162 Z" fill="${P.celeste}" ${tratto()}/><path d="M64 128 L166 128" fill="none" stroke="${P.gesso}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M96 162 L100 186" ${tratto(4)}/>` +
        avvolgi(
          'an-girella',
          `<circle cx="80" cy="172" r="16" fill="${P.fango}" ${tratto()}/>` +
            `<path class="raggi" d="M80 161 L80 183 M69 172 L91 172" ${tratto(2.5)} opacity="0"/>` +
            `<circle cx="80" cy="172" r="4" fill="${NOTTE}"/>`,
        ),
    ),
  // Una pecora beata con i tappi gialli nelle orecchie: il suono le arriva addosso e si ferma.
  // Si vede solo la testa. Animata: le onde pulsano e la testa dondola beata
  'tappi-per-le-orecchie': () =>
    fondoTrovata + terra + ombra(132, 44) +
    avvolgi('an-onda-lenta', `<path d="M66 110 q-12 22 0 44" fill="none" ${tratto(4)}/>`) +
    avvolgi('an-onda-lenta', `<path d="M52 118 q-8 14 0 28" fill="none" ${tratto(4)}/>`, 'animation-delay:.3s') +
    avvolgi(
      'an-beato',
      perno(133, 178, 92) +
        `<ellipse cx="96" cy="128" rx="20" ry="9" fill="${NOTTE}" transform="rotate(-18 96 128)"/><ellipse cx="170" cy="128" rx="20" ry="9" fill="${NOTTE}" transform="rotate(18 170 128)"/>` +
        `<rect x="72" y="118" width="16" height="14" rx="6" fill="${P.limone}" ${tratto(3)} transform="rotate(-18 80 125)"/><rect x="178" y="118" width="16" height="14" rx="6" fill="${P.limone}" ${tratto(3)} transform="rotate(18 186 125)"/>` +
        `<ellipse cx="133" cy="146" rx="30" ry="34" fill="${NOTTE}"/>` +
        lana([[112, 112, 13], [133, 104, 15], [154, 112, 13]]) +
        `<path d="M116 140 q6 5 12 0 M138 140 q6 5 12 0" fill="none" stroke="${P.gesso}" stroke-width="3.5" stroke-linecap="round"/>` +
        `<path d="M124 160 q9 6 18 0" fill="none" stroke="${P.gesso}" stroke-width="3" stroke-linecap="round"/>`,
    ),
  // Anello di fiori con le foglioline in mezzo: animate, le margherite girano piano su se stesse
  'corona-di-margherite': () => {
    let fiori = '';
    let foglie = '';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const af = a + Math.PI / 8;
      const xf = 125 + Math.cos(af) * 46;
      const yf = 138 + Math.sin(af) * 30;
      foglie += `<ellipse cx="${xf}" cy="${yf}" rx="9" ry="4.5" transform="rotate(${(af * 180) / Math.PI + 90} ${xf} ${yf})" fill="${P.menta}" stroke="${NOTTE}" stroke-width="2.5"/>`;
      fiori += avvolgi('an-ruota', margherita(125 + Math.cos(a) * 46, 138 + Math.sin(a) * 30, 1.15), `animation-delay:${(-i * 1.75).toFixed(2)}s`);
    }
    return fondoTrovata + terra + ombra(125, 54) + `<ellipse cx="125" cy="138" rx="46" ry="30" fill="none" ${tratto(5)}/>` + foglie + fiori;
  },
};


// Illustrazioni dei Belati (riquadro 22,80 206×126: il fondo c'è già), una per ogni carta disegnata
const fondoBelato = (c: string): string => `<rect x="22" y="80" width="206" height="126" rx="10" fill="${c}" stroke="${NOTTE}" stroke-width="4"/>`;
const terraBelato = `<path d="M36 196 L214 196" stroke="${NOTTE}" stroke-width="4" stroke-linecap="round"/>`;
/** Testa di pecora vista di fronte (muso Notte, ciuffo di lana, orecchie), centrata in (x,y). */
const testa = (x: number, y: number, k = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${k})">` +
  `<ellipse cx="-30" cy="-6" rx="16" ry="7" fill="${NOTTE}" transform="rotate(-20 -30 -6)"/><ellipse cx="30" cy="-6" rx="16" ry="7" fill="${NOTTE}" transform="rotate(20 30 -6)"/>` +
  `<ellipse cx="0" cy="8" rx="24" ry="28" fill="${NOTTE}"/>` +
  lana([[-16, -18, 11], [0, -24, 13], [16, -18, 11]]) +
  `</g>`;

/** Pecora di profilo (corpo di lana, testa Notte a destra), centrata in (0,0). */
const profilo = (k = 1): string =>
  `<g transform="scale(${k})"><g fill="${NOTTE}"><rect x="-16" y="10" width="7" height="18" rx="3.5"/><rect x="8" y="10" width="7" height="18" rx="3.5"/></g>` +
  lana([[-16, 0, 15], [0, -8, 18], [16, 0, 15], [0, 8, 16]]) +
  `<ellipse cx="26" cy="-6" rx="11" ry="13" fill="${NOTTE}"/><ellipse cx="21" cy="-17" rx="7" ry="3.5" fill="${NOTTE}" transform="rotate(-30 21 -17)"/></g>`;


const ILL_BELATI: Record<string, () => string> = {
  'faccio-finta-di-niente': () =>
    fondoBelato(P.lilla) +
    testa(84, 150) +
    `<circle cx="78" cy="144" r="4" fill="${P.gesso}"/><circle cx="96" cy="144" r="4" fill="${P.gesso}"/><circle cx="80" cy="142" r="2" fill="${NOTTE}"/><circle cx="98" cy="142" r="2" fill="${NOTTE}"/>` +
    `<circle cx="88" cy="164" r="4" fill="none" stroke="${P.gesso}" stroke-width="3"/>` +
    // Animata: le note salgono e svaniscono, la carta del Guaio scivola verso il mazzo, sparisce e ricomincia
    avvolgi('an-nota-corta', `<g fill="${NOTTE}"><circle cx="50" cy="108" r="4"/><rect x="53" y="92" width="2.5" height="16" rx="1"/></g>`) +
    avvolgi('an-nota-corta', `<g fill="${NOTTE}"><circle cx="36" cy="124" r="3.5"/><rect x="38.5" y="110" width="2.2" height="14" rx="1"/></g>`, 'animation-delay:-1.2s') +
    `<rect x="150" y="128" width="52" height="66" rx="6" fill="${NOTTE}" stroke="${NOTTE}" stroke-width="4"/><rect x="146" y="124" width="52" height="66" rx="6" fill="${NOTTE}" stroke="${P.gesso}" stroke-width="2"/>` +
    avvolgi('an-scivola', `<rect x="164" y="96" width="44" height="58" rx="6" fill="${P.albicocca}" ${tratto(3.5)} transform="rotate(12 186 125)"/>`) +
    `<path d="M214 118 Q226 150 210 186" fill="none" ${tratto(3)} stroke-dasharray="6 6"/><path d="M204 180 L211 188 L218 179" fill="none" ${tratto(3)}/>`,

  'visita-di-garzina': () =>
    fondoBelato(P.menta) +
    testa(96, 140, 1.05) +
    // Animata: lo specchietto luccica, il cerotto ondeggia, la stellina brilla; a intervalli Garzina fa l'occhiolino
    // (l'occhio destro si chiude) e accanto spunta un luccichio (nella carta ferma è trasparente)
    `<path d="M76 128 Q96 120 116 128" fill="none" stroke="${P.gesso}" stroke-width="4"/><circle cx="96" cy="118" r="9" fill="${P.celeste}" ${tratto(3)}/>` +
    avvolgi('an-scintilla', `<circle cx="93" cy="115" r="2.5" fill="${P.gesso}"/>`) +
    `<circle cx="88" cy="140" r="3.2" fill="${P.gesso}"/>` +
    avvolgi('an-occhiolino', `<circle cx="104" cy="140" r="3.2" fill="${P.gesso}"/>`) +
    avvolgi('an-occhiolino-luce', `<path d="M115 131 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 Z" fill="${P.limone}" ${tratto(1.5)}/>`, 'opacity:0') +
    `<path d="M89 156 q7 5 14 0" fill="none" stroke="${P.gesso}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M72 168 Q74 196 96 196 Q118 196 120 168" fill="none" ${tratto(5)}/><path d="M120 168 L120 182 Q122 196 138 194" fill="none" ${tratto(4)}/>` +
    `<circle cx="142" cy="190" r="9" fill="${P.celeste}" ${tratto(3.5)}/>` +
    avvolgi('an-dondola', `<g transform="rotate(-28 182 132)"><rect x="152" y="120" width="60" height="22" rx="11" fill="${P.albicocca}" ${tratto(3.5)}/><rect x="172" y="120" width="20" height="22" fill="${P.gesso}" stroke="${NOTTE}" stroke-width="2.5"/></g>`) +
    avvolgi('an-stella', `<path d="M200 98 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 Z" fill="${P.gesso}" ${tratto(2.5)}/>`),

  'mondo-alla-rovescia': () =>
    fondoBelato(P.celeste) +
    `<path d="M24 82 L226 82 L226 116 Q180 124 125 114 Q70 106 24 116 Z" fill="${P.menta}" stroke="${NOTTE}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M60 116 l4 8 l4 -8 M150 120 l4 8 l4 -8 M196 118 l4 8 l4 -8" fill="none" ${tratto(2.5)}/>` +
    // Animata: la pecora a testa in giù dondola appesa per le zampe, la nuvoletta passa sotto
    avvolgi('an-dondola', perno(118, 116, 66) + `<g transform="translate(118 142) rotate(180)">${profilo(1)}</g>`) +
    `<circle cx="186" cy="180" r="13" fill="${P.limone}" stroke="${NOTTE}" stroke-width="3"/>` +
    avvolgi('an-banco', lana([[60, 182, 8], [72, 178, 10], [84, 183, 7]], P.gesso, 5)),

  'pernacchia': () =>
    fondoBelato(P.limone) + terraBelato +
    `<ellipse cx="116" cy="194" rx="48" ry="5" fill="${NOTTE}" opacity=".15"/>` +
    // Zampe: due dietro (più chiare, in ombra) e due davanti
    `<g fill="${NOTTE}"><rect x="96" y="168" width="9" height="26" rx="4.5"/><rect x="130" y="168" width="9" height="26" rx="4.5"/></g>` +
    `<g fill="${NOTTE}" opacity=".55"><rect x="108" y="170" width="8" height="22" rx="4"/><rect x="142" y="170" width="8" height="22" rx="4"/></g>` +
    // Corpo di lana visto da dietro, con i riccioli
    lana([[90, 150, 20], [104, 132, 22], [128, 128, 22], [148, 144, 20], [140, 164, 19], [100, 166, 19], [120, 152, 24]]) +
    `<path d="M98 146 q4 -6 10 -3 M120 136 q4 -6 10 -3 M132 156 q4 -6 10 -3 M108 162 q4 -6 10 -3 M142 140 q3 -5 8 -2" fill="none" ${tratto(2.5)}/>` +
    // Codina alzata (animata: scodinzola)
    avvolgi('an-scodinzola', perno(150, 132, 24) + lana([[154, 128, 7], [160, 122, 6]], P.gesso, 6)) +
    // Testa che si gira a guardare indietro, con la linguaccia
    `<ellipse cx="74" cy="116" rx="9" ry="4.5" fill="${NOTTE}" transform="rotate(-35 74 116)"/>` +
    `<ellipse cx="86" cy="128" rx="15" ry="17" fill="${NOTTE}" transform="rotate(-15 86 128)"/>` +
    lana([[84, 110, 8], [94, 108, 7]], P.gesso, 6) +
    `<circle cx="82" cy="126" r="4" fill="${P.gesso}"/><circle cx="81" cy="127" r="2" fill="${NOTTE}"/>` +
    `<path d="M80 138 q7 4 13 -1" fill="none" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M86 139 q2 9 8 9 q5 -1 3 -10 Z" fill="${P.albicocca}" ${tratto(2)}/>` +
    // Lo sbuffo del "prrr", con le righe del movimento (animati: escono a ondate)
    avvolgi('an-sbuffata', lana([[172, 148, 8], [186, 142, 10], [198, 152, 8], [188, 158, 7]], P.nebbia, 5)) +
    avvolgi('an-onda-lenta', `<path d="M206 128 q6 -6 12 0 M206 172 q6 6 12 0 M212 150 l10 0" fill="none" ${tratto(3)}/>`, 'animation-delay:.2s'),

};

/** Testa di lupo grigio vista di fronte (orecchie a punta, muso chiaro), centrata in (x,y). */
const testaLupo = (x: number, y: number, k = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${k})">` +
  `<path d="M-30 -14 L-26 -44 L-8 -22 Z M30 -14 L26 -44 L8 -22 Z" fill="${GRIGIO_FUMO}" ${tratto()}/>` +
  `<path d="M-36 -10 Q0 -28 36 -10 Q40 22 20 38 L0 50 L-20 38 Q-40 22 -36 -10 Z" fill="${GRIGIO_FUMO}" ${tratto()}/>` +
  `<path d="M-18 22 Q0 14 18 22 L10 46 L0 52 L-10 46 Z" fill="${P.gesso}" ${tratto(3)}/><ellipse cx="0" cy="24" rx="7" ry="5" fill="${NOTTE}"/>` +
  `<circle cx="-15" cy="2" r="5" fill="${P.limone}" stroke="${NOTTE}" stroke-width="2.5"/><circle cx="15" cy="2" r="5" fill="${P.limone}" stroke="${NOTTE}" stroke-width="2.5"/><g fill="${NOTTE}"><circle cx="-14" cy="3" r="2"/><circle cx="16" cy="3" r="2"/></g>` +
  `</g>`;
/** Abete scuro con la punta in alto, base centrata in (x,y), grande `k` volte la misura base. */
const abete = (x: number, y: number, k: number): string =>
  `<path d="M${x} ${y - 70 * k} L${x + 26 * k} ${y - 26 * k} L${x + 14 * k} ${y - 26 * k} L${x + 32 * k} ${y} L${x - 32 * k} ${y} L${x - 14 * k} ${y - 26 * k} L${x - 26 * k} ${y - 26 * k} Z" fill="${NOTTE}" stroke="${NOTTE}" stroke-width="3" stroke-linejoin="round"/>`;

/** Fondo del riquadro dei Guai, del colore `c`. */
const fondoGuaioDi = (c: string): string => `<rect x="22" y="72" width="206" height="146" rx="10" fill="${c}" stroke="${P.notte}" stroke-width="4"/>`;
/** La linea di terra dei Guai, all'altezza `y`. */
const terraGuaio = (y = 196): string => `<path d="M36 ${y} L214 ${y}" stroke="${NOTTE}" stroke-width="4" stroke-linecap="round"/>`;
/** Due occhi tondi (bianchi), centrati in (x,y), distanti `d`, di raggio `r`. */
const occhi = (x: number, y: number, d = 12, r = 3.2): string => `<circle cx="${x - d / 2}" cy="${y}" r="${r}" fill="${P.gesso}"/><circle cx="${x + d / 2}" cy="${y}" r="${r}" fill="${P.gesso}"/>`;
/** Due guance rosse (albicocca), centrate in (x,y), distanti `d`. */
const guance = (x: number, y: number, d = 30): string => `<g fill="${P.albicocca}"><ellipse cx="${x - d / 2}" cy="${y}" rx="6" ry="3.5"/><ellipse cx="${x + d / 2}" cy="${y}" rx="6" ry="3.5"/></g>`;
/** Una nota che si spezza, centrata in (x,y), scalata di `k`. */
const notaRotta = (x: number, y: number, k = 1): string =>
  `<g transform="translate(${x} ${y}) scale(${k})"><ellipse cx="0" cy="18" rx="7" ry="5.5" fill="${NOTTE}" transform="rotate(-20 0 18)"/><path d="M6 16 L6 -6 Q14 -2 18 6" fill="none" ${tratto(3.5)}/>` +
  `<path d="M-4 4 L4 10 L-2 14 L6 20" fill="none" stroke="${P.gesso}" stroke-width="2.5"/></g>`;

const PELLE = P.albicocca;

/** Una lama delle forbici (dal perno verso `d`), contorno Notte e filo Nebbia. */
const lama = (d: string): string => `<path d="${d}" ${tratto(5)}/><path d="${d}" stroke="${P.nebbia}" stroke-width="2" stroke-linecap="round"/>`;

/** Forbici aperte, centrate in (x, y), ruotate di `a` gradi. `zac`: le lame si chiudono e si riaprono (carta animata). */
const forbici = (x: number, y: number, a = 0, k = 1, zac = false): string =>
  `<g transform="translate(${x} ${y}) rotate(${a}) scale(${k})">` +
  (zac
    ? avvolgi('an-lama-su', perno(0, 0, 32) + lama('M0 0 L30 -8')) + avvolgi('an-lama-giu', perno(0, 0, 32) + lama('M0 0 L30 8'))
    : `<path d="M0 0 L30 -8 M0 0 L30 8" ${tratto(5)}/><path d="M0 0 L30 -8 M0 0 L30 8" stroke="${P.nebbia}" stroke-width="2" stroke-linecap="round"/>`) +
  `<circle cx="-10" cy="-8" r="7" fill="${P.limone}" ${tratto(3)}/><circle cx="-10" cy="8" r="7" fill="${P.limone}" ${tratto(3)}/><circle cx="0" cy="0" r="2.5" fill="${NOTTE}"/></g>`;

/** Rasoio elettrico (corpo tondo, interruttore, testina con il pettine) con il pettine verso il basso, centrato in (x, y), ruotato di `a` gradi. */
const rasoio = (x: number, y: number, a = 0): string =>
  `<g transform="translate(${x} ${y}) rotate(${a})">` +
  `<rect x="-9" y="-22" width="18" height="34" rx="8" fill="${P.lilla}" ${tratto(3.5)}/>` +
  `<path d="M-4 -16 L-4 4" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>` +
  `<rect x="1" y="-14" width="5" height="9" rx="2.5" fill="${P.limone}" ${tratto(2)}/>` +
  `<path d="M-8 22 L-8 26 M-3 22 L-3 26 M2 22 L2 26 M7 22 L7 26" ${tratto(2.5)}/>` +
  `<rect x="-11" y="11" width="22" height="11" rx="3" fill="${P.nebbia}" ${tratto(3)}/></g>`;

const ciuffo = (x: number, y: number): string => lana([[x, y, 5], [x + 6, y - 2, 4]], P.gesso, 4);

// Illustrazioni dei Predatori (riquadro 22,72 206×146: sotto y≈200 c'è la targhetta del nome), una per ogni carta disegnata
const ILL_GUAI: Record<string, () => string> = {
  'volpe-gentile': () =>
    fondoGuaio +
    `<path d="M84 100 L92 74 L108 96 Z M166 100 L158 74 L142 96 Z" fill="${P.albicocca}" ${tratto()}/>` +
    `<path d="M80 104 Q125 84 170 104 Q172 146 125 182 Q78 146 80 104 Z" fill="${P.albicocca}" ${tratto()}/>` +
    `<path d="M96 150 Q125 140 154 150 Q140 176 125 182 Q110 176 96 150 Z" fill="${P.gesso}" ${tratto(3)}/>` +
    `<ellipse cx="125" cy="158" rx="8" ry="6" fill="${NOTTE}"/>` +
    // Animata: strizza l'occhio (quello a destra), la chiave dondola appesa all'anello
    `<path d="M100 124 q8 -5 16 0" fill="none" ${tratto(4)}/>` +
    avvolgi('an-strizza', `<path d="M134 124 q8 -5 16 0" fill="none" ${tratto(4)}/>`) +
    `<path d="M112 168 q13 8 26 -2" fill="none" ${tratto(3)}/>` +
    `<path d="M90 98 Q125 76 160 98 L164 104 Q125 92 86 104 Z" fill="${NOTTE}"/><rect x="108" y="82" width="34" height="8" rx="3" fill="${P.limone}" ${tratto(2.5)}/>` +
    avvolgi('an-dondola', perno(184, 150, 34) + `<g transform="translate(184 150) rotate(-20)"><circle r="9" fill="none" ${tratto(4)}/><path d="M9 0 L30 0 M22 0 L22 7 M28 0 L28 6" ${tratto(4)}/></g>`),

  'aquila-con-il-taccuino': () =>
    fondoGuaio +
    // Animata: batte piano le ali (perno sulle spalle), la matita scrive
    avvolgi(
      'an-ala-sx',
      perno(118, 134, 92) +
        `<path d="M120 128 Q80 96 34 104 Q60 120 64 136 Q90 132 110 142 Z" fill="${P.fango}" ${tratto()}/><path d="M54 112 L64 126 M76 108 L82 124" ${tratto(2.5)}/>`,
    ) +
    avvolgi(
      'an-ala-dx',
      perno(132, 134, 92) +
        `<path d="M130 128 Q170 96 216 104 Q190 120 186 136 Q160 132 140 142 Z" fill="${P.fango}" ${tratto()}/><path d="M196 112 L186 126 M174 108 L168 124" ${tratto(2.5)}/>`,
    ) +
    `<ellipse cx="125" cy="150" rx="24" ry="30" fill="${P.fango}" ${tratto()}/>` +
    `<circle cx="125" cy="112" r="20" fill="${P.gesso}" ${tratto()}/>` +
    `<path d="M120 116 L134 118 L124 130 Z" fill="${P.limone}" ${tratto(3)}/>` +
    `<circle cx="117" cy="108" r="3" fill="${NOTTE}"/><circle cx="133" cy="108" r="3" fill="${NOTTE}"/><path d="M111 101 l9 3 M139 101 l-9 3" ${tratto(3)}/>` +
    `<rect x="104" y="148" width="30" height="36" rx="3" fill="${P.gesso}" ${tratto(3.5)}/><path d="M110 158 L128 158 M110 166 L128 166 M110 174 L122 174" ${tratto(2)}/>` +
    avvolgi('an-scrive', `<path d="M140 150 L150 182" stroke="${NOTTE}" stroke-width="7" stroke-linecap="round"/><path d="M140 150 L150 182" stroke="${P.limone}" stroke-width="3" stroke-linecap="round"/>`),

  'occhi-nel-cespuglio': () =>
    fondoGuaio +
    `<path d="M36 200 L214 200" stroke="${NOTTE}" stroke-width="4" stroke-linecap="round"/>` +
    lana([[60, 176, 26], [90, 144, 32], [128, 132, 36], [166, 146, 32], [194, 176, 26], [125, 176, 34]], P.menta) +
    `<path d="M70 168 Q125 130 182 168 Q170 188 125 190 Q80 188 70 168 Z" fill="${NOTTE}"/>` +
    // Animata: le due coppie di occhi sbattono, sfasate
    avvolgi(
      'an-occhi',
      `<g fill="${P.limone}" stroke="${NOTTE}" stroke-width="2"><ellipse cx="96" cy="168" rx="8" ry="6"/><ellipse cx="116" cy="168" rx="8" ry="6"/></g>` +
        `<g fill="${NOTTE}"><rect x="94.5" y="163" width="3" height="10" rx="1.5"/><rect x="114.5" y="163" width="3" height="10" rx="1.5"/></g>`,
    ) +
    avvolgi(
      'an-occhi',
      `<g fill="${P.limone}" stroke="${NOTTE}" stroke-width="2"><ellipse cx="138" cy="164" rx="8" ry="6"/><ellipse cx="158" cy="164" rx="8" ry="6"/></g>` +
        `<g fill="${NOTTE}"><rect x="136.5" y="159" width="3" height="10" rx="1.5"/><rect x="156.5" y="159" width="3" height="10" rx="1.5"/></g>`,
      'animation-delay:-1.6s',
    ),

  'lupo-travestito': () =>
    fondoGuaio +
    `<path d="M36 200 L214 200" stroke="${NOTTE}" stroke-width="4" stroke-linecap="round"/>` +
    // Animata: la coda scodinzola, la maschera trema
    avvolgi('an-scodinzola', perno(166, 182, 54) + `<path d="M166 176 Q196 172 204 148 Q206 164 196 178 Q186 190 164 188 Z" fill="${GRIGIO_FUMO}" ${tratto()}/>`) +
    `<g fill="${GRIGIO_FUMO}" stroke="${NOTTE}" stroke-width="3.5"><rect x="94" y="172" width="12" height="28" rx="5"/><rect x="142" y="172" width="12" height="28" rx="5"/></g>` +
    lana([[92, 160, 18], [112, 148, 22], [136, 148, 22], [156, 162, 18], [124, 172, 20], [100, 176, 14], [150, 178, 14]]) +
    `<path d="M104 160 q4 -6 10 -3 M132 160 q4 -6 10 -3" fill="none" ${tratto(2.5)}/>` +
    testaLupo(128, 110, 0.72) +
    `<g class="an an-brivido"><g transform="translate(0 10)">` +
    `<path d="M76 154 L92 112" stroke="${NOTTE}" stroke-width="7" stroke-linecap="round"/><path d="M76 154 L92 112" stroke="${P.fango}" stroke-width="3" stroke-linecap="round"/>` +
    `<ellipse cx="72" cy="158" rx="9" ry="7" fill="${GRIGIO_FUMO}" ${tratto(3)}/>` +
    `<ellipse cx="94" cy="104" rx="22" ry="25" fill="${NOTTE}" stroke="${NOTTE}" stroke-width="3"/>` +
    lana([[82, 82, 9], [94, 78, 10], [106, 82, 9]], P.gesso, 6) +
    `<ellipse cx="70" cy="96" rx="10" ry="4.5" fill="${NOTTE}" transform="rotate(-25 70 96)"/><ellipse cx="118" cy="96" rx="10" ry="4.5" fill="${NOTTE}" transform="rotate(25 118 96)"/>` +
    `<circle cx="86" cy="102" r="4.5" fill="${P.gesso}"/><circle cx="102" cy="102" r="4.5" fill="${P.gesso}"/>` +
    `<path d="M88 116 q6 4 12 0" fill="none" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>` +
    `</g></g>`,

  'invito-nel-bosco': () =>
    fondoGuaio +
    // Due abeti più lontani, dietro la tavola
    abete(70, 150, 0.5) + abete(122, 140, 0.45) + abete(178, 146, 0.5) + abete(206, 150, 0.45) +
    abete(98, 166, 0.75) + abete(150, 160, 0.65) + abete(188, 168, 0.8) +
    abete(44, 200, 1.0) + abete(212, 200, 1.05) +
    `<g transform="translate(125 150) scale(.8) translate(-125 -150)">` +
    // Il lupo seduto dietro la tavola, col tovagliolo al collo
    `<path d="M126 162 L130 134 Q152 122 174 134 L178 162 Z" fill="${GRIGIO_FUMO}" ${tratto(3.5)}/>` +
    testaLupo(152, 106, 0.66) +
    `<path d="M140 138 L152 154 L164 138 Z" fill="${P.gesso}" ${tratto(2.5)}/>` +
    // La zampa che indica il posto libero (animata: fa "vieni, vieni", perno sulla spalla)
    avvolgi(
      'an-chiama',
      perno(132, 146, 44) +
        `<path d="M132 146 Q116 146 104 138" fill="none" stroke="${NOTTE}" stroke-width="11" stroke-linecap="round"/><path d="M132 146 Q116 146 104 138" fill="none" stroke="${GRIGIO_FUMO}" stroke-width="5" stroke-linecap="round"/>` +
        `<ellipse cx="100" cy="135" rx="7" ry="5.5" fill="${GRIGIO_FUMO}" ${tratto(3)}/>`,
    ) +
    // La tavola apparecchiata
    `<path d="M60 160 L190 160 L180 176 L70 176 Z" fill="${P.gesso}" ${tratto(3.5)}/><path d="M66 168 L184 168" stroke="${P.albicocca}" stroke-width="3"/>` +
    `<ellipse cx="98" cy="158" rx="16" ry="5" fill="${P.nebbia}" ${tratto(3)}/><ellipse cx="156" cy="158" rx="16" ry="5" fill="${P.nebbia}" ${tratto(3)}/>` +
    `<path d="M76 150 L76 160 M120 150 L120 160 M134 150 L134 160 M178 150 L178 160" ${tratto(2.5)}/>` +
    `<rect x="64" y="132" width="7" height="24" rx="2" fill="${P.limone}" ${tratto(2.5)}/>` +
    avvolgi('an-fiamma', `<path d="M67.5 128 q-5 -8 0 -14 q5 6 0 14 Z" fill="${P.albicocca}" ${tratto(2)}/>`) +
    `<g transform="rotate(-8 98 148)"><rect x="86" y="140" width="24" height="14" rx="2" fill="${P.limone}" ${tratto(2.5)}/><circle cx="98" cy="147" r="3.5" fill="${P.gesso}" stroke="${NOTTE}" stroke-width="1.5"/></g>` +
    `</g>`,

  'faina-con-la-lista': () =>
    fondoGuaio +
    `<path d="M36 200 L214 200" stroke="${NOTTE}" stroke-width="4" stroke-linecap="round"/>` +
    `<path d="M70 196 Q60 150 86 118 Q100 104 112 118 Q118 150 110 196 Z" fill="${P.fango}" ${tratto()}/>` +
    `<path d="M82 196 Q76 170 92 146 Q100 160 100 196 Z" fill="${P.gesso}" ${tratto(2.5)}/>` +
    // Animata: la coda ondeggia (perno alla base), la zampa scorre lungo la lista
    avvolgi(
      'an-dondola',
      perno(70, 196, 50) +
        `<path d="M70 196 Q48 186 40 160" fill="none" ${tratto(9)}/><path d="M70 196 Q48 186 40 160" fill="none" stroke="${P.fango}" stroke-width="4" stroke-linecap="round"/>`,
    ) +
    `<circle cx="99" cy="110" r="17" fill="${P.fango}" ${tratto()}/><circle cx="88" cy="96" r="6" fill="${P.fango}" ${tratto(3)}/><circle cx="110" cy="96" r="6" fill="${P.fango}" ${tratto(3)}/>` +
    `<circle cx="93" cy="108" r="2.6" fill="${NOTTE}"/><circle cx="105" cy="108" r="2.6" fill="${NOTTE}"/><ellipse cx="99" cy="117" rx="4" ry="3" fill="${NOTTE}"/>` +
    `<path d="M120 96 L190 96 L190 172 Q190 180 182 180 L128 180 Q120 180 120 172 Z" fill="${P.gesso}" ${tratto(3.5)}/>` +
    `<path d="M120 96 Q120 88 128 88 L198 88 Q190 88 190 96" fill="${P.nebbia}" ${tratto(3)}/>` +
    `<path d="M132 108 L176 108 M132 128 L172 128 M132 142 L168 142 M132 156 L174 156 M132 168 L160 168" ${tratto(2.5)}/>` +
    `<path d="M130 114 L178 114 M130 118 L178 118" stroke="${NOTTE}" stroke-width="2" stroke-linecap="round"/>` +
    avvolgi('an-segna', `<path d="M112 126 Q118 120 124 126" fill="none" ${tratto(4)}/>`),


  // --- Drammi ---

  'figuraccia-al-pascolo': () =>
    fondoGuaio + testa(118, 138, 1.15) + guance(118, 150, 36) +
    `<path d="M104 140 q5 -5 10 0 M122 140 q5 -5 10 0" fill="none" stroke="${P.gesso}" stroke-width="3" stroke-linecap="round"/>` +
    `<path d="M88 196 Q90 166 104 158 L110 166 Q100 178 100 196 Z M148 196 Q146 166 132 158 L126 166 Q136 178 136 196 Z" fill="${NOTTE}"/>` +
    `<path d="M100 160 L110 164 M126 164 L136 160" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>` +
    // Animata: la nota rotta vola via e torna, il sudore cade
    avvolgi('an-volavia', notaRotta(180, 100)) +
    avvolgi('an-sudore', `<path d="M64 104 q-6 8 0 12 q6 -4 0 -12 Z" fill="${P.celeste}" ${tratto(2)}/>`) +
    avvolgi('an-sudore', `<path d="M54 128 q-5 7 0 10 q5 -3 0 -10 Z" fill="${P.celeste}" ${tratto(2)}/>`, 'animation-delay:-.9s'),

  'specchio-impietoso': () =>
    fondoGuaio + `<g transform="translate(125 128) scale(.84) translate(-125 -134)">` +
    `<rect x="118" y="168" width="14" height="40" rx="5" fill="${P.fango}" ${tratto()}/>` +
    `<ellipse cx="125" cy="128" rx="46" ry="50" fill="${P.fango}" ${tratto()}/>` +
    `<ellipse cx="125" cy="128" rx="36" ry="40" fill="${P.celeste}" ${tratto(3)}/>` +
    // Animato: il riflesso trema, le goccioline cadono
    avvolgi(
      'an-brivido',
      `<path d="M96 104 q-8 -14 6 -18 q2 -14 16 -8 q8 -12 18 0 q14 -6 14 10 q12 4 4 16 q10 10 -4 14" fill="${P.gesso}" ${tratto(3)}/>` +
        `<path d="M104 96 q6 6 0 10 M128 88 q-4 8 4 10 M148 98 q-6 4 0 8" fill="none" ${tratto(2)}/>` +
        `<ellipse cx="125" cy="140" rx="16" ry="20" fill="${NOTTE}"/>` +
        `<circle cx="118" cy="134" r="5" fill="${P.gesso}"/><circle cx="133" cy="136" r="3" fill="${P.gesso}"/><circle cx="119" cy="134" r="2" fill="${NOTTE}"/><circle cx="133" cy="136" r="1.2" fill="${NOTTE}"/>` +
        `<path d="M118 150 q4 -3 7 0 q3 3 7 0" fill="none" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>`,
    ) +
    `<path d="M146 104 L154 96 M150 110 L160 106" stroke="${P.gesso}" stroke-width="4" stroke-linecap="round"/>` +
    avvolgi('an-sudore', `<path d="M186 96 q-6 10 0 14 q6 -4 0 -14 Z" fill="${P.celeste}" ${tratto(2)}/>`) +
    avvolgi('an-sudore', `<path d="M194 120 q-5 8 0 11 q5 -3 0 -11 Z" fill="${P.celeste}" ${tratto(2)}/>`, 'animation-delay:-.9s') +
    `</g>`,

  'crisi-esistenziale': () =>
    fondoGuaio + terraGuaio() +
    `<g transform="translate(92 168)">${profilo(1.1)}</g>` +
    `<circle cx="118" cy="158" r="2.8" fill="${P.gesso}"/>` +
    // Pensierosa, con lo zoccolo sotto il mento: animata, a intervalli lo zoccolo batte piano sul mento (perno sulla spalla)
    avvolgi(
      'an-pensa',
      // La zampa ha un bordo Gesso, così si stacca dal muso (anche lui Notte)
      perno(106, 182, 28) +
        `<path d="M106 182 Q120 190 126 174" fill="none" stroke="${P.gesso}" stroke-width="13" stroke-linecap="round"/>` +
        `<path d="M106 182 Q120 190 126 174" fill="none" stroke="${NOTTE}" stroke-width="8" stroke-linecap="round"/>` +
        `<ellipse cx="126.5" cy="171" rx="5" ry="4" fill="${P.fango}" ${tratto(2.5)} transform="rotate(-70 126.5 171)"/>`,
    ) +
    // Animata: il filo d'erba ondeggia, i punti di domanda pulsano a turno
    avvolgi('an-ondeggia', `<path d="M158 196 Q156 172 166 156 Q162 176 166 196 Z" fill="${P.menta}" ${tratto(3)}/>`) +
    `<g transform="translate(0 12)">` +
    lana([[110, 120, 4], [124, 108, 6]], P.gesso, 5) +
    lana([[140, 96, 14], [160, 88, 16], [182, 94, 14], [162, 104, 14]], P.gesso, 7) +
    avvolgi('an-pulsa', `<text x="150" y="104" text-anchor="middle" style="font:800 18px 'Bricolage Grotesque',sans-serif;fill:${NOTTE}">?</text>`) +
    avvolgi('an-pulsa', `<text x="172" y="100" text-anchor="middle" style="font:800 14px 'Bricolage Grotesque',sans-serif;fill:${NOTTE}">?</text>`, 'animation-delay:-1s') +
    `</g>`,

  'gregge-senza-di-te': () =>
    fondoGuaio +
    `<path d="M24 150 Q90 120 150 140 Q190 150 226 132 L226 216 L24 216 Z" fill="${P.menta}" stroke="${NOTTE}" stroke-width="4" stroke-linejoin="round"/>` +
    // Animata: il gregge lontano si muove appena, il punto di domanda dondola
    ([[176, 134], [188, 130], [200, 128]] as [number, number][])
      .map(([x, y], i) => avvolgi('an-pascola', lana([[x, y, 4], [x + 4, y - 2, 4]], P.gesso, 4), `animation-delay:${(-i * 0.8).toFixed(1)}s`))
      .join('') +
    `<g fill="${NOTTE}">${([[100, 186], [116, 178], [132, 170], [148, 162], [162, 154]] as [number, number][]).map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2"/><ellipse cx="${x + 5}" cy="${y + 1}" rx="3" ry="2"/>`).join('')}</g>` +
    `<g transform="translate(64 180)">${profilo(0.75)}</g>` +
    `<circle cx="84" cy="174" r="2.2" fill="${P.gesso}"/>` +
    // La lacrimuccia: animata, si forma sotto l'occhio e scivola giù
    avvolgi('an-lacrima', `<path d="M86 176 q5 7 0 11 q-5 -4 0 -11 Z" fill="${P.celeste}" ${tratto(2)}/>`) +
    avvolgi('an-ondeggia', `<path d="M74 146 q-4 -12 6 -14 q8 2 4 10 q-3 4 -6 8 M80 154 l0 1" fill="none" ${tratto(3)}/>`),

  'compleanno-dimenticato': () =>
    fondoGuaio + terraGuaio(188) + `<g transform="translate(125 140) scale(.88) translate(-125 -150)">` +
    `<ellipse cx="110" cy="190" rx="52" ry="7" fill="${P.nebbia}" ${tratto(3)}/>` +
    // Animata: la torta si scioglie, la glassa cola piano lungo i fianchi e la torta si affloscia un poco (perno alla base)
    avvolgi(
      'an-affloscia',
      `<path d="M70 150 L150 150 L150 186 L70 186 Z" fill="${P.albicocca}" ${tratto()}/>` +
        ([[80, 16, -0.6], [100, 22, -2.4], [120, 12, -1.4], [140, 19, -3.2]] as [number, number, number][])
          .map(([x, l, r]) =>
            avvolgi('an-cola', `<path d="M${x - 4} 152 L${x - 4} ${152 + l} Q${x} ${158 + l} ${x + 4} ${152 + l} L${x + 4} 152 Z" fill="${P.gesso}" ${tratto(2.5)}/>`, `animation-delay:${r}s`),
          )
          .join('') +
        `<path d="M70 150 Q80 162 90 150 Q100 162 110 150 Q120 162 130 150 Q140 162 150 150" fill="${P.gesso}" ${tratto(3)}/>` +
        `<path d="M86 150 L86 128 M110 150 L110 124 M134 150 L134 128" stroke="${NOTTE}" stroke-width="8" stroke-linecap="round"/><path d="M86 150 L86 128 M110 150 L110 124 M134 150 L134 128" stroke="${P.lilla}" stroke-width="4" stroke-linecap="round"/>`,
    ) +
    // Animato: il fumo delle candeline sale, un coriandolo cade
    ['M86 122 q-4 -8 2 -14 q4 -6 -2 -12', 'M110 118 q4 -8 -2 -14', 'M134 122 q-4 -8 2 -14']
      .map((d, i) => avvolgi('an-fumo', `<path d="${d}" fill="none" stroke="${GRIGIO_FUMO}" stroke-width="3" stroke-linecap="round"/>`, `animation-delay:${(-i * 0.7).toFixed(1)}s`))
      .join('') +
    `<g transform="rotate(30 186 182)"><path d="M172 196 L186 158 L200 196 Z" fill="${P.limone}" ${tratto(3.5)}/><path d="M178 180 L194 180" stroke="${P.lilla}" stroke-width="4"/></g>` +
    avvolgi('an-coriandolo', `<g fill="${P.menta}" stroke="${NOTTE}" stroke-width="1.5"><rect x="164" y="112" width="6" height="6" transform="rotate(20 167 115)"/></g>`) +
    `<g fill="${P.menta}" stroke="${NOTTE}" stroke-width="1.5"><rect x="52" y="128" width="6" height="6"/><rect x="196" y="138" width="6" height="6" transform="rotate(-30 199 141)"/></g>` +
    `<g fill="${P.limone}" stroke="${NOTTE}" stroke-width="1.5"><circle cx="60" cy="112" r="3"/><circle cx="182" cy="100" r="3"/></g>` +
    `</g>`,

  // Di notte, a occhi spalancati, la pecora conta le pecorelle che saltano lo steccato
  'insonnia': () =>
    fondoGuaioDi(NUVOLA_TEMPORALE) +
    `<circle cx="196" cy="96" r="12" fill="${P.limone}" ${tratto(3)}/><circle cx="202" cy="92" r="11" fill="${NUVOLA_TEMPORALE}"/>` +
    `<g fill="${P.limone}"><circle cx="60" cy="90" r="2"/><circle cx="150" cy="86" r="1.6"/><circle cx="104" cy="96" r="1.6"/></g>` +
    `<path d="M108 156 L176 156 M114 142 L114 164 M142 142 L142 164 M170 142 L170 164" stroke="${P.fango}" stroke-width="5" stroke-linecap="round"/>` +
    // Animata: le pecorelle saltano lo steccato una dopo l'altra
    avvolgi('an-salta', `<g transform="translate(134 124) rotate(-12)">${profilo(0.42)}</g>`) +
    avvolgi('an-salta', `<g transform="translate(176 140) rotate(10)">${profilo(0.36)}</g>`, 'animation-delay:-1.4s') +
    `<path d="M116 136 q8 -14 20 -14 M156 128 q12 -2 18 8" fill="none" stroke="${P.gesso}" stroke-width="2" stroke-dasharray="3 4" stroke-linecap="round"/>` +
    `<rect x="34" y="168" width="100" height="22" rx="8" fill="${P.lilla}" ${tratto(3.5)}/>` +
    `<path d="M40 168 Q60 152 80 168 Z" fill="${P.gesso}" ${tratto(3)}/>` +
    testa(66, 152, 0.6) + occhi(66, 154, 12, 4.5) +
    // Animata: a intervalli alza gli occhi al cielo, esasperata (le pupille girano in su e tornano)
    avvolgi('an-alza-occhi', `<g fill="${NOTTE}"><circle cx="61" cy="154" r="1.6"/><circle cx="73" cy="154" r="1.6"/></g>`),

  'inciampo-al-ruscello': () =>
    fondoGuaio +
    `<path d="M24 168 Q80 160 125 168 Q170 176 226 166 L226 216 L24 216 Z" fill="${P.celeste}" stroke="${NOTTE}" stroke-width="4" stroke-linejoin="round"/>` +
    `<path d="M40 186 q8 -4 16 0 M180 190 q8 -4 16 0" fill="none" ${tratto(2.5)}/>` +
    // Animato: le zampe si agitano, gli spruzzi saltano, l'acqua si increspa
    avvolgi('an-zampe', `<g fill="${NOTTE}"><rect x="74" y="122" width="7" height="22" rx="3.5" transform="rotate(-14 78 132)"/></g>`) +
    avvolgi('an-zampe', `<g fill="${NOTTE}"><rect x="98" y="120" width="7" height="22" rx="3.5" transform="rotate(10 101 130)"/></g>`, 'animation-delay:-.3s') +
    lana([[78, 154, 15], [96, 148, 17], [112, 158, 14]]) +
    avvolgi('an-spruzzo', `<g fill="${P.gesso}" stroke="${NOTTE}" stroke-width="2.5"><path d="M118 164 q4 -14 10 -18 q-2 10 -10 18 Z"/><path d="M126 168 q12 -8 18 -6 q-8 6 -18 6 Z"/><circle cx="138" cy="146" r="3"/></g>`) +
    avvolgi('an-increspa-piano', `<path d="M120 176 q6 -4 12 0 M114 184 q10 -6 20 0" fill="none" ${tratto(2.5)}/>`) +
    // Il montone guarda dalla riva: testa con le corna a ricciolo e un sorrisetto. Animato: a intervalli ridacchia,
    // il sorriso si allarga, gli occhi si socchiudono e la testa fa due saltelli
    avvolgi(
      'an-ridacchia',
      `<ellipse cx="184" cy="122" rx="15" ry="18" fill="${NOTTE}"/>` +
        `<path d="M170 112 q-16 -4 -14 10 q2 10 12 4" fill="${P.fango}" ${tratto(3)}/><path d="M198 112 q16 -4 14 10 q-2 10 -12 4" fill="${P.fango}" ${tratto(3)}/>` +
        lana([[176, 102, 7], [186, 98, 8], [194, 104, 6]], P.gesso, 5) +
        avvolgi('an-socchiude', occhi(184, 120, 10, 2.8)) +
        avvolgi('an-ghigno', `<path d="M178 130 q7 5 13 -1" fill="none" stroke="${P.gesso}" stroke-width="2.5" stroke-linecap="round"/>`),
    ) +
    `<path d="M150 92 q-6 4 -2 10 M144 86 q-10 8 -4 18" fill="none" ${tratto(2.5)}/>`,


  'tosatura-a-sorpresa': () =>
  fondoGuaio + terraGuaio(190) +
  // Animata: la pecora trema, il rasoio elettrico ronza e passa avanti e indietro sulla lana, i ciuffi tosati cadono a terra
  avvolgi(
    'an-brivido',
    `<g fill="${NOTTE}"><rect x="84" y="160" width="8" height="30" rx="4"/><rect x="132" y="160" width="8" height="30" rx="4"/></g>` +
      `<path d="M76 130 Q76 108 104 110 L112 110 L112 170 L96 170 Q74 168 76 130 Z" fill="${PELLE}" ${tratto()}/>` +
      lana([[120, 120, 16], [138, 128, 18], [128, 152, 18], [146, 150, 14]]) +
      `<ellipse cx="162" cy="126" rx="13" ry="15" fill="${NOTTE}"/><ellipse cx="156" cy="112" rx="8" ry="4" fill="${NOTTE}" transform="rotate(-30 156 112)"/>` +
      `<circle cx="166" cy="124" r="3.2" fill="${P.gesso}"/><path d="M160 134 l3 -2 l3 2 l3 -2 l3 2" fill="none" stroke="${P.gesso}" stroke-width="2" stroke-linecap="round"/>`,
  ) +
  `<path d="M62 118 l-6 4 l6 4 l-6 4 M64 146 l-6 4 l6 4 l-6 4" fill="none" ${tratto(2.5)}/>` +
  avvolgi('an-rasoio', avvolgi('an-ronza', rasoio(134, 94, 55)) + `<path d="M158 84 q5 4 3 10 M165 79 q8 7 4 16" fill="none" ${tratto(2.5)}/>`) +
  avvolgi('an-cade-ciuffo', ciuffo(66, 186), 'animation-delay:-1.2s') +
  avvolgi('an-cade-ciuffo', ciuffo(104, 184)) +
  avvolgi('an-cade-ciuffo', ciuffo(176, 186), 'animation-delay:-.6s'),

  'spuntatina': () =>
  fondoGuaio +
  `<g transform="translate(118 146)">` +
  `<ellipse cx="-34" cy="-6" rx="17" ry="7" fill="${NOTTE}" transform="rotate(-20 -34 -6)"/><ellipse cx="34" cy="-6" rx="17" ry="7" fill="${NOTTE}" transform="rotate(20 34 -6)"/>` +
  `<ellipse cx="0" cy="12" rx="26" ry="30" fill="${NOTTE}"/>` +
  lana([[-22, -20, 12], [-12, -30, 11], [12, -30, 11], [22, -20, 12]]) +
  `<path d="M-5 -37 Q0 -40 5 -37 L5 -17 L-5 -17 Z" fill="${PELLE}" ${tratto(3)}/>` +
  `<circle cx="-10" cy="8" r="5" fill="${P.gesso}"/><circle cx="10" cy="8" r="5" fill="${P.gesso}"/><circle cx="-10" cy="8" r="2" fill="${NOTTE}"/><circle cx="10" cy="8" r="2" fill="${NOTTE}"/>` +
  `<ellipse cx="0" cy="26" rx="5" ry="6" fill="${P.gesso}"/></g>` +
  // Animata: le forbici fanno "zac zac", i ciuffi tagliati cadono a terra
  forbici(176, 96, 160, 0.9, true) + `<path d="M150 92 l-6 -6 M152 102 l-8 0 M150 112 l-6 6" ${tratto(2.5)}/>` +
  avvolgi('an-cade-ciuffo', ciuffo(70, 186), 'animation-delay:-1.2s') +
  avvolgi('an-cade-ciuffo', ciuffo(170, 180)) +
  avvolgi('an-cade-ciuffo', ciuffo(150, 190), 'animation-delay:-.6s'),

  'rasatura-integrale': () =>
  fondoGuaio + terraGuaio(190) +
  // Animata: il tratteggio della lana che non c'è più pulsa, la pecora si stringe dal freddo
  avvolgi('an-respiro', `<path d="M58 150 Q50 120 76 112 Q90 92 112 104 Q132 96 140 116 Q160 124 152 150 Q148 168 126 166 L84 166 Q60 168 58 150 Z" fill="none" stroke="${NOTTE}" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round"/>`) +
  avvolgi(
    'an-brivido',
    `<g fill="${NOTTE}"><rect x="84" y="150" width="6" height="40" rx="3"/><rect x="118" y="150" width="6" height="40" rx="3"/></g>` +
      `<ellipse cx="102" cy="140" rx="30" ry="18" fill="${PELLE}" ${tratto()}/>` +
      `<path d="M90 132 q4 -3 8 0 M106 132 q4 -3 8 0" fill="none" ${tratto(1.5)}/>` +
      `<ellipse cx="136" cy="124" rx="11" ry="13" fill="${NOTTE}"/><ellipse cx="131" cy="112" rx="7" ry="3.5" fill="${NOTTE}" transform="rotate(-30 131 112)"/>` +
      `<circle cx="139" cy="122" r="2.8" fill="${P.gesso}"/><path d="M134 132 q4 2 8 0" fill="none" stroke="${P.gesso}" stroke-width="2" stroke-linecap="round"/>` +
      `<g fill="${PELLE}"><ellipse cx="128" cy="130" rx="3" ry="1.8"/></g>`,
  ) +
  lana([[172, 178, 12], [188, 176, 14], [204, 180, 10], [182, 162, 12], [196, 164, 10]]),

};

/** Che disegno ha una carta. Accetta anche gli id d'istanza ("beee-no#2"). */
export function illustrazioneDi(id: IdCarta): Illustrazione {
  const tipo = tipoDi(id);
  const simbolo = SIMBOLI[tipo];
  if (simbolo) return { tipo: 'sprite', simbolo };
  const disegno = ILL_METEO[tipo] ?? ILL_TROVATE[tipo] ?? ILL_BELATI[tipo] ?? ILL_GUAI[tipo];
  if (disegno) return { tipo: 'disegno', svg: disegno() };
  const d = defCarta(tipo);
  if (d.famiglia === 'guaio') return { tipo: 'ripiego', simbolo: `ico-${d.tipo}` };
  if (d.famiglia === 'trovata') return { tipo: 'ripiego', simbolo: 'agnello' };
  return { tipo: 'ripiego', simbolo: 'agnello' };
}

/** Colore di fondo del ripiego per le famiglie senza un colore proprio. */
const COLORE_RIPIEGO = { trovata: P.menta, belato: P.albicocca } as const;

function ripiego(id: IdCarta, simbolo: string, colorePerGuaio: string): string {
  const d = defCarta(id);
  const colore = d.famiglia === 'guaio' ? colorePerGuaio : COLORE_RIPIEGO[d.famiglia];
  const sfondo = `<rect x="22" y="72" width="206" height="146" rx="10" fill="${colore}" stroke="${P.notte}" stroke-width="4"/>`;
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
  if (ill.tipo === 'disegno') interno = ill.svg;
  else if (ill.tipo === 'sprite') interno = (animata && illAnimata(ill.simbolo)) || `<use href="#${ill.simbolo}" width="250" height="350"/>`;
  else interno = ripiego(id, ill.simbolo, colorePerGuaio);
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${interno}</svg>`;
}
