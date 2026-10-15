// @vitest-environment jsdom
// La scena caricata a parte: finché non arriva c'è il prato vuoto; se lo scaricamento fallisce un messaggio con "Riprova",
// che ricrea il componente pigro e ritenta (React.lazy da solo terrebbe l'errore per sempre).
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Fotografia, PostoFoto } from '../scena/fotografia';
import { T } from '../testi';
import { usaCaricatoreDiProva } from './caricaScena';
import { ScenaCaricata } from './ScenaCaricata';

type ModuloScena = typeof import('../scena/Scena');

const posto = (i: number): PostoFoto => ({
  id: `g${i + 1}`,
  nome: ['Anna', 'Bruno'][i]!,
  pecora: (['nerina', 'ricciolo'] as const)[i]!,
  agnellini: 5,
  angolo: [],
  carteInMano: 5,
  eliminato: false,
  fuoriDalRound: false,
  deveAgire: false,
  giocata: null,
  unGuaioAllEliminazione: false,
  quasiPieno: false,
});
const FOTO: Fotografia = {
  posti: [posto(0), posto(1)],
  gregge: 20,
  postiOvile: 15,
  totaleAgnellini: 40,
  mano: null,
  mazzo: 40,
  mazzoGuai: 21,
  scarti: [],
  guaioRound: null,
  dado: null,
  round: 1,
  ultimoRound: false,
  ora: 'giorno',
};

/** Una scena finta al posto di quella vera (il teatro è provato in scena/). */
const moduloFinto = { Scena: () => <div className="scena-finta" /> } as unknown as ModuloScena;

let erroriReact: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // React scrive in console gli errori presi dal confine: qui sono voluti
  erroriReact = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  usaCaricatoreDiProva(null);
  erroriReact.mockRestore();
});

const aspetta = () => act(async () => {});

describe('scena caricata a parte', () => {
  it('finché la scena non arriva si vede il prato vuoto (col riassunto), poi la scena', async () => {
    let arriva: (m: ModuloScena) => void = () => {};
    usaCaricatoreDiProva(() => new Promise<ModuloScena>((r) => (arriva = r)));
    render(<ScenaCaricata foto={FOTO} />);
    await aspetta();
    expect(document.querySelector('.scena-in-arrivo')).not.toBeNull();
    expect(document.querySelector('.solo-lettori')?.textContent).toMatch(/Gregge: /);
    expect(document.querySelector('.scena-finta')).toBeNull();
    await act(async () => arriva(moduloFinto));
    expect(document.querySelector('.scena-finta')).not.toBeNull();
    expect(document.querySelector('.scena-in-arrivo')).toBeNull();
  });

  it('se lo scaricamento fallisce: messaggio e "Riprova"; riprovando la scena arriva', async () => {
    const caricatore = vi
      .fn<() => Promise<ModuloScena>>()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValue(moduloFinto);
    usaCaricatoreDiProva(caricatore);
    render(<ScenaCaricata foto={FOTO} />);
    await aspetta();
    const avviso = document.querySelector('.scena-non-caricata');
    expect(avviso?.textContent).toContain(T.scena.caricamento.fallito);
    expect(avviso?.getAttribute('role')).toBe('alert');
    expect(document.querySelector('.scena-finta')).toBeNull();
    const riprova = [...document.querySelectorAll('button')].find((b) => b.textContent === T.scena.caricamento.riprova)!;
    expect(riprova).toBeDefined();
    await act(async () => {
      fireEvent.click(riprova);
    });
    await aspetta();
    expect(caricatore).toHaveBeenCalledTimes(2);
    expect(document.querySelector('.scena-finta')).not.toBeNull();
    expect(document.querySelector('.scena-non-caricata')).toBeNull();
  });
});
