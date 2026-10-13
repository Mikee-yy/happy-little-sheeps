// @vitest-environment jsdom
// Criterio della fase 3: una partita a 3 si gioca dall'inizio alla fine su un dispositivo, senza vedere le mani altrui.
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const pulsante = (testo: string) =>
  [...document.querySelectorAll('button')].find((b) => !b.disabled && b.textContent?.trim().startsWith(testo));

async function clic(el: Element | undefined | null) {
  if (!el) throw new Error('elemento mancante');
  await act(async () => {
    fireEvent.click(el);
  });
}

async function aspetta(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Un passo di gioco "da giocatore qualsiasi". Restituisce false quando la partita è finita. */
async function passo(): Promise<boolean> {
  if (document.querySelector('.fine-partita')) return false;
  let b: HTMLButtonElement | undefined;
  if ((b = pulsante('Sono '))) return clic(b).then(() => true);
  if ((b = pulsante('Continua'))) return clic(b).then(() => true);
  if ((b = pulsante('Nessuno'))) return clic(b).then(() => true);
  if ((b = pulsante('Lancia il dado'))) {
    await clic(b);
    await aspetta(1000);
    return true;
  }
  const arena = document.querySelector('svg.arena');
  if (arena) {
    await act(async () => {
      fireEvent.pointerDown(arena, { pointerId: 1, clientX: 10, clientY: 10 });
    });
    await act(async () => {
      fireEvent.pointerMove(arena, { pointerId: 1, clientX: 10, clientY: 10 });
      fireEvent.pointerUp(arena, { pointerId: 1, clientX: 10, clientY: 10 });
    });
    await aspetta(1700);
    return true;
  }
  if (document.querySelector('.furto')) {
    for (let k = 0; k < 10; k++) {
      const piu = [...document.querySelectorAll('.furto button')].find((x) => x.textContent === '+' && !(x as HTMLButtonElement).disabled);
      if (!piu) break;
      await clic(piu);
    }
    return clic(pulsante('Conferma')).then(() => true);
  }
  for (const t of ['Usa l', 'Prendo il Guaio', 'Non scarto']) if ((b = pulsante(t))) return clic(b).then(() => true);
  const c = document.querySelector('.area-azione .mano button.carta:not(.spenta)');
  if (c) await clic(c);
  b = pulsante('Gioca') ?? pulsante('Tieni') ?? pulsante('Scarta') ?? pulsante('Lascia passare');
  if (!b) b = [...document.querySelectorAll<HTMLButtonElement>('.area-azione .scelte-nomi button')].find((x) => !x.disabled);
  if (!b) throw new Error(`Nessuna mossa possibile: ${document.querySelector('.area-azione')?.textContent}`);
  await clic(b);
  return true;
}

describe('Partita su un solo dispositivo', () => {
  it('3 giocatori: dalla preparazione alla fine, senza mai mostrare due mani né carte durante il passaggio', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(3);
    await clic(pulsante('Inizia la partita'));
    expect(localStorage.getItem('hls-partita-locale')).not.toBeNull();

    let passi = 0;
    let passaggi = 0;
    while (await passo()) {
      if (++passi > 3000) throw new Error('la partita non finisce');
      expect(document.querySelector('.errore')).toBeNull();
      // Mai più di una mano a schermo; durante il passaggio nessuna carta.
      expect(document.querySelectorAll('.area-azione .mano').length).toBeLessThanOrEqual(2);
      if (document.querySelector('.passaggio')) {
        passaggi++;
        expect(document.querySelectorAll('.carta')).toHaveLength(0);
      }
      const titolo = document.querySelector('.area-azione h2')?.textContent ?? '';
      const mani = document.querySelectorAll('.area-azione .mano');
      if (mani.length > 0 && /scegli in segreto/.test(titolo)) {
        // La mano mostrata è di chi ha il dispositivo: la sua riga è evidenziata.
        expect(document.querySelectorAll('.riga-ovile.attiva')).toHaveLength(1);
      }
    }
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(passaggi).toBeGreaterThan(3);
    // A partita finita il salvataggio non serve più.
    expect(localStorage.getItem('hls-partita-locale')).toBeNull();
  }, 120_000);

  it('una partita interrotta si riprende dalla Home', async () => {
    const primo = render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('Inizia la partita'));
    await clic(pulsante('Continua'));
    primo.unmount();
    render(<App />);
    await clic(pulsante('Riprendi la partita'));
    expect(document.querySelector('.passaggio h1')?.textContent).toMatch(/^Passa il dispositivo a /);
  });
});

describe('Riassunto e regole', () => {
  it('nella Home il "?" accanto a "Gioca su questo dispositivo" spiega il passaggio del dispositivo', async () => {
    render(<App />);
    const aiuto = document.querySelector('button[aria-label="Come funziona il gioco su un solo dispositivo"]');
    expect(aiuto?.textContent).toBe('?');
    expect(aiuto?.getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.spiega-qui')).toBeNull();
    await clic(aiuto);
    expect(aiuto?.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.spiega-qui')?.textContent).toMatch(/tutti insieme/);
    expect(document.querySelector('.spiega-qui')?.textContent).toMatch(/passa/);
    await clic(aiuto);
    expect(document.querySelector('.spiega-qui')).toBeNull();
  });

  it('la preparazione mostra il riassunto; dalle Regole si torna con le scelte intatte', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    expect(document.querySelector('.riassunto h2')?.textContent).toBe('Come si gioca, in breve');
    expect(document.querySelectorAll('.riassunto li')).toHaveLength(7);
    // In alto, subito sotto il titolo, l'avviso che le regole sono in fondo.
    const avviso = document.querySelector('.preparazione h1 + .vai-regole');
    expect(avviso?.textContent).toBe('Puoi leggere le regole in fondo ↓');
    await clic(avviso);
    await clic(pulsante('4'));
    fireEvent.change(document.querySelector('input[aria-label="Nome 1"]')!, { target: { value: 'Ada' } });
    const radio = document.querySelectorAll('.giocatore-prep')[0]!.querySelectorAll('[role=radio]')[2]!;
    await clic(radio);
    await clic(pulsante('Leggi tutte le regole'));
    expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
    await clic(pulsante('Indietro'));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(4);
    expect((document.querySelector('input[aria-label="Nome 1"]') as HTMLInputElement).value).toBe('Ada');
    expect(document.querySelectorAll('.giocatore-prep')[0]!.querySelectorAll('[role=radio]')[2]!.getAttribute('aria-checked')).toBe('true');
  });
});
