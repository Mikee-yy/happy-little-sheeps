// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGO, defCarta } from '../../../../engine/src';
import { cartaSVG, illustrazioneDi, retroSVG } from './carte';

const TIPI = Object.keys(CATALOGO.carte);
const BELATI_NUOVI = ['pernacchia', 'mondo-alla-rovescia', 'faccio-finta-di-niente', 'visita-di-garzina'];
const PREDATORI_NUOVI = ['volpe-gentile', 'aquila-con-il-taccuino', 'occhi-nel-cespuglio', 'lupo-travestito', 'invito-nel-bosco', 'faina-con-la-lista'];
const TOSATURE_NUOVE = ['tosatura-a-sorpresa', 'spuntatina', 'rasatura-integrale'];
const DRAMMI_NUOVI = ['figuraccia-al-pascolo', 'specchio-impietoso', 'crisi-esistenziale', 'gregge-senza-di-te', 'compleanno-dimenticato', 'insonnia', 'inciampo-al-ruscello'];
const SPRITE = ['sasso-comodo', 'calzino-gemello', 'ombrello-bucato', 'campanaccio-stonato', 'beee-no', 'belato-di-gruppo', 'finta-svenuta', 'grandine-a-sorpresa', 'lupo-vegetariano'];
const TROVATE_NUOVE = ['scorta-nel-vello', 'agnellino-smarrito', 'ciliegie-appaiate', 'fischietto-da-richiamo', 'pantofola-gemella', 'pulizie-di-primavera', 'orecchino-gemello', 'trifoglio-qualunque', 'capriola', 'balla-di-fieno', 'megafono-di-latta', 'coperta-di-lana', 'cannocchiale', 'carriola', 'tappi-per-le-orecchie', 'corona-di-margherite'];
const METEO = ['pioggia-di-traverso', 'vento-dispettoso', 'nebbia-fitta', 'fulmine-curioso', 'gelata-di-agosto', 'pozzanghera-senza-fondo'];
/** Le carte disegnate in codice con le parti animate (Trovate, Belati e Guai; il meteo ha le sue prove a parte). */
const ANIMATE = [...TROVATE_NUOVE, ...BELATI_NUOVI, ...PREDATORI_NUOVI, ...DRAMMI_NUOVI, ...TOSATURE_NUOVE];
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

describe('cartaSVG', () => {
  it('per ogni tipo di carta contiene il nome (in maiuscolo) e, se c\'è, il valore', () => {
    for (const tipo of TIPI) {
      const d = defCarta(tipo);
      const svg = cartaSVG(tipo);
      expect(svg, tipo).toContain(esc(d.nome.toUpperCase()));
      if (d.famiglia === 'trovata') expect(svg, tipo).toContain(`>${d.valore}</text>`);
    }
  });

  it('gli id d\'istanza danno la stessa carta del tipo', () => {
    expect(cartaSVG('beee-no#2')).toBe(cartaSVG('beee-no'));
    expect(cartaSVG('beee-no#2', true)).toBe(cartaSVG('beee-no', true));
    expect(illustrazioneDi('beee-no#2')).toEqual(illustrazioneDi('beee-no'));
  });

  it('la carta animata ha la classe "anima", quella ferma no', () => {
    expect(cartaSVG('sasso-comodo', true)).toContain('class="anima"');
    expect(cartaSVG('sasso-comodo')).not.toContain('class="anima"');
  });

  it('senza lo sprite nella pagina la carta animata ripiega sul disegno fermo', () => {
    expect(cartaSVG('lupo-vegetariano', true)).toContain('href="#g-lupo"');
  });

  it('il dorso usa il simbolo giusto', () => {
    expect(retroSVG(false)).toContain('#back-main');
    expect(retroSVG(true)).toContain('#back-guai');
  });

  it('nessun testo di carta è copiato nel modulo: il nome viene da defCarta', () => {
    for (const f of ['carte.ts', 'illustrazioni.ts']) {
      const sorgente = readFileSync(resolve(process.cwd(), 'client/src/scena/carte', f), 'utf8');
      expect(sorgente).not.toContain('Sasso comodo');
      expect(sorgente).not.toContain('Ci si siede');
    }
  });
});

