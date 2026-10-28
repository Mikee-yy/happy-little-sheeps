// @vitest-environment jsdom
// Prove del Montone disegnato a pezzi (fionda/montone.ts) e delle sue pose in scena.css (sezione "Montone animato"):
// tutte le parti ci sono, le parti di posa sono nascoste di base, ogni posa ha le sue regole, il movimento ridotto le ferma.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TAVOLOZZA } from '../ambiente/paesaggio';
import { mettiPosa, montoneSVG, POSE_MONTONE } from './montone';

const PARTI = [
  'mt-corpo', 'mt-vello', 'mt-testa', 'mt-corna', 'mt-occhi', 'mt-spirale',
  'mt-zampe-av', 'mt-zampe-dt', 'mt-coda', 'mt-sbuffi', 'mt-scia', 'mt-stelline',
];
/** Le parti che si vedono solo in una posa: nel disegno sono nascoste con l'attributo (vale anche senza foglio di stile). */
const NASCOSTE = ['mt-spirale', 'mt-scia', 'mt-sbuffi', 'mt-stelline', 'mt-polvere'];

const disegno = (): SVGSVGElement => {
  const d = document.createElement('div');
  d.innerHTML = montoneSVG();
  return d.querySelector('svg')!;
};

const css = readFileSync(resolve(process.cwd(), 'client/src/scena/scena.css'), 'utf8');
/** La sezione "Montone animato" di scena.css, fino in fondo al file. */
const sezione = css.slice(css.indexOf('Montone animato'));
/** Le regole della sezione: selettore (tutti quelli separati da virgola) e corpo; i blocchi @media restano a parte. */
const regole = (testo: string): { selettori: string[]; corpo: string }[] =>
  [...testo.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(([, s = '', corpo = '']) => ({
    selettori: s.split(',').map((x) => x.trim()).filter(Boolean),
    corpo,
  }));

/**
 * Una piccola cascata per `animation-delay`, fatta qui perché jsdom non la calcola (non conosce lo shorthand `animation`
 * e non tiene conto della specificità): le regole della sezione senza @keyframes e @media, l'elemento le "matcha" con
 * `matches` di jsdom, vince la specificità più alta e a parità l'ultima; `animation:` (qui mai con un ritardo dentro)
 * rimette il ritardo a 0s, come nel browser. I selettori della sezione hanno solo classi, `*` e nomi di elemento.
 */
const regoleSemplici = regole(
  sezione.replace(/@(keyframes|media)[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ''),
);
const specificita = (s: string): number =>
  (s.match(/\.[a-z0-9-]+/gi)?.length ?? 0) * 100 + (s.replace(/\.[a-z0-9-]+/gi, '').match(/(^|[\s>+~])[a-z]+/gi)?.length ?? 0);
function ritardoDi(el: Element): string {
  let migliore: { spec: number; valore: string } | null = null;
  for (const r of regoleSemplici) {
    // L'ultima dichiarazione della regola che tocca il ritardo
    let valore: string | null = null;
    for (const [, prop, v] of r.corpo.matchAll(/(animation(?:-delay)?)\s*:\s*([^;]+)/g)) valore = prop === 'animation' ? '0s' : v!.trim();
    if (valore === null) continue;
    for (const s of r.selettori) {
      if (!el.matches(s)) continue;
      const spec = specificita(s);
      if (!migliore || spec >= migliore.spec) migliore = { spec, valore };
    }
  }
  return migliore?.valore ?? '0s';
}
/** Il Montone nella posa `posa`, dentro la scena (la classe di posa sul contenitore, come in ordini.ts). */
function inPosa(posa: string): Element {
  const d = document.createElement('div');
  d.className = 'teatro';
  d.innerHTML = `<div class="montone posa-${posa}">${montoneSVG()}</div>`;
  return d;
}
/** Per ogni posa, le parti che devono muoversi sfasate (ritardi tutti diversi). */
const SFASATE: Record<string, string[][]> = {
  volo: [['.mt-c1', '.mt-c2', '.mt-c3', '.mt-c4', '.mt-c5', '.mt-c6', '.mt-c7'], ['.mt-f1', '.mt-f2', '.mt-f3', '.mt-f4'], ['.mt-dt-1', '.mt-av-1']],
  corre: [['.mt-c1', '.mt-c2', '.mt-c3', '.mt-c4', '.mt-c5', '.mt-c6', '.mt-c7'], ['.mt-dt-1', '.mt-dt-2', '.mt-av-1', '.mt-av-2'], ['.mt-s1', '.mt-s2'], ['.mt-p1', '.mt-p2']],
  carica: [['.mt-dt-1', '.mt-dt-2', '.mt-av-1', '.mt-av-2']],
  stordito: [['.mt-st1', '.mt-st2', '.mt-st3'], ['.mt-dt-1', '.mt-av-1']],
};

describe('montoneSVG', () => {
  it('ha la stessa cornice del simbolo del pacchetto: 220×160, si mette al posto di <use href="#montone">', () => {
    const svg = disegno();
    expect(svg.getAttribute('viewBox')).toBe('0 0 220 160');
    expect(svg.classList.contains('mt')).toBe(true);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(montoneSVG()).not.toContain('<use');
  });

  it('contiene tutte le parti, ognuna in un gruppo con la sua classe', () => {
    const svg = disegno();
    for (const p of PARTI) expect(svg.querySelector('.' + p), p).not.toBeNull();
    // Quattro zampe, due davanti e due dietro, e i ciuffi del vello che si muovono al vento
    expect(svg.querySelectorAll('.mt-zampe-av .mt-zampa')).toHaveLength(2);
    expect(svg.querySelectorAll('.mt-zampe-dt .mt-zampa')).toHaveLength(2);
    expect(svg.querySelectorAll('.mt-vello .mt-ciuffo').length).toBeGreaterThanOrEqual(6);
    // Occhi, corna, sbuffi e spirale si muovono con la testa
    for (const p of ['mt-corna', 'mt-occhi', 'mt-spirale', 'mt-sbuffi']) expect(svg.querySelector('.mt-testa .' + p), p).not.toBeNull();
  });

  it('occhi a spirale, scia del vento, sbuffi, stelline e polvere sono nascosti di base', () => {
    const svg = disegno();
    for (const p of NASCOSTE) expect(svg.querySelector('.' + p)!.getAttribute('visibility'), p).toBe('hidden');
    // Gli occhi normali e il resto si vedono
    for (const p of ['mt-occhi', 'mt-testa', 'mt-corpo']) expect(svg.querySelector('.' + p)!.getAttribute('visibility'), p).toBeNull();
  });

  it('usa solo i colori della tavolozza della scena', () => {
    const colori = new Set(Object.values(TAVOLOZZA).map((c) => c.toUpperCase()));
    for (const [c] of montoneSVG().matchAll(/#[0-9A-Fa-f]{6}/g)) expect(colori.has(c.toUpperCase()), c).toBe(true);
  });

  it('è sempre lo stesso disegno (niente casualità)', () => {
    expect(montoneSVG()).toBe(montoneSVG());
  });
});

describe('mettiPosa', () => {
  it('mette la classe della posa e toglie le altre, lasciando stare le altre classi', () => {
    const el = document.createElement('div');
    el.className = 'abs montone';
    mettiPosa(el, 'volo');
    expect(el.className).toBe('abs montone posa-volo');
    mettiPosa(el, 'stordito');
    expect([...el.classList]).toEqual(['abs', 'montone', 'posa-stordito']);
  });
});

describe('le pose in scena.css', () => {
  it('scena.css ha la sezione commentata "Montone animato"', () => {
    expect(css).toMatch(/\/\*[^*]*Montone animato/);
  });

  it('ogni posa ha le sue regole', () => {
    expect(POSE_MONTONE).toEqual(['riposo', 'carica', 'volo', 'botta', 'stordito', 'scuote', 'corre']);
    for (const p of POSE_MONTONE) expect(sezione, p).toContain(`.teatro .posa-${p} .mt-`);
  });

  it('la carica usa la variabile --carica (più l\'elastico è tirato, più si dimena)', () => {
    const carica = regole(sezione).filter((r) => r.selettori.some((s) => s.includes('.posa-carica')));
    expect(carica.some((r) => r.corpo.includes('var(--carica'))).toBe(true);
  });

  it('gli occhi a spirale si vedono solo da stordito, la scia solo in volo', () => {
    const visibili = (parte: string) =>
      regole(sezione)
        .filter((r) => /visibility:\s*visible/.test(r.corpo))
        .flatMap((r) => r.selettori)
        .filter((s) => s.includes('.' + parte));
    expect(visibili('mt-spirale').length).toBeGreaterThan(0);
    for (const s of visibili('mt-spirale')) expect(s).toContain('.posa-stordito');
    expect(visibili('mt-scia').length).toBeGreaterThan(0);
    for (const s of visibili('mt-scia')) expect(s).toContain('.posa-volo');
  });

  it('ogni animazione nominata nella sezione ha i suoi fotogrammi', () => {
    const nomi = new Set([...sezione.matchAll(/animation(?:-name)?:\s*([a-z-]+)/g)].map(([, n]) => n).filter((n) => n !== 'none'));
    expect(nomi.size).toBeGreaterThan(5);
    for (const n of nomi) expect(sezione, n).toContain(`@keyframes ${n} {`);
  });

  it('--mt-k (intensità della carica) sta sull\'elemento della posa, così vale con la classe sul contenitore o sull\'svg', () => {
    const r = regole(sezione).find((x) => x.selettori.includes('.teatro .posa-carica'));
    expect(r?.corpo).toContain('--mt-k:');
  });

  it('le parti sfasate restano sfasate: nessuna regola con `animation` più forte azzera i ritardi', () => {
    for (const [posa, gruppi] of Object.entries(SFASATE))
      for (const parti of gruppi) {
        const svg = inPosa(posa);
        const ritardi = parti.map((p) => ritardoDi(svg.querySelector(p)!));
        expect(new Set(ritardi).size, `${posa}: ${parti.join(' ')} → ${ritardi.join(' ')}`).toBe(parti.length);
      }
    // Lo stesso ciuffo nei due strati del vello (contorno e colore) parte insieme
    for (const posa of ['volo', 'corre']) {
      const strati = [...inPosa(posa).querySelectorAll('.mt-vello')];
      for (let i = 1; i <= 7; i++)
        expect(ritardoDi(strati[0]!.querySelector(`.mt-c${i}`)!), `${posa} c${i}`).toBe(ritardoDi(strati[1]!.querySelector(`.mt-c${i}`)!));
    }
  });

  it('mentre carichi tutte e quattro le zampe scalciano, con ampiezza legata alla carica', () => {
    const svg = inPosa('carica');
    // Stessa animazione di scalciata per le quattro zampe (sfasate: vedi la prova delle parti sfasate)
    const scalcia = regoleSemplici.find((r) => r.selettori.includes('.teatro .posa-carica .mt-zampa'));
    expect(scalcia?.corpo).toMatch(/animation:\s*mt-scalcia /);
    for (const z of svg.querySelectorAll('.mt-zampa')) expect(z.matches('.teatro .posa-carica .mt-zampa')).toBe(true);
    const fotogrammi = sezione.match(/@keyframes mt-scalcia \{[\s\S]*?\n\}|@keyframes mt-scalcia \{[^\n]*\}/)?.[0] ?? '';
    expect(fotogrammi).toContain('var(--mt-k');
    // Gira di almeno 30° per parte a carica piena
    const gradi = [...fotogrammi.matchAll(/\* (-?\d+)deg/g)].map(([, g]) => Math.abs(Number(g)));
    expect(Math.max(...gradi)).toBeGreaterThanOrEqual(30);
  });

  it('la botta schiaccia il Montone contro il recinto (stretto e alto, perno sul muso), lo tiene un attimo e poi rimbalza', () => {
    const urto = sezione.match(/@keyframes mt-urto \{[\s\S]*?\n\}/)?.[0] ?? '';
    const scale = [...urto.matchAll(/scale\(([\d.]+), ([\d.]+)\)/g)].map(([, x, y]) => [Number(x), Number(y)] as const);
    // Il colpo: compresso nel verso della corsa, cioè stretto e alto; il rimbalzo: un poco largo e basso
    // (con la posa ferma .96×1.04 il corpo arriva a circa .6×1.35)
    expect(scale.some(([x, y]) => x < 0.7 && y > 1.25)).toBe(true);
    expect(scale.some(([x, y]) => x > 1 && y < 1)).toBe(true);
    // La sosta: due fotogrammi di fila con lo stesso schiacciamento
    expect(urto).toMatch(/\d+%, \d+% \{ transform: [^}]*scale\(0?\.[0-6]\d*, 1\.[2-9]/);
    // La testa resta leggibile: nella sosta si allarga un poco e si abbassa, contro lo schiacciamento del corpo che la contiene
    const testa = sezione.match(/@keyframes mt-urto-testa \{[\s\S]*?\n\}/)?.[0] ?? '';
    const sosta = testa.match(/\d+%, \d+% \{ transform: [^}]*scale\(([\d.]+), ([\d.]+)\)/);
    expect(Number(sosta?.[1])).toBeGreaterThan(1);
    expect(Number(sosta?.[2])).toBeLessThan(1);
    // Il perno del Montone intero, nella botta, sta sul muso (davanti, a destra dei piedi) e all'altezza dei piedi
    const r = regoleSemplici.find((x) => x.selettori.includes('.teatro .posa-botta .mt-tutto'));
    const [, ox, oy] = r?.corpo.match(/transform-origin:\s*(-?[\d.]+)px (-?[\d.]+)(?:px)?/) ?? [];
    expect(Number(ox)).toBeGreaterThan(70);
    expect(Number(oy)).toBe(0);
  });

  it('i riccioli del vello si muovono attorno al loro centro, non all\'origine del disegno', () => {
    const r = regole(sezione).find((x) => x.selettori.includes('.teatro .mt .mt-riccioli'));
    expect(r?.corpo).toMatch(/transform-box:\s*fill-box/);
    expect(r?.corpo).toMatch(/transform-origin:\s*center/);
  });

  it('da fermi, nella corsa si vede un solo sbuffo (i due starebbero uno sopra l\'altro)', () => {
    expect(sezione).toMatch(/\.teatro \.ferma \.mt-s2 \{[^}]*visibility:\s*hidden/);
    const media = sezione.slice(sezione.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(media).toMatch(/\.teatro \.mt-s2 \{[^}]*visibility:\s*hidden/);
  });

  it('nel modo leggero (telefoni lenti) si muove solo il corpo (e da stordito stelline e spirale): vello, scia, zampe, coda no', () => {
    const r = regole(sezione).find((x) => x.selettori.some((s) => s.startsWith('.teatro .leggero .mt *')));
    expect(r, 'regola del modo leggero').toBeDefined();
    expect(r!.corpo).toMatch(/animation:\s*none !important/);
    const sel = r!.selettori.find((s) => s.startsWith('.teatro .leggero .mt *'))!;
    // Si fermano le parti, non il corpo né le stelline e la spirale dello stordito
    const d = inPosa('volo');
    const scena = document.createElement('div');
    scena.className = 'teatro';
    scena.innerHTML = `<div class="leggero">${d.innerHTML}</div>`;
    for (const parte of ['.mt-ciuffo', '.mt-riccioli', '.mt-filo', '.mt-zampa', '.mt-coda', '.mt-orecchio']) {
      const e = scena.querySelector(parte);
      expect(e, parte).not.toBeNull();
      expect(e!.matches(sel), parte).toBe(true);
    }
    for (const parte of ['.mt-tutto', '.mt-stella', '.mt-gira']) expect(scena.querySelector(parte)!.matches(sel), parte).toBe(false);
    expect(sezione).toMatch(/\.teatro \.leggero \.mt-s2 \{[^}]*visibility:\s*hidden/);
  });

  it('nei browser senza le proprietà translate/rotate/scale separate le pose ferme usano transform', () => {
    const blocco = sezione.slice(sezione.indexOf('@supports not (translate: 0)'));
    expect(sezione).toContain('@supports not (translate: 0)');
    // Ogni regola della sezione con translate/rotate/scale ha la sua gemella con transform nel blocco
    const fuori = regole(sezione.slice(0, sezione.indexOf('@supports not (translate: 0)')).replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, ''));
    const conProprieta = fuori.filter((x) => /(^|;)\s*(translate|rotate|scale)\s*:/.test(x.corpo));
    expect(conProprieta.length).toBeGreaterThan(20);
    const dentro = regole(blocco);
    for (const x of conProprieta) {
      for (const s of x.selettori) {
        const gemella = dentro.find((y) => y.selettori.includes(s));
        expect(gemella, s).toBeDefined();
        expect(gemella!.corpo, s).toMatch(/transform:/);
      }
    }
    // Anche la mano e il consiglio che scendono mentre si mira (con l'ingrandimento e la centratura che hanno già)
    const tutto = css.replace(/\r\n/g, '\n');
    const prima = tutto.slice(tutto.indexOf('@supports not (translate: 0)'));
    expect(prima).toMatch(/\.fionda-in-mira \.mano \{[^}]*transform: translateY\(320px\) scale\(var\(--kd, 1\)\)/);
    expect(prima).toMatch(/\.fionda-in-mira \.consiglio \{[^}]*transform: translate\(-50%, 320px\)/);
  });

  it('con il movimento ridotto (preferenza del sistema o classe "ferma") le pose restano senza animazioni', () => {
    const media = sezione.slice(sezione.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(sezione).toContain('@media (prefers-reduced-motion: reduce)');
    expect(media).toMatch(/\.teatro \.mt \*[^{]*\{[^}]*animation:\s*none !important/);
    expect(sezione).toMatch(/\.teatro \.ferma \.mt \*[^{]*\{[^}]*animation:\s*none !important/);
  });
});
