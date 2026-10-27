// @vitest-environment jsdom
// Il banco di prova pubblicato a un indirizzo nascosto (/banco/): la pagina di sviluppo della scena, da usare anche sul
// telefono. Qui si fissa che la build lo compili come pagina a parte, che nessuno lo trovi dal gioco e che non tocchi
// le preferenze salvate dal gioco vero sullo stesso telefono.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import configurazione, { CONFIG_BANCO } from '../../../../vite.config';
import { isolaArchivio, PREFISSO_BANCO } from './archivio';

const leggi = (percorso: string) => readFileSync(resolve(process.cwd(), percorso), 'utf8');

describe('il banco di prova pubblicato a /banco/', () => {
  it('la build del gioco resta com\'era; il banco ha una build sua, in dist/banco/', () => {
    // il gioco: solo client/index.html (nessun ingresso in più che cambierebbe i suoi pezzi)
    expect(configurazione.build?.rolldownOptions?.input).toBeUndefined();
    const nomi = (configurazione.plugins ?? []).flat().map((p) => (p && typeof p === 'object' && 'name' in p ? p.name : null));
    expect(nomi).toContain('banco-di-prova');
    // il banco: radice client/banco (la sua index.html), uscita client/dist/banco, percorsi relativi
    const client = resolve(process.cwd(), 'client');
    expect(relative(client, CONFIG_BANCO.root!).replace(/\\/g, '/')).toBe('banco');
    expect(relative(client, CONFIG_BANCO.build!.outDir!).replace(/\\/g, '/')).toBe('dist/banco');
    expect(CONFIG_BANCO.base).toBe('./');
    expect(CONFIG_BANCO.configFile).toBe(false);
  });

  it('la pagina non si fa indicizzare, resta chiara e monta la pagina di sviluppo della scena', () => {
    const html = leggi('client/banco/index.html');
    expect(html).toMatch(/<meta\s+name="robots"\s+content="noindex, nofollow"\s*\/?>/);
    expect(html).toMatch(/<title>Banco di prova<\/title>/);
    expect(html).toMatch(/src="\.\.\/src\/scena\/sviluppo\/sviluppo\.tsx"/);
    // la pagina di sviluppo di prima resta e monta lo stesso modulo
    expect(leggi('client/scena.html')).toMatch(/src="\.\/src\/scena\/sviluppo\/sviluppo\.tsx"/);
  });

  it('il gioco non lo nomina da nessuna parte', () => {
    const radice = resolve(process.cwd(), 'client/src');
    const file = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? file(p) : [p];
      });
    for (const f of file(radice)) {
      const r = relative(radice, f).replace(/\\/g, '/');
      if (r.startsWith('scena/sviluppo/') || /\.test\.tsx?$/.test(r)) continue;
      expect(readFileSync(f, 'utf8'), r).not.toMatch(/banco\/|scena\.html/);
    }
    expect(leggi('client/index.html')).not.toMatch(/banco|scena\.html/);
  });

  it("l'isolamento dell'archivio è il primo import della pagina (prima che la scena legga le opzioni)", () => {
    const testo = leggi('client/src/scena/sviluppo/sviluppo.tsx');
    const primo = /^\s*import\s+(?:[^';]*?\s+from\s+)?'([^']+)';?/m.exec(testo.replace(/^\s*\/\/.*$/gm, ''));
    expect(primo?.[1]).toBe('./archivio-isolato');
  });
});

describe("l'archivio del banco", () => {
  const vero = globalThis.localStorage;
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: vero, configurable: true, writable: true });
    vero.clear();
  });

  it('le chiavi del banco hanno un prefisso: le preferenze del gioco vero restano come sono', () => {
    vero.setItem('hls-opzioni', '{"suoni":false}');
    vero.setItem('hls-consigli-visti', '3');
    isolaArchivio();
    localStorage.setItem('hls-opzioni', '{"suoni":true}');
    localStorage.removeItem('hls-consigli-visti');
    expect(vero.getItem('hls-opzioni')).toBe('{"suoni":false}');
    expect(vero.getItem('hls-consigli-visti')).toBe('3');
    expect(vero.getItem(`${PREFISSO_BANCO}hls-opzioni`)).toBe('{"suoni":true}');
    expect(localStorage.getItem('hls-opzioni')).toBe('{"suoni":true}');
    expect(localStorage.getItem('hls-consigli-visti')).toBeNull();
  });

  it('clear, length e key vedono solo le chiavi del banco', () => {
    vero.setItem('hls-nome', 'Ada');
    isolaArchivio();
    localStorage.setItem('a', '1');
    expect(localStorage.length).toBe(1);
    expect(localStorage.key(0)).toBe('a');
    localStorage.clear();
    expect(localStorage.length).toBe(0);
    expect(vero.getItem('hls-nome')).toBe('Ada');
  });
});
