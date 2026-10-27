// La scena 2,5D si carica a parte: dalla pagina iniziale (main.tsx) nessun import statico deve arrivare al teatro,
// al componente della scena o al suo stile. Si segue il grafo degli import statici dei sorgenti (gli `import type`
// e gli `import()` dinamici non contano, come per il bundler).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RADICE = resolve(process.cwd(), 'client/src');

function risolvi(da: string, percorso: string): string | null {
  const base = resolve(dirname(da), percorso);
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(c) && !c.endsWith('/') && /\.[a-z]+$/i.test(c)) return c;
  }
  return null;
}

/** Gli import statici di valore (non solo tipi) di un file sorgente. */
function importStatici(file: string): string[] {
  const testo = readFileSync(file, 'utf8');
  const voci: string[] = [];
  const re = /^\s*import\s+(type\s+)?(?:([^';]*?)\s+from\s+)?'([^']+)';?/gm;
  for (let m = re.exec(testo); m; m = re.exec(testo)) {
    if (m[1]) continue; // import type
    voci.push(m[3]!);
  }
  return voci;
}

function raggiungibili(ingresso: string): Set<string> {
  const visti = new Set<string>();
  const coda = [ingresso];
  while (coda.length) {
    const f = coda.pop()!;
    if (visti.has(f)) continue;
    visti.add(f);
    if (!/\.tsx?$/.test(f)) continue;
    for (const p of importStatici(f)) {
      if (!p.startsWith('.')) continue;
      const r = risolvi(f, p);
      if (r) coda.push(r);
    }
  }
  return visti;
}

describe('scena caricata a parte', () => {
  const visti = [...raggiungibili(resolve(RADICE, 'main.tsx'))].map((f) => relative(RADICE, f).replace(/\\/g, '/'));

  it('il grafo statico arriva davvero alla partita (la prova vede i file)', () => {
    expect(visti).toContain('partita/Partita.tsx');
    expect(visti).toContain('stile.css');
    // …e alla schermata delle Regole: la guardia sulle carte disegnate qui sotto controlla davvero qualcosa
    expect(visti).toContain('regole/Regole.tsx');
    expect(visti).toContain('regole/caricaCarte.ts');
  });

  it('dalla pagina iniziale nessun import statico arriva al teatro, al componente della scena o al suo stile', () => {
    for (const f of ['scena/Scena.tsx', 'scena/teatro.ts', 'scena/scena.css', 'scena/camera.ts', 'scena/ambiente/indice.ts']) {
      expect(visti, f).not.toContain(f);
    }
  });

  it('dalla pagina iniziale nessun import statico arriva alla pagina di sviluppo (il banco di prova di /banco/)', () => {
    expect(visti.filter((f) => f.startsWith('scena/sviluppo/'))).toEqual([]);
  });

  it('la scena arriva con un import dinamico', () => {
    const testo = readFileSync(resolve(RADICE, 'partita/caricaScena.ts'), 'utf8');
    expect(testo).toMatch(/import\('\.\.\/scena\/Scena'\)/);
  });

  it('dalla pagina iniziale nessun import statico arriva alle carte disegnate e alle loro animazioni', () => {
    for (const f of ['scena/carte/carte.ts', 'scena/carte/illustrazioni.ts', 'scena/carte/animazioni.css', 'regole/carte.tsx']) {
      expect(visti, f).not.toContain(f);
    }
  });

  it('le carte delle Regole arrivano con un import dinamico, e il loro modulo porta con sé le animazioni', () => {
    const caricatore = readFileSync(resolve(RADICE, 'regole/caricaCarte.ts'), 'utf8');
    expect(caricatore).toMatch(/import\('\.\/carte'\)/);
    expect(importStatici(resolve(RADICE, 'regole/caricaCarte.ts'))).not.toContain('./carte');
    const carte = [...raggiungibili(resolve(RADICE, 'regole/carte.tsx'))].map((f) => relative(RADICE, f).replace(/\\/g, '/'));
    expect(carte).toContain('scena/carte/carte.ts');
    expect(carte).toContain('scena/carte/animazioni.css');
  });
});
