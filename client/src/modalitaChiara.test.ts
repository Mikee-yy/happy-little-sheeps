// Il gioco ha un solo aspetto, sempre chiaro: i browser dei telefoni in modalità notte (Chrome "scurisci i siti",
// Samsung Internet) non devono cambiarne i colori. Lo si dichiara nelle pagine e nel CSS.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const leggi = (percorso: string) => readFileSync(resolve(process.cwd(), percorso), 'utf8');

describe('Solo chiaro, qualunque sia la modalità del telefono', () => {
  for (const pagina of ['client/index.html', 'client/prova.html', 'client/scena.html']) {
    it(`${pagina} dichiara color-scheme "only light"`, () => {
      expect(leggi(pagina)).toMatch(/<meta\s+name="color-scheme"\s+content="only light"\s*\/?>/);
    });
  }

  it('lo stile dell\'interfaccia dichiara :root { color-scheme: only light }', () => {
    expect(leggi('client/src/stile.css')).toMatch(/:root\s*\{[^}]*color-scheme:\s*only light/);
  });

  it('la scena dichiara "only light"', () => {
    const scena = leggi('client/src/scena/scena.css');
    expect(scena).toMatch(/color-scheme:\s*only light/);
    expect(scena).not.toMatch(/color-scheme:\s*light\s*;/);
  });
});
