// @vitest-environment jsdom
// Criterio della fase 4 nell'interfaccia: tre dispositivi completano una partita, ognuno vede solo la propria mano.
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessioneHost } from '../../../sync/host';
import { archivioInMemoria } from '../../../sync/locale';
import { SessioneOspite } from '../../../sync/ospite';
import type { Iscrizione } from '../../../sync/stanza';
import { ArchivioMemoria } from '../../../sync/trasporto-memoria';
import { Sprite } from '../grafica';
import { Stanza } from './Stanza';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function aspetta(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function clic(el: Element | null | undefined) {
  if (!el) throw new Error('elemento mancante');
  await act(async () => {
    fireEvent.click(el);
  });
}

const pulsanteIn = (radice: HTMLElement, testo: string) =>
  [...radice.querySelectorAll('button')].find((b) => !b.disabled && b.textContent?.trim().startsWith(testo));

/** Una mossa sul dispositivo, se ce n'è una da fare. */
async function mossa(radice: HTMLElement): Promise<boolean> {
  const area = radice.querySelector('.area-azione');
  if (!area) return false;
  let b: HTMLButtonElement | undefined;
  if ((b = pulsanteIn(area as HTMLElement, 'Lancia il dado'))) {
    await clic(b);
    await aspetta(1000);
    return true;
  }
  const arena = area.querySelector('svg.arena');
  if (arena) {
    await act(async () => {
      fireEvent.pointerDown(arena, { pointerId: 1, clientX: 5, clientY: 5 });
    });
    await act(async () => {
      fireEvent.pointerUp(arena, { pointerId: 1, clientX: 5, clientY: 5 });
    });
    await aspetta(1700);
    return true;
  }
  if (area.querySelector('.furto')) {
    for (let k = 0; k < 10; k++) {
      const piu = [...area.querySelectorAll('.furto button')].find((x) => x.textContent === '+' && !(x as HTMLButtonElement).disabled);
      if (!piu) break;
      await clic(piu);
    }
    await clic(pulsanteIn(area as HTMLElement, 'Conferma'));
    return true;
  }
  for (const t of ['Lascia passare', 'Usa l', 'Prendo il Guaio', 'Non scarto']) {
    if ((b = pulsanteIn(area as HTMLElement, t))) {
      await clic(b);
      return true;
    }
  }
  const carta = area.querySelector('.mano button.carta:not(.spenta)');
  if (carta) await clic(carta);
  b = pulsanteIn(area as HTMLElement, 'Gioca') ?? pulsanteIn(area as HTMLElement, 'Tieni') ?? pulsanteIn(area as HTMLElement, 'Scarta');
  if (!b) b = [...area.querySelectorAll<HTMLButtonElement>('.scelte-nomi button')].find((x) => !x.disabled);
  if (!b) return false;
  await clic(b);
  return true;
}

describe('Schermate sempre con un\'uscita', () => {
  it('chi arriva a partita iniziata vede il motivo e può uscire', async () => {
    const rete = new ArchivioMemoria();
    const host = await SessioneHost.crea(rete.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    await SessioneOspite.entra(rete.dispositivo('u2'), host.codice, { nome: 'Bea', pecora: 'nerina', gettone: 'b' });
    await aspetta();
    host.inizia(1);
    await aspetta();
    const tardi = await SessioneOspite.entra(rete.dispositivo('u3'), host.codice, { nome: 'Cleo', pecora: 'sospirella', gettone: 'c' });
    await aspetta();
    let uscito = false;
    const isc: Iscrizione = { codice: host.codice, ruolo: 'ospite', idGiocatore: null, nome: 'Cleo', pecora: 'sospirella', gettone: 'c' };
    render(<Stanza sessione={tardi} iscrizione={isc} onEsci={() => (uscito = true)} onRegole={() => {}} />);
    await aspetta();
    expect(document.body.textContent).toMatch(/già iniziata/);
    await clic(pulsanteIn(document.body, 'Esci'));
    expect(uscito).toBe(true);
  });

  it('nel velo di pausa ci sono Regole ed Esci anche per gli ospiti', async () => {
    const rete = new ArchivioMemoria();
    const host = await SessioneHost.crea(rete.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    const bea = await SessioneOspite.entra(rete.dispositivo('u2'), host.codice, { nome: 'Bea', pecora: 'nerina', gettone: 'b' });
    await aspetta();
    host.inizia(1);
    await aspetta();
    host.chiudi(); // l'host chiude il browser
    await aspetta();
    const isc: Iscrizione = { codice: host.codice, ruolo: 'ospite', idGiocatore: 'g2', nome: 'Bea', pecora: 'nerina', gettone: 'b' };
    render(<Stanza sessione={bea} iscrizione={isc} onEsci={() => {}} onRegole={() => {}} />);
    await aspetta();
    const velo = document.querySelector('[role=alertdialog]') as HTMLElement;
    expect(velo.textContent).toMatch(/host/);
    expect(pulsanteIn(velo, 'Esci')).toBeDefined();
    expect(pulsanteIn(velo, 'Regole')).toBeDefined();
  });

  it("la sala d'attesa mostra il riassunto e il collegamento alle Regole", async () => {
    const rete = new ArchivioMemoria();
    const host = await SessioneHost.crea(rete.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    await aspetta();
    let regole = 0;
    const isc: Iscrizione = { codice: host.codice, ruolo: 'host', idGiocatore: host.idGiocatore, nome: 'Ada', pecora: 'ricciolo', gettone: 'a' };
    render(<Stanza sessione={host} iscrizione={isc} onEsci={() => {}} onRegole={() => regole++} />);
    await aspetta();
    expect(document.querySelector('.sala .riassunto h2')?.textContent).toBe('Come si gioca, in breve');
    await clic(pulsanteIn(document.body, 'Leggi tutte le regole'));
    expect(regole).toBe(1);
  });
});

describe('Tre dispositivi', () => {
  it("dalla sala d'attesa alla fine della partita, ognuno con la sua mano", async () => {
    const rete = new ArchivioMemoria();
    const host = await SessioneHost.crea(rete.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
    const bea = await SessioneOspite.entra(rete.dispositivo('u2'), host.codice, { nome: 'Bea', pecora: 'nerina', gettone: 'b' });
    const cleo = await SessioneOspite.entra(rete.dispositivo('u3'), host.codice, { nome: 'Cleo', pecora: 'sospirella', gettone: 'c' });
    await aspetta();
    const isc = (ruolo: 'host' | 'ospite', nome: string, gettone: string): Iscrizione => ({
      codice: host.codice,
      ruolo,
      idGiocatore: ruolo === 'host' ? 'g1' : null,
      nome,
      pecora: 'nerina',
      gettone,
    });
    const schermi = [
      { id: 'g1', radice: document.createElement('div') },
      { id: 'g2', radice: document.createElement('div') },
      { id: 'g3', radice: document.createElement('div') },
    ];
    for (const s of schermi) document.body.appendChild(s.radice);
    render(<Sprite />);
    render(<Stanza sessione={host} iscrizione={isc('host', 'Ada', 'a')} onEsci={() => {}} onRegole={() => {}} />, { container: schermi[0]!.radice });
    render(<Stanza sessione={bea} iscrizione={isc('ospite', 'Bea', 'b')} onEsci={() => {}} onRegole={() => {}} />, { container: schermi[1]!.radice });
    render(<Stanza sessione={cleo} iscrizione={isc('ospite', 'Cleo', 'c')} onEsci={() => {}} onRegole={() => {}} />, { container: schermi[2]!.radice });
    await aspetta();

    // Sala d'attesa: codice e QR per tutti, "Inizia" solo per l'host.
    for (const s of schermi) {
      expect(s.radice.querySelector('.codice-grande')?.textContent).toBe(host.codice);
      expect(s.radice.querySelector('svg.qr')).not.toBeNull();
    }
    expect(pulsanteIn(schermi[1]!.radice, 'Inizia')).toBeUndefined();
    await clic(pulsanteIn(schermi[0]!.radice, 'Inizia la partita'));
    await aspetta();

    let giri = 0;
    while (!host.vista(null).esito) {
      if (++giri > 4000) throw new Error('la partita non finisce');
      let mosso = false;
      for (const s of [...schermi.slice(giri % 3), ...schermi.slice(0, giri % 3)]) {
        // Mai carte di altri giocatori su questo schermo, tranne quelle scoperte sul tavolo.
        const mia = host.vista(s.id).giocatori.find((g) => g.id === s.id)!.mano ?? [];
        for (const el of s.radice.querySelectorAll('.area-azione .mano [data-carta]')) {
          const c = el.getAttribute('data-carta')!;
          const richiesta = host.vista(s.id).richiesta;
          expect(mia.includes(c) || (richiesta?.giocatore === s.id && richiesta.tipo === 'guarda_due' && richiesta.carte.includes(c))).toBe(true);
        }
        expect(s.radice.querySelector('.errore')).toBeNull();
        if (await mossa(s.radice)) {
          mosso = true;
          await aspetta();
          break;
        }
      }
      if (!mosso) await aspetta(7000);
    }
    await aspetta();
    for (const s of schermi) expect(s.radice.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
    expect(pulsanteIn(schermi[0]!.radice, 'Nuova partita con gli stessi giocatori')).toBeDefined();
  }, 120_000);
});
