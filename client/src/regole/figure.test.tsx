// @vitest-environment jsdom
// Le figure della schermata Regole: le carte vere (animate, ferme con "Riduci movimento"), i testi alternativi di ogni
// disegno, il Montone del pacchetto e il caricamento a parte delle carte.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO, SETUP, defCarta } from '../../../engine/src';
import { Montone } from '../grafica';
import { T, regole, type DisegnoRegole } from '../testi';
import { testoAlternativo } from './alternativi';
import { CartaRegole } from './carte';
import { caricaCarte, useCarte, usaCaricatoreDiProva } from './caricaCarte';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  usaCaricatoreDiProva(null);
});

/** Un matchMedia finto che risponde "sì" solo a "Riduci movimento". */
const movimentoRidotto = () =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('prefers-reduced-motion: reduce'), media: q }));

const disegniDi = (nomi: readonly string[] | null): DisegnoRegole[] =>
  regole(nomi).flatMap((s) => s.blocchi.flatMap((b) => b.figure.map((f) => f.disegno)));

describe('CartaRegole', () => {
  it('il Cannocchiale ha il testo alternativo con nome, valore e testo, ed è animato', () => {
    const { container } = render(<CartaRegole id="cannocchiale" />);
    const carta = screen.getByRole('img');
    expect(carta.getAttribute('aria-label')).toBe(`Cannocchiale, valore 7. ${defCarta('cannocchiale').testo}`);
    expect(carta.className).toBe('figura-carta');
    expect(container.querySelector('svg.anima')).not.toBeNull();
  });

  it('con "Riduci movimento" nessuna carta è animata', () => {
    movimentoRidotto();
    const { container } = render(
      <>
        <CartaRegole id="cannocchiale" />
        <CartaRegole id="grandine-a-sorpresa" />
        <CartaRegole id="beee-no" />
      </>,
    );
    expect(container.querySelectorAll('.figura-carta > svg')).toHaveLength(3);
    expect(container.querySelector('.anima')).toBeNull();
  });

  it('"Riduci movimento" cambiato con le Regole aperte: le carte si fermano e ripartono subito', () => {
    let ridotto = false;
    const ascoltatori = new Set<(e: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', (q: string) => ({
      get matches() {
        return ridotto && q.includes('prefers-reduced-motion: reduce');
      },
      media: q,
      addEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.add(f),
      removeEventListener: (_: string, f: (e: { matches: boolean }) => void) => ascoltatori.delete(f),
    }));
    const { container, unmount } = render(<CartaRegole id="cannocchiale" />);
    expect(container.querySelector('svg.anima')).not.toBeNull();
    act(() => {
      ridotto = true;
      for (const f of [...ascoltatori]) f({ matches: true });
    });
    expect(container.querySelector('.anima')).toBeNull();
    act(() => {
      ridotto = false;
      for (const f of [...ascoltatori]) f({ matches: false });
    });
    expect(container.querySelector('svg.anima')).not.toBeNull();
    unmount();
    expect(ascoltatori.size).toBe(0);
  });

  it('un Guaio dice "Guaio Meteo", un Belato dice "Belato"', () => {
    render(
      <>
        <CartaRegole id="grandine-a-sorpresa" />
        <CartaRegole id="beee-no" />
      </>,
    );
    const [guaio, belato] = screen.getAllByRole('img');
    expect(guaio!.getAttribute('aria-label')).toBe(`Grandine a sorpresa, Guaio Meteo. ${defCarta('grandine-a-sorpresa').testo}`);
    expect(guaio!.getAttribute('aria-label')).toContain('Guaio Meteo');
    expect(belato!.getAttribute('aria-label')).toBe(`Beee-NO!, Belato. ${defCarta('beee-no').testo}`);
  });
});

