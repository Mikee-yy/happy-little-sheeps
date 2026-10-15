// Scheletro del DOM della scena (bozza scena.src.html, righe 264–320), con classi al posto degli id:
// più teatri possono stare nella stessa pagina. Dell'interfaccia in alto restano solo i contenitori;
// i pulsanti Opzioni e Prova eventi stanno nel gioco o nella pagina di sviluppo.
import { T } from '../testi';

export interface ElementiScena {
  schermo: HTMLElement;
  scena: HTMLElement;
  camera: HTMLElement;
  mondo: HTMLElement;
  ui: HTMLElement;
  cieloSvg: SVGSVGElement;
  sole: SVGGElement;
  nuvoleSvg: SVGSVGElement;
  paesaggio: SVGSVGElement;
  flora: SVGSVGElement;
  coperta: HTMLElement;
  mazzo: HTMLElement;
  scarti: HTMLElement;
  mazzoGuai: HTMLElement;
  dicMazzo: HTMLElement;
  dicGuai: HTMLElement;
  dado: HTMLElement;
  dadoPos: HTMLElement;
  nebbiaSvg: SVGSVGElement;
  mano: HTMLElement;
  scoppio: SVGSVGElement;
  consiglio: HTMLElement;
}

const PUNTI_SCOPPIO =
  'M135 6 L156 38 L196 16 L192 52 L246 46 L216 76 L264 104 L210 108 L222 144 L176 124 L150 148 L126 122 L76 144 L84 110 L14 116 L52 82 L6 56 L60 54 L50 16 L98 36 Z';

const HTML = `
<div class="schermo ora-giorno">
  <div class="scena">
    <div class="camera"><div class="mondo">
      <div class="cielo"></div>
      <svg class="cielo-svg" width="390" height="844" aria-hidden="true">
        <g class="stelle" fill="#FBFAF5" stroke="#23264A" stroke-width="1.5">
          <circle cx="40" cy="30" r="2.5"/><circle cx="120" cy="22" r="2"/><circle cx="168" cy="44" r="2.5"/><circle cx="246" cy="18" r="2"/>
          <circle cx="352" cy="34" r="2.5"/><circle cx="84" cy="58" r="2"/><circle cx="-60" cy="40" r="2.5"/><circle cx="460" cy="26" r="2.5"/>
        </g>
        <g class="sole" transform="translate(306 86)"></g>
      </svg>
      <svg class="nuvole-svg" width="390" height="844" aria-hidden="true"></svg>
      <svg class="paesaggio" width="390" height="844" aria-hidden="true"></svg>
      <svg class="flora" width="390" height="844" aria-hidden="true"></svg>
      <div class="penombra"></div>

      <div class="piano"><div class="coperta">
        <div class="pila mazzo" style="left:42px;top:52px" role="button"></div>
        <div class="pila scarti" style="left:138px;top:52px"></div>
        <div class="pila mazzo-guai" style="left:234px;top:52px"></div>
        <div class="dicitura dic-mazzo" style="left:79px;top:166px"></div>
        <div class="dicitura dic-scarti" style="left:175px;top:166px"></div>
        <div class="dicitura dic-guai" style="left:271px;top:166px"></div>
        <div class="dado-base"><div class="dado-ombra-sole"><div class="dado-ombra"></div></div></div>
      </div></div>
      <div class="dado-piano"><div class="dado-coperta">
        <div class="dado-pos" role="button"><div class="dado-salto"><div class="dado"></div></div></div>
      </div></div>

      <svg class="nebbia-svg" width="390" height="844" aria-hidden="true"></svg>
    </div></div>
    <!-- Interfaccia: resta ferma anche quando l'inquadratura del prato si avvicina a un giocatore -->
    <div class="ui">
      <div class="mano"></div>
      <svg class="scoppio" viewBox="0 0 270 150" aria-hidden="true">
        <path d="${PUNTI_SCOPPIO}" fill="#23264A" transform="translate(0 7)"/>
        <path d="${PUNTI_SCOPPIO}" fill="#F2E27A" stroke="#23264A" stroke-width="4" stroke-linejoin="round"/>
        <text x="135" y="90" text-anchor="middle" style="font:800 34px var(--font-titoli),sans-serif;fill:#23264A"></text>
      </svg>
      <div class="hud"></div>
      <div class="consiglio"></div>
    </div>
  </div>
</div>`;

/** Costruisce il DOM della scena sotto `radice` (che diventa il `.teatro`) e restituisce gli elementi che servono. */
export function creaScheletro(radice: HTMLElement): ElementiScena {
  radice.classList.add('teatro');
  radice.innerHTML = HTML;
  const trova = <E extends Element>(classe: string): E => {
    const e = radice.querySelector<E>('.' + classe);
    if (!e) throw new Error(`Scheletro della scena: manca .${classe}`);
    return e;
  };
  const el: ElementiScena = {
    schermo: trova('schermo'),
    scena: trova('scena'),
    camera: trova('camera'),
    mondo: trova('mondo'),
    ui: trova('ui'),
    cieloSvg: trova<SVGSVGElement>('cielo-svg'),
    sole: trova<SVGGElement>('sole'),
    nuvoleSvg: trova<SVGSVGElement>('nuvole-svg'),
    paesaggio: trova<SVGSVGElement>('paesaggio'),
    flora: trova<SVGSVGElement>('flora'),
    coperta: trova('coperta'),
    mazzo: trova('mazzo'),
    scarti: trova('scarti'),
    mazzoGuai: trova('mazzo-guai'),
    dicMazzo: trova('dic-mazzo'),
    dicGuai: trova('dic-guai'),
    dado: trova('dado'),
    dadoPos: trova('dado-pos'),
    nebbiaSvg: trova<SVGSVGElement>('nebbia-svg'),
    mano: trova('mano'),
    scoppio: trova<SVGSVGElement>('scoppio'),
    consiglio: trova('consiglio'),
  };
  // I testi visibili stanno nel file dei testi
  el.dicMazzo.textContent = T.scena.diciture.mazzo;
  trova('dic-scarti').textContent = T.scena.diciture.scarti;
  el.dicGuai.textContent = T.scena.diciture.guai;
  el.mazzo.setAttribute('aria-label', T.scena.etichette.mazzo);
  el.dadoPos.setAttribute('aria-label', T.scena.etichette.dado);
  const testoScoppio = el.scoppio.querySelector('text');
  if (testoScoppio) testoScoppio.textContent = T.scena.scoppio;
  el.consiglio.textContent = T.scena.consigli.solleva;
  return el;
}
