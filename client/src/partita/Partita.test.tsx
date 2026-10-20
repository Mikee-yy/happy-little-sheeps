// @vitest-environment jsdom
// La scritta della domanda nella striscia in cima: la cosa da fare si taglia a due righe, gli avvisi (pericolo, vittoria
// vicina) no, perché sono proprio ciò che il giocatore deve leggere. La pillola lascia passare i tocchi alla scena.
// Le misure vere (altezza della striscia, targhe visibili) le guarda il controllore nel browser; qui la struttura e lo stile.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vuota } from '../scena/scelte/tavolo';
import { T } from '../testi';
import { Mano } from './componenti';
import { Scritta } from './GiocoInScena';

const css = readFileSync(resolve(process.cwd(), 'client/src/stile.css'), 'utf8');
/**
 * Il corpo della regola con quel selettore (esatto, a inizio riga: `.testata-scena` non è `.tavolo-proiettore
 * .testata-scena`).
 */
const regola = (selettore: string): string => {
  const esatto = selettore.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const i = css.search(new RegExp(`^${esatto} \\{`, 'm'));
  if (i < 0) return '';
  return css.slice(i, css.indexOf('}', i));
};

afterEach(cleanup);

describe('Scritta della domanda', () => {
  const istruzione = `${T.scelta.titolo('Anna')} · ${T.scelta.gemelleInsieme}`;
  const avvisi = [
    'Attenta: ancora un Guaio di tipo meteo e torni a casa. Pensaci prima di giocare una carta che lo attira.',
    'Ti mancano 2 agnellini alla vittoria.',
  ];

  it('gli avvisi stanno fuori dalla riga tagliata, ognuno intero; la scritta resta di stato', () => {
    const d = { ...vuota('k', istruzione), avvisi };
    const { container } = render(<Scritta d={d} errore={null} giocatore="g1" />);
    const pillola = container.querySelector('.scritta-scena')!;
    expect(pillola.getAttribute('role')).toBe('status');
    const scritta = pillola.querySelector('.scritta')!;
    expect(scritta.textContent).toBe(istruzione);
    const righe = [...pillola.querySelectorAll('.scritta-avviso')];
    expect(righe.map((r) => r.textContent)).toEqual(avvisi);
    for (const r of righe) expect(scritta.contains(r)).toBe(false);
    expect(pillola.textContent).toContain(istruzione);
    for (const a of avvisi) expect(pillola.textContent).toContain(a);
  });

  it('senza avvisi solo la scritta; l\'errore del motore resta una riga in più', () => {
    const { container } = render(<Scritta d={vuota('k', istruzione)} errore="non adesso" giocatore={null} />);
    expect(container.querySelectorAll('.scritta-avviso')).toHaveLength(0);
    expect(container.querySelector('.errore')?.textContent).toBe('non adesso');
  });

  it('stile: solo la scritta si taglia a due righe; gli avvisi no; la pillola non prende i tocchi', () => {
    expect(regola('.testata-scena .scritta')).toMatch(/-webkit-line-clamp:\s*2/);
    const avviso = regola('.testata-scena .scritta-avviso');
    expect(avviso).not.toBe('');
    expect(avviso).not.toMatch(/line-clamp|overflow:\s*hidden|nowrap/);
    expect(regola('.testata-scena .scritta-scena')).toMatch(/pointer-events:\s*none/);
  });

  it('gli avvisi sono segni brevi di seguito (non righe a tutta frase), ognuno intero', () => {
    const d = { ...vuota('k', istruzione), avvisi };
    const { container } = render(<Scritta d={d} errore={null} giocatore="g1" />);
    const blocco = container.querySelector('.scritta-avvisi')!;
    expect(blocco).not.toBeNull();
    // un solo blocco che li contiene tutti: scorrono sulla stessa riga finché c'è posto
    expect([...blocco.querySelectorAll('.scritta-avviso')].map((r) => r.textContent)).toEqual(avvisi);
    // il segno "!" a sinistra di ognuno è dello stile, il testo resta intero
    expect(regola('.testata-scena .scritta-avviso::before')).toMatch(/content:\s*"!/);
    expect(regola('.testata-scena .scritta-avvisi')).toMatch(/font-size:\s*10px/);
    expect(regola('.testata-scena .scritta-avviso')).not.toMatch(/display:\s*(block|flex)/);
  });

  it('misura stimata: istruzione su 1 riga e due avvisi veri lasciano la striscia sopra y 86 a 390 px', () => {
    // I numeri vengono dal CSS; la larghezza di un carattere è stimata in mezzo corpo (Atkinson, tondo)
    const num = (corpo: string, proprieta: string): number => {
      const m = corpo.match(new RegExp(`(?:^|[\\s;{])${proprieta}:\\s*([\\d.]+)`));
      if (!m) throw new Error(`manca ${proprieta}`);
      return Number(m[1]);
    };
    const intestazione = regola('.testata-scena .intestazione');
    const pillola = regola('.testata-scena .scritta-scena');
    const avvisiCss = regola('.testata-scena .scritta-avvisi');
    const margine = Number(pillola.match(/margin:\s*([\d.]+)px/)![1]);
    const imbottitura = pillola.match(/padding:\s*([\d.]+)px\s+([\d.]+)px/)!;
    expect(regola('.testata-scena')).toMatch(/padding:\s*max\(4px/);
    const alto = 4; // padding-top della striscia senza notch
    const xs = 11; // --testo-xs
    const riga1 = xs * num(pillola, 'line-height');
    const corpoAvvisi = num(avvisiCss, 'font-size');
    const rigaAvvisi = corpoAvvisi * num(avvisiCss, 'line-height');
    const larghezza = 390 - 2 * 8 - 2 * Number(imbottitura[2]);
    const veri = ["Un Guaio all'eliminazione. Ancora un Guaio di tipo Meteo e torni a casa.", "Un agnellino alla vittoria. L'Ovile è quasi pieno."];
    const caratteri = veri.reduce((t, a) => t + a.length + 3, 0); // il segno "! " e lo stacco
    const righeAvvisi = Math.ceil((caratteri * corpoAvvisi * 0.5) / larghezza);
    const fondo = alto + num(intestazione, 'height') + margine + 2 * Number(imbottitura[1]) + riga1 + righeAvvisi * rigaAvvisi;
    expect(righeAvvisi).toBeLessThanOrEqual(2);
    expect(fondo).toBeLessThan(86);
  });
});

describe('Scritta: la X per nasconderla', () => {
  const d = vuota('k', 'Scegli in segreto');

  it("con onChiudi c'è un vero pulsante con il nome da testi; senza, niente X", () => {
    const { container, rerender } = render(<Scritta d={d} errore={null} giocatore="g1" />);
    expect(container.querySelector('button')).toBeNull();
    const suChiudi = vi.fn();
    rerender(<Scritta d={d} errore={null} giocatore="g1" onChiudi={suChiudi} />);
    const x = container.querySelector('button')!;
    expect(x.getAttribute('type')).toBe('button');
    expect(x.getAttribute('aria-label')).toBe(T.scena.scelte.chiudiScritta);
    expect(x.className).toContain('scritta-chiudi');
    fireEvent.click(x);
    expect(suChiudi).toHaveBeenCalledTimes(1);
  });

  it('la X prende i tocchi anche se la pillola li lascia alla scena', () => {
    expect(regola('.testata-scena .scritta-chiudi')).toMatch(/pointer-events:\s*auto/);
  });
});

describe('CSS dei pannelli: classi esplicite al posto di :not() complessi', () => {
  it('nessuna regola usa :not() con un selettore composto (browser vecchi la scartano)', () => {
    expect(css).not.toMatch(/:not\([^)]*[ >+~.][^)]*\)/);
  });

  it('la mano dei pannelli ha una classe sua, con lo stile; la mano della scena non la prende', () => {
    const { container } = render(<Mano carte={['carriola#1']} />);
    const mano = container.querySelector('.mano')!;
    expect(mano.classList.contains('mano-pannello')).toBe(true);
    expect(regola('.mano-pannello')).toMatch(/overflow-x:\s*auto/);
    expect(regola('.mano-pannello')).toMatch(/display:\s*flex/);
    expect(readFileSync(resolve(process.cwd(), 'client/src/scena/scheletro.ts'), 'utf8')).not.toContain('mano-pannello');
  });

  it('il consiglio e il riquadro finale in basso hanno la loro classe; quello della scena no', () => {
    expect(css).toMatch(/\.consiglio-riquadro,\s*\.fine-prova \{[^}]*display:\s*grid/);
    expect(css).toMatch(/\.consiglio-riquadro p,\s*\.fine-prova p \{[^}]*margin:\s*0/);
    const partita = readFileSync(resolve(process.cwd(), 'client/src/partita/Partita.tsx'), 'utf8');
    expect(partita).toContain('"consiglio consiglio-riquadro"');
  });
});