describe('illustrazioneDi', () => {
  it('dà lo sprite per i 9 tipi con il disegno del pacchetto', () => {
    for (const t of SPRITE) expect(illustrazioneDi(t).tipo, t).toBe('sprite');
    expect(illustrazioneDi('sasso-comodo')).toEqual({ tipo: 'sprite', simbolo: 'c-sasso' });
    expect(illustrazioneDi('lupo-vegetariano')).toEqual({ tipo: 'sprite', simbolo: 'g-lupo' });
  });

  it('dà il meteo disegnato per i 6 Guai meteo senza disegno', () => {
    for (const t of METEO) expect(illustrazioneDi(t).tipo, t).toBe('disegno');
  });

  it('ogni carta del catalogo ha uno sprite o un disegno, mai il ripiego', () => {
    for (const t of TIPI) expect(['sprite', 'disegno'], t).toContain(illustrazioneDi(t).tipo);
  });
});

describe('cache', () => {
  it('la carta animata prodotta senza sprite nella pagina non resta in cache', () => {
    const ferma = cartaSVG('sasso-comodo', true);
    expect(ferma).toContain('href="#c-sasso"');
    document.body.insertAdjacentHTML(
      'beforeend',
      '<svg><symbol id="c-sasso"><g/><g id="p1"/><g id="p2"/><g id="p3"/><g id="p4"/><g id="p5"/></symbol></svg>',
    );
    const animata = cartaSVG('sasso-comodo', true);
    expect(animata).toContain('an-germoglio');
    expect(animata).not.toBe(ferma);
  });
});

