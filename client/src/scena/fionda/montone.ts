// Il Montone della Testata disegnato a pezzi, per animarlo: lo stesso disegno del simbolo `#montone` del pacchetto
// (design/svg/sprite.svg: di profilo verso destra, cornice 220×160, piedi e ombra attorno a (110, 150)), con le parti
// separate in gruppi con una classe ciascuno. Le pose sono classi sull'elemento che lo contiene (`posa-volo`…, vedi
// `mettiPosa`); i loro stili e fotogrammi stanno in scena.css, sezione "Montone animato".
//
// Ogni parte che gira ha il perno nell'origine del suo gruppo (`perno`): il gruppo con la classe sta dentro uno spostato sul
// perno e disegna con le coordinate di prima riportate indietro. Così le trasformazioni del foglio di stile (con l'origine
// in 0 0) girano attorno al punto giusto senza misurare niente: le zampe all'anca, la testa al collo, la coda alla radice.
//
// Le parti che si vedono solo in una posa (occhi a spirale, scia del vento, sbuffi, stelline, polvere) sono nascoste con
// l'attributo `visibility`, che il foglio di stile scavalca nella posa giusta: senza foglio di stile restano nascoste.
import { TAVOLOZZA } from '../ambiente/paesaggio';

const P = TAVOLOZZA;

/** Le pose del Montone, ognuna una classe `posa-…` sull'elemento che contiene il disegno. */
export const POSE_MONTONE = ['riposo', 'carica', 'volo', 'botta', 'stordito', 'scuote', 'corre'] as const;
export type PosaMontone = (typeof POSE_MONTONE)[number];

/** Mette sull'elemento la classe della posa `posa`, togliendo quelle delle altre pose (le altre classi restano). */
export function mettiPosa(el: Element, posa: PosaMontone): void {
  for (const p of POSE_MONTONE) el.classList.toggle('posa-' + p, p === posa);
}

const n = (v: number): string => String(Math.round(v * 10) / 10);

/** Un gruppo con la classe `classe` e il perno in (x, y): il contenuto si disegna con le coordinate del gruppo di fuori. */
function perno(x: number, y: number, classe: string, contenuto: string, attributi = ''): string {
  return `<g transform="translate(${n(x)} ${n(y)})"><g class="${classe}"${attributi}><g transform="translate(${n(-x)} ${n(-y)})">${contenuto}</g></g></g>`;
}

