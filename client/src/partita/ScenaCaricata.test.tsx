// @vitest-environment jsdom
// La scena caricata a parte: finché non arriva c'è il prato vuoto; se lo scaricamento fallisce un messaggio con "Riprova",
// che ricrea il componente pigro e ritenta (React.lazy da solo terrebbe l'errore per sempre).
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nuovaPartita, vistaPer } from '../../../engine/src';
import { piattaforma } from '../scena/piattaforma';
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

const VISTA = vistaPer(
  nuovaPartita({ giocatori: [{ id: 'g1', nome: 'Anna', pecora: 'nerina' }, { id: 'g2', nome: 'Bruno', pecora: 'ricciolo' }], seme: 1 }),
  null,
);

/** Una scena finta al posto di quella vera (il teatro è provato in scena/): ricorda le props ricevute. */
const ricevute: Record<string, unknown>[] = [];
const moduloFinto = {
  Scena: (props: Record<string, unknown>) => {
    ricevute.push(props);
    return <div className="scena-finta" />;
  },
} as unknown as ModuloScena;

let erroriReact: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  // React scrive in console gli errori presi dal confine: qui sono voluti
  erroriReact = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  ricevute.length = 0;
  usaCaricatoreDiProva(null);
  erroriReact.mockRestore();
});

const aspetta = () => act(async () => {});

describe('scena caricata a parte', () => {
  it('finché la scena non arriva si vede il prato vuoto (col riassunto), poi la scena', async () => {
    let arriva: (m: ModuloScena) => void = () => {};
    usaCaricatoreDiProva(() => new Promise<ModuloScena>((r) => (arriva = r)));
    render(<ScenaCaricata foto={FOTO} vista={VISTA} />);
    await aspetta();
    expect(document.querySelector('.scena-in-arrivo')).not.toBeNull();
    expect(document.querySelector('.solo-lettori')?.textContent).toMatch(/Gregge: /);
    expect(document.querySelector('.scena-finta')).toBeNull();
    await act(async () => arriva(moduloFinto));
    expect(document.querySelector('.scena-finta')).not.toBeNull();
    expect(document.querySelector('.scena-in-arrivo')).toBeNull();
  });

  it('senza connessione: il messaggio della rete e "Riprova"; riprovando la scena arriva', async () => {
    vi.spyOn(piattaforma, 'online').mockReturnValue(false);
    const caricatore = vi
      .fn<() => Promise<ModuloScena>>()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValue(moduloFinto);
    usaCaricatoreDiProva(caricatore);
    render(<ScenaCaricata foto={FOTO} vista={VISTA} />);
    await aspetta();
    const avviso = document.querySelector('.scena-non-caricata');
    expect(avviso?.textContent).toContain(T.scena.caricamento.fallito);
    expect(avviso?.getAttribute('role')).toBe('alert');
    expect(document.querySelector('.scena-finta')).toBeNull();
    // senza rete "Ricarica la pagina" non serve
    expect([...document.querySelectorAll('button')].some((b) => b.textContent === T.scena.caricamento.ricarica)).toBe(false);
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

  describe('con la connessione presente il pacchetto non arriva: il sito è stato aggiornato', () => {
    const fallisce = () => usaCaricatoreDiProva(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));
    const pulsanteCon = (testo: string) => [...document.querySelectorAll('button')].find((b) => b.textContent === testo);

    it('testo di aggiornamento, "Ricarica la pagina" che ricarica davvero, e "Riprova" come seconda scelta', async () => {
      vi.spyOn(piattaforma, 'online').mockReturnValue(true);
      const ricarica = vi.spyOn(piattaforma, 'ricarica').mockImplementation(() => {});
      fallisce();
      render(<ScenaCaricata foto={FOTO} vista={VISTA} />);
      await aspetta();
      const avviso = document.querySelector('.scena-non-caricata')!;
      expect(avviso.getAttribute('role')).toBe('alert');
      expect(avviso.textContent).toContain(T.scena.caricamento.aggiornato);
      expect(avviso.textContent).not.toContain(T.scena.caricamento.fallito);
      expect(pulsanteCon(T.scena.caricamento.riprova)).toBeDefined();
      expect(ricarica).not.toHaveBeenCalled();
      await act(async () => {
        fireEvent.click(pulsanteCon(T.scena.caricamento.ricarica)!);
      });
      expect(ricarica).toHaveBeenCalledTimes(1);
    });

    it('nella partita di prova (non si salva) il testo dice che riparte da capo', async () => {
      vi.spyOn(piattaforma, 'online').mockReturnValue(true);
      fallisce();
      render(<ScenaCaricata foto={FOTO} vista={VISTA} salvata={false} />);
      await aspetta();
      const avviso = document.querySelector('.scena-non-caricata')!;
      expect(avviso.textContent).toContain(T.scena.caricamento.aggiornatoProva);
      expect(avviso.textContent).not.toContain(T.scena.caricamento.aggiornato);
      expect(pulsanteCon(T.scena.caricamento.ricarica)).toBeDefined();
    });

    it('il tasto "Riprova" dopo un aggiornamento ritenta lo scaricamento', async () => {
      vi.spyOn(piattaforma, 'online').mockReturnValue(true);
      const caricatore = vi.fn<() => Promise<ModuloScena>>().mockRejectedValueOnce(new Error('x')).mockResolvedValue(moduloFinto);
      usaCaricatoreDiProva(caricatore);
      render(<ScenaCaricata foto={FOTO} vista={VISTA} />);
      await aspetta();
      await act(async () => {
        fireEvent.click(pulsanteCon(T.scena.caricamento.riprova)!);
      });
      await aspetta();
      expect(document.querySelector('.scena-finta')).not.toBeNull();
    });
  });

  it('passa alla scena la vista del tavolo e chi vuole sapere quando la scena è occupata', async () => {
    usaCaricatoreDiProva(() => Promise.resolve(moduloFinto));
    const onOccupato = () => {};
    render(<ScenaCaricata foto={FOTO} vista={VISTA} onOccupato={onOccupato} nascosta sospesa />);
    await aspetta();
    expect(ricevute.at(-1)).toMatchObject({ foto: FOTO, vista: VISTA, onOccupato, nascosta: true, sospesa: true });
  });

  it('passa alla scena la domanda, chi riceve i gesti, il pensiero e chi vuole sapere quando la scena è pronta', async () => {
    usaCaricatoreDiProva(() => Promise.resolve(moduloFinto));
    const domanda = { chiave: 'k', scritta: 'Continua', avvisi: [], carte: [], sollevate: [], trascinabili: [], pecore: [], dado: false, guai: [], guaioScelto: null, grandi: [], centro: null, furto: null, pulsanti: [], testata: false };
    const suGesto = () => {};
    const pensiero = { testo: 'Bea sta pensando…', pulsanti: [] };
    const onPronto = () => {};
    render(<ScenaCaricata foto={FOTO} vista={VISTA} domanda={domanda} suGesto={suGesto} pensiero={pensiero} onPronto={onPronto} />);
    await aspetta();
    expect(ricevute.at(-1)).toMatchObject({ domanda, suGesto, pensiero, onPronto });
  });
});