describe('Trovate disegnate in codice', () => {
  it('le 16 Trovate nuove hanno un disegno, non il ripiego', () => {
    for (const t of TROVATE_NUOVE) expect(illustrazioneDi(t).tipo, t).toBe('disegno');
  });

  it('le Trovate, i Belati e i Guai disegnati hanno parti animate, e la carta ferma è lo stesso disegno senza la classe "anima"', () => {
    for (const t of ANIMATE) {
      const animata = cartaSVG(t, true);
      const ferma = cartaSVG(t, false);
      expect(animata, t).toMatch(/<g class="an an-[a-z-]+/);
      expect(ferma, t).not.toContain('class="anima"');
      expect(animata, t).toBe(ferma.replace('<svg viewBox="0 0 250 350" aria-hidden="true">', '<svg viewBox="0 0 250 350" aria-hidden="true" class="anima">'));
    }
  });

  it('ogni classe di animazione delle carte disegnate ha la sua regola in carte/animazioni.css, valida anche fuori dalla scena', () => {
    const css = leggiCss('carte/animazioni.css');
    for (const t of TIPI)
      for (const [, cls] of cartaSVG(t, true).matchAll(/<g class="an (an-[a-z-]+)/g)) expect(css, `${t}: ${cls}`).toMatch(new RegExp(`^\\.anima \\.${cls} \\{`, 'm'));
  });

  it('"NESSUN EFFETTO" compare solo sulle Trovate senza effetto che non sono Gemelle', () => {
    const attese = ['sasso-comodo', 'trifoglio-qualunque', 'balla-di-fieno', 'coperta-di-lana', 'ombrello-bucato', 'carriola', 'corona-di-margherite'];
    const con = TIPI.filter((t) => cartaSVG(t).includes('>NESSUN EFFETTO<'));
    expect(con.sort()).toEqual(attese.sort());
    for (const t of TIPI) {
      const d = defCarta(t);
      if (d.famiglia === 'trovata' && d.effetto === null && !d.gemella) expect(attese, t).toContain(t);
    }
  });
});

/** Un foglio di stile, senza i commenti e con le righe a capo Unix. */
const leggiCss = (f: string) =>
  readFileSync(resolve(process.cwd(), 'client/src/scena', f), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

describe('animazioni delle carte (carte/animazioni.css)', () => {
  const animazioni = leggiCss('carte/animazioni.css');
  const scena = leggiCss('scena.css');

  it('le regole delle carte valgono per ogni ".anima", non solo nella scena (tranne la carta appena pescata)', () => {
    expect(animazioni).toMatch(/^\.anima \.an \{[^}]*transform-box: fill-box;[^}]*animation-iteration-count: infinite;/m);
    const nelTeatro = animazioni.match(/^\s*\.teatro[^{]*\{/gm) ?? [];
    expect(nelTeatro.map((s) => s.trim())).toEqual(['.teatro .cm.una-volta .anima .an {', '.teatro .leggero .anima .an {']);
    expect(scena).not.toMatch(/\.anima/);
  });

  it('nel modo leggero della scena (telefoni lenti) ogni parte fa un giro solo e si ferma, come la carta appena pescata', () => {
    expect(animazioni).toMatch(/^\.teatro \.leggero \.anima \.an \{ animation-iteration-count: 1; \}/m);
  });

  it('con "Riduci movimento" ogni parte di ogni carta animata sta ferma', () => {
    expect(animazioni).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.anima \.an \{ animation: none !important; \}\s*\}/);
  });

  it('ogni fotogramma usato dalle carte sta in animazioni.css, una volta sola, e non più in scena.css', () => {
    const nomi = new Set([...animazioni.matchAll(/animation-name: (an-[a-z-]+)/g)].map((m) => m[1]!));
    expect(nomi.size).toBeGreaterThan(40);
    for (const n of nomi) {
      expect(animazioni.match(new RegExp(`@keyframes ${n} \\{`, 'g')), n).toHaveLength(1);
      expect(scena, n).not.toContain(`@keyframes ${n} {`);
    }
  });

  it('gli occhi del lupo nella pozza usano ancora an-palpebra, che ora sta in animazioni.css (la scena carica entrambi i file)', () => {
    expect(scena).toMatch(/\.teatro \.pozza \.occhi-lupo \{[^}]*animation: an-palpebra /);
    expect(animazioni).toContain('@keyframes an-palpebra {');
    for (const f of ['Scena.tsx', 'sviluppo/sviluppo.tsx']) {
      const sorgente = readFileSync(resolve(process.cwd(), 'client/src/scena', f), 'utf8');
      expect(sorgente, f).toMatch(/import '(\.\.\/)?(\.\/)?scena\.css';/);
      expect(sorgente, f).toMatch(/import '(\.\.\/|\.\/)carte\/animazioni\.css';/);
    }
  });
});

describe('Belati disegnati in codice', () => {
  it('i 4 Belati nuovi hanno un disegno e nessun Belato usa più il ripiego', () => {
    for (const t of BELATI_NUOVI) expect(illustrazioneDi(t).tipo, t).toBe('disegno');
    for (const t of TIPI.filter((x) => defCarta(x).famiglia === 'belato')) expect(illustrazioneDi(t).tipo, t).not.toBe('ripiego');
  });
});

describe('Predatori disegnati in codice', () => {
  it('i 6 Predatori nuovi hanno un disegno, non il ripiego', () => {
    for (const t of PREDATORI_NUOVI) expect(illustrazioneDi(t).tipo, t).toBe('disegno');
  });
});

describe('Drammi disegnati in codice', () => {
  it('7 Drammi nuovi hanno un disegno, non il ripiego', () => {
    for (const t of DRAMMI_NUOVI) expect(illustrazioneDi(t).tipo, t).toBe('disegno');
  });
});

describe('Tosature disegnate in codice', () => {
  it('le 3 Tosature hanno un disegno, non il ripiego', () => {
    for (const t of TOSATURE_NUOVE) expect(illustrazioneDi(t).tipo, t).toBe('disegno');
  });
});