/** Una spirale (gli occhi storditi) attorno a (0, 0), larga fino a `r`, in `giri` giri. */
function spirale(r: number, giri: number): string {
  const passi = 36;
  const fine = giri * 2 * Math.PI;
  let d = '';
  for (let i = 0; i <= passi; i++) {
    const a = 0.4 + ((fine - 0.4) * i) / passi;
    const q = (r * a) / fine;
    d += `${i ? ' L' : 'M'}${n(q * Math.cos(a))} ${n(q * Math.sin(a))}`;
  }
  return `<path d="${d}" fill="none" stroke="${P.gesso}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Una stellina a cinque punte centrata in (0, 0). */
function stella(r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.45 : r;
    d += `${i ? ' L' : 'M'}${n(q * Math.cos(a))} ${n(q * Math.sin(a))}`;
  }
  return `<path d="${d} Z" fill="${P.limone}" stroke="${P.notte}" stroke-width="1.8" stroke-linejoin="round"/>`;
}

/** I cerchi del vello come nel simbolo, il primo per ciuffo (si muovono al vento); in fondo l'ovale del corpo, fermo. */
const CIUFFI: [number, number, number][] = [
  [60, 80, 24], [88, 70, 26], [118, 72, 24], [138, 86, 20], [110, 98, 22], [80, 98, 22], [50, 94, 16],
];

/**
 * Il vello in due strati, come `lana()` delle illustrazioni: sotto i cerchi pieni di Notte con il tratto largo (il contorno),
 * sopra gli stessi cerchi di Fango. Lo stesso ciuffo nei due strati ha la stessa classe `mt-cN`, così si muove insieme.
 */
function vello(): string {
  const cerchi = CIUFFI.map(([x, y, r], i) => `<circle class="mt-ciuffo mt-c${i + 1}" cx="${x}" cy="${y}" r="${r}"/>`).join('');
  const ovale = '<ellipse cx="96" cy="86" rx="46" ry="24"/>';
  return (
    `<g class="mt-vello" fill="${P.notte}" stroke="${P.notte}" stroke-width="8">${cerchi}${ovale}</g>` +
    `<g class="mt-vello" fill="${P.fango}">${cerchi}${ovale}</g>` +
    `<path class="mt-riccioli" d="M74 82 q6 -6 12 0 M104 70 q6 -6 12 0 M98 100 q6 -6 12 0" fill="none" stroke="${P.notte}" stroke-width="3" stroke-linecap="round"/>`
  );
}

/** Una zampa con l'anca in (x, y), girata di `giro` gradi a riposo (come nel simbolo), lunga `lunga`. */
function zampa(classe: string, x: number, y: number, giro: number, lunga: number): string {
  return perno(x, y, 'mt-zampa ' + classe, `<rect x="${x - 6}" y="${y - 4}" width="12" height="${lunga}" rx="6" transform="rotate(${giro} ${x} ${y})"/>`);
}

/** La testa nel suo sistema (quello del simbolo: spostata in (166, 94) e girata di 18°): orecchio, muso, occhi, corno, sbuffi. */
function testa(): string {
  const tratto = `stroke="${P.notte}" stroke-width="4" stroke-linejoin="round"`;
  const orecchio = perno(-5, -10, 'mt-orecchio', `<ellipse cx="-12" cy="-12" rx="9" ry="4" transform="rotate(-20 -12 -12)" fill="${P.notte}" ${tratto}/>`);
  const muso = `<ellipse cx="4" cy="0" rx="22" ry="15" fill="${P.notte}" ${tratto}/>`;
  const occhi =
    '<g class="mt-occhi">' +
    perno(8, -5, 'mt-occhio', `<circle cx="8" cy="-5" r="2.8" fill="${P.gesso}"/>`) +
    perno(2, -11, 'mt-ciglio', `<path d="M2 -11 L14 -8" stroke="${P.gesso}" stroke-width="3" stroke-linecap="round"/>`) +
    '</g>';
  // Gli occhi a spirale, al posto dell'occhio: il gruppo interno gira attorno al centro della spirale
  const storditi = `<g class="mt-spirale" visibility="hidden" transform="translate(10 -2)"><g class="mt-gira">${spirale(7, 2)}</g></g>`;
  const corno = perno(
    -8,
    -10,
    'mt-corna',
    `<circle cx="-8" cy="-10" r="13" fill="${P.limone}" ${tratto}/>` +
      `<path d="M-8 -16 a6 6 0 1 1 -6 6 a3 3 0 0 1 3 -3" fill="none" stroke="${P.notte}" stroke-width="3" stroke-linecap="round"/>`,
  );
  // Gli sbuffi dalle narici, sotto la punta del muso: due nuvolette che escono a turno
  const nuvoletta = (classe: string, k: number) =>
    `<g class="mt-sbuffo ${classe}"><g fill="${P.gesso}" stroke="${P.notte}" stroke-width="1.8">` +
    `<circle cx="0" cy="0" r="${n(4 * k)}"/><circle cx="${n(5 * k)}" cy="${n(2 * k)}" r="${n(3.2 * k)}"/><circle cx="${n(1 * k)}" cy="${n(4 * k)}" r="${n(2.6 * k)}"/></g></g>`;
  const sbuffi = `<g class="mt-sbuffi" visibility="hidden" transform="translate(24 7)">${nuvoletta('mt-s1', 1)}${nuvoletta('mt-s2', 0.85)}</g>`;
  return `<g transform="translate(166 94) rotate(18)">${orecchio}${muso}${occhi}${storditi}${corno}${sbuffi}</g>`;
}

/** Il Montone intero: l'elemento <svg> (classe `mt`) da mettere al posto di `<svg viewBox="0 0 220 160"><use href="#montone"/></svg>`. */
export function montoneSVG(): string {
  const ombra = `<ellipse class="mt-ombra" cx="110" cy="150" rx="70" ry="6" fill="${P.notte}" opacity=".15"/>`;
  // La scia del vento: le righe di velocità del simbolo e una più corta sotto, ognuna con il perno sulla punta verso il Montone
  const filo = (i: number, x: number, y: number, d: string) =>
    perno(x, y, `mt-filo mt-f${i}`, `<path d="${d}" fill="none" stroke="${P.notte}" stroke-width="4" stroke-linecap="round"/>`);
  const scia =
    '<g class="mt-scia" visibility="hidden">' +
    filo(1, 38, 66, 'M8 66 h30') +
    filo(2, 34, 84, 'M2 84 h32') +
    filo(3, 36, 102, 'M12 102 h24') +
    filo(4, 36, 118, 'M20 118 h16') +
    '</g>';
  // La polvere che alza correndo, come i due sbuffi a terra del simbolo
  const polvere =
    `<g class="mt-polvere" visibility="hidden" fill="${P.gesso}" stroke="${P.notte}" stroke-width="3">` +
    perno(40, 140, 'mt-nuvola mt-p1', '<circle cx="40" cy="140" r="7"/>') +
    perno(28, 144, 'mt-nuvola mt-p2', '<circle cx="28" cy="144" r="5"/>') +
    '</g>';
  // La coda: un ciuffetto di vello dietro il corpo (ne sbuca solo la punta), con la radice nel vello
  const coda = perno(
    46,
    84,
    'mt-coda',
    `<g fill="${P.notte}" stroke="${P.notte}" stroke-width="6"><circle cx="34" cy="80" r="8"/><circle cx="29" cy="88" r="5.5"/></g>` +
      `<g fill="${P.fango}"><circle cx="34" cy="80" r="8"/><circle cx="29" cy="88" r="5.5"/></g>`,
  );
  // Le zampe come nel simbolo: anca, giro a riposo, lunghezza
  const zampe =
    `<g fill="${P.notte}">` +
    `<g class="mt-zampe-dt">${zampa('mt-dt-1', 64, 100, 40, 42)}${zampa('mt-dt-2', 82, 104, 22, 40)}</g>` +
    `<g class="mt-zampe-av">${zampa('mt-av-1', 124, 104, -30, 40)}${zampa('mt-av-2', 140, 100, -52, 42)}</g>` +
    '</g>';
  const corpo = `<g class="mt-corpo">${vello()}</g>`;
  // Le stelline dello stordimento girano sopra la testa, su un'ellisse (i fotogrammi le spostano attorno al centro)
  const stelline =
    '<g class="mt-stelline" visibility="hidden" transform="translate(160 58)">' +
    [1, 2, 3].map((i) => `<g class="mt-stella mt-st${i}">${stella(i === 2 ? 4.4 : 5.4)}</g>`).join('') +
    '</g>';
  const tutto = perno(110, 148, 'mt-tutto', coda + zampe + corpo + perno(150, 90, 'mt-testa', testa()) + stelline);
  return (
    '<svg class="mt" viewBox="0 0 220 160" style="display:block;width:100%;overflow:visible" aria-hidden="true">' +
    ombra + scia + polvere + tutto +
    '</svg>'
  );
}
