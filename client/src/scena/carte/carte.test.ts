// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATALOGO, defCarta } from '../../../../engine/src';
import { cartaSVG, illustrazioneDi, retroSVG } from './carte';

const TIPI = Object.keys(CATALOGO.carte);
const SPRITE = ['sasso-comodo', 'calzino-gemello', 'ombrello-bucato', 'campanaccio-stonato', 'beee-no', 'belato-di-gruppo', 'finta-svenuta', 'grandine-a-sorpresa', 'lupo-vegetariano'];
const METEO = ['pioggia-di-traverso', 'vento-dispettoso', 'nebbia-fitta', 'fulmine-curioso', 'gelata-di-agosto', 'pozzanghera-senza-fondo'];
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
    for (const t of METEO) expect(illustrazioneDi(t).tipo, t).toBe('meteo');
  });

  it('dà il ripiego per tutti gli altri tipi', () => {
    for (const t of TIPI.filter((x) => !SPRITE.includes(x) && !METEO.includes(x))) expect(illustrazioneDi(t).tipo, t).toBe('ripiego');
  });

  it('il ripiego usa il simbolo della famiglia: ico-<tipo> per i Guai, agnello per le Trovate, il fumetto per i Belati', () => {
    expect(illustrazioneDi('figuraccia-al-pascolo')).toEqual({ tipo: 'ripiego', simbolo: 'ico-drammi' });
    expect(illustrazioneDi('volpe-gentile')).toEqual({ tipo: 'ripiego', simbolo: 'ico-predatori' });
    expect(illustrazioneDi('tosatura-a-sorpresa')).toEqual({ tipo: 'ripiego', simbolo: 'ico-tosatura' });
    expect(illustrazioneDi('carriola')).toEqual({ tipo: 'ripiego', simbolo: 'agnello' });
    expect(cartaSVG('figuraccia-al-pascolo')).toContain('href="#ico-drammi"');
    expect(cartaSVG('carriola')).toContain('href="#agnello"');
    expect(cartaSVG('pernacchia')).toContain('Beee!');
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