describe('testoAlternativo', () => {
  it('non è mai vuoto per nessun disegno delle Regole (fuori partita e con i nomi)', () => {
    const disegni = [...disegniDi(null), ...disegniDi(['Zoe', 'Ugo'])];
    expect(disegni.length).toBeGreaterThan(20);
    for (const d of disegni) {
      const t = testoAlternativo(d);
      expect(t.trim(), JSON.stringify(d)).not.toBe('');
      expect(t, JSON.stringify(d)).not.toMatch(/\b(undefined|null|NaN)\b/);
    }
  });

  it('ogni tipo di disegno delle Regole compare almeno una volta', () => {
    const tipi = new Set(disegniDi(null).map((d) => d.tipo));
    expect([...tipi].sort()).toEqual(['agnellino', 'carta', 'dado', 'faccia', 'guaio', 'montone', 'pecora', 'recinto']);
  });

  it('per gli altri disegni il nome: pecora dal catalogo, agnellino, Montone, dado, faccia, tipo di Guaio, zone del recinto', () => {
    expect(testoAlternativo({ tipo: 'pecora', pecora: 'ricciolo' })).toBe(CATALOGO.pecore.ricciolo.nome);
    expect(testoAlternativo({ tipo: 'pecora', pecora: 'nerina' })).toBe('Nerina');
    expect(testoAlternativo({ tipo: 'agnellino' })).toBe('Agnellino');
    expect(testoAlternativo({ tipo: 'montone' })).toBe('Montone');
    expect(testoAlternativo({ tipo: 'dado' })).toBe('Dado del Pastore');
    expect(testoAlternativo({ tipo: 'faccia', faccia: 'testata' })).toBe('Testata');
    expect(testoAlternativo({ tipo: 'faccia', faccia: 'pascolo_grande' })).toBe('Pascolo 5');
    expect(testoAlternativo({ tipo: 'faccia', faccia: 'furto_piccolo' })).toBe('Furto 2');
    expect(testoAlternativo({ tipo: 'guaio', guaio: 'predatori' })).toBe('Guaio Predatori');
    const recinto = testoAlternativo({ tipo: 'recinto' });
    expect(recinto).toBe(T.regole.alternativi.recinto(3, 2, 1));
    expect(recinto).toMatch(/3.*2.*1.*più in là nessuno/);
    expect(recinto).not.toMatch(/\b0\b/);
  });

  it('le Trovate senza effetto lo dicono, come sulla carta; quelle con effetto e le Gemelle no', () => {
    expect(testoAlternativo({ tipo: 'carta', id: 'carriola' })).toBe(`Carriola, valore 8. Nessun effetto. ${defCarta('carriola').testo}`);
    expect(testoAlternativo({ tipo: 'carta', id: 'cannocchiale' })).not.toContain('Nessun effetto');
    expect(testoAlternativo({ tipo: 'carta', id: 'calzino-gemello' })).not.toContain('Nessun effetto');
  });

  it('le facce seguono setup.json: tutte e cinque hanno un nome', () => {
    for (const f of SETUP.dado) expect(testoAlternativo({ tipo: 'faccia', faccia: f.id }), f.id).not.toBe('');
  });
});

describe('Montone', () => {
  it('usa il simbolo "montone" del pacchetto con la sua cornice 220×160', () => {
    const { container } = render(<Montone size={110} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 220 160');
    expect(svg.querySelector('use')!.getAttribute('href')).toBe('#montone');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.style.width).toBe('110px');
    expect(svg.style.height).toBe('80px');
  });
});

describe('caricaCarte', () => {
  it('scarica le carte una volta sola', async () => {
    const importa = vi.fn(() => import('./carte'));
    usaCaricatoreDiProva(importa);
    const a = caricaCarte();
    const b = caricaCarte();
    expect(a).toBe(b);
    expect((await a).CartaRegole).toBe(CartaRegole);
    expect(importa).toHaveBeenCalledTimes(1);
  });

  it('se lo scaricamento fallisce, la richiesta dopo riprova', async () => {
    let volte = 0;
    usaCaricatoreDiProva(() => (++volte === 1 ? Promise.reject(new Error('rete')) : import('./carte')));
    await expect(caricaCarte()).rejects.toThrow('rete');
    expect((await caricaCarte()).CartaRegole).toBe(CartaRegole);
    expect(volte).toBe(2);
  });

  it('useCarte dà null finché le carte non sono arrivate, poi il modulo', async () => {
    let arriva: (m: typeof import('./carte')) => void = () => {};
    usaCaricatoreDiProva(() => new Promise((r) => (arriva = r)));
    const Prova = () => {
      const carte = useCarte();
      return carte ? <carte.CartaRegole id="cannocchiale" /> : <p>attesa</p>;
    };
    render(<Prova />);
    expect(screen.getByText('attesa')).toBeTruthy();
    await act(async () => arriva(await import('./carte')));
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Cannocchiale');
  });

  it('useCarte con le carte già arrivate le dà subito', async () => {
    usaCaricatoreDiProva(() => import('./carte'));
    await caricaCarte();
    const Prova = () => <p>{useCarte() ? 'pronte' : 'attesa'}</p>;
    render(<Prova />);
    expect(screen.getByText('pronte')).toBeTruthy();
  });

  it('useCarte con lo scaricamento fallito resta null senza errori', async () => {
    usaCaricatoreDiProva(() => Promise.reject(new Error('rete')));
    const Prova = () => <p>{useCarte() ? 'pronte' : 'attesa'}</p>;
    render(<Prova />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('attesa')).toBeTruthy();
  });
});
