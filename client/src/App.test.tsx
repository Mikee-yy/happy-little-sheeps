// @vitest-environment jsdom
// Criterio della fase 3: una partita a 3 si gioca dall'inizio alla fine su un dispositivo, senza vedere le mani altrui.
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { caricaScena } from './partita/caricaScena';
import { defCarta } from '../../engine/src';
import type { Fotografia } from './scena/fotografia';
import { T } from './testi';

/**
 * Il teatro vero è provato in scena/ (teatro.test.ts, Scena.test.tsx): qui un teatro finto registra ogni `allinea`,
 * con ciò che era a schermo in quel momento (di chi è il pannello privato, se c'è il "Passa a").
 */
const scena = vi.hoisted(() => ({
  chiamate: [] as { foto: Fotografia; modo: 'calmo' | 'subito'; privata: string | null; passaggio: boolean }[],
}));
vi.mock('./scena/teatro', () => ({
  creaTeatro: (radice: HTMLElement) => {
    radice.classList.add('teatro');
    const nulla = () => {};
    return {
      allinea(foto: Fotografia, modo: 'calmo' | 'subito') {
        scena.chiamate.push({
          foto,
          modo,
          privata: document.querySelector('.area-azione')?.getAttribute('data-giocatore') ?? null,
          passaggio: document.querySelector('.passaggio') !== null,
        });
      },
      adatta: nulla,
      sospendi: nulla,
      avanza: nulla,
      eventoInCorso: () => false,
      salta: nulla,
      stato: () => ({}),
      rivediSuggerimenti: nulla,
      distruggi() {
        radice.innerHTML = '';
      },
      ordini: {},
      ctx: {},
    };
  },
}));
const ultimaFoto = () => scena.chiamate.at(-1)?.foto;

// La scena è un pacchetto a parte (import dinamico): nel gioco la si scarica in anticipo dalla Home, qui prima di tutte le prove
beforeAll(async () => {
  await caricaScena();
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  scena.chiamate.length = 0;
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
  it.each([2, 3, 4])('%i giocatori: dalla preparazione alla fine, senza mai mostrare due mani né carte durante il passaggio', async (quanti) => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic([...document.querySelectorAll('button')].find((b) => b.textContent === String(quanti)));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(quanti);
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
        // Niente sbirciate: durante il passaggio la mano nella scena è coperta
        expect(ultimaFoto()?.mano).toBeNull();
      }
      const titolo = document.querySelector('.area-azione h2')?.textContent ?? '';
      const mani = document.querySelectorAll('.area-azione .mano');
      if (mani.length > 0 && /scegli in segreto/.test(titolo)) {
        // La mano mostrata è di chi ha il dispositivo: è lui in basso nella scena, con la mano scoperta.
        const chi = document.querySelector('.area-azione')?.getAttribute('data-giocatore');
        expect(ultimaFoto()?.posti[0]?.id).toBe(chi);
        expect(ultimaFoto()?.mano).not.toBeNull();
      }
    }
    // Niente sbirciate (punto di revisione 1): la mano è scoperta solo col pannello privato di chi sta in basso
    expect(scena.chiamate.some((c) => c.foto.mano !== null)).toBe(true);
    for (const c of scena.chiamate) {
      if (c.foto.mano === null) continue;
      expect(c.passaggio).toBe(false);
      expect(c.privata).toBe(c.foto.posti[0]!.id);
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

describe('La scena nella partita', () => {
  async function iniziaConNomi() {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    ['Ada', 'Bea', 'Cleo'].forEach((n, i) =>
      fireEvent.change(document.querySelector(`input[aria-label="Nome ${i + 1}"]`)!, { target: { value: n } }),
    );
    await clic(pulsante('Inizia la partita'));
  }

  it('la scena resta montata sotto il "Passa a" e il riassunto è leggibile', async () => {
    await iniziaConNomi();
    const teatro = document.querySelector('.teatro');
    expect(teatro?.getAttribute('aria-hidden')).toBe('true');
    // Il suggerimento dei gesti sta in basso sopra la mano: la scena non ha più bisogno della misura della striscia
    expect(teatro?.classList.contains('spazio-alto')).toBe(false);
    expect(document.querySelector('.solo-lettori')?.textContent).toMatch(/Gregge: /);
    expect(scena.chiamate[0]?.modo).toBe('subito');
    for (let i = 0; i < 20 && !document.querySelector('.passaggio'); i++) await passo();
    expect(document.querySelector('.passaggio.sopra-scena')).not.toBeNull();
    expect(document.querySelector('.teatro')).toBe(teatro);
    expect(ultimaFoto()?.mano).toBeNull();
    expect(scena.chiamate.slice(1).every((c) => c.modo === 'calmo')).toBe(true);
  });

  it('in basso chi ha il telefono: cambia con "Sono io", non con le schermate pubbliche', async () => {
    await iniziaConNomi();
    const nomeInBasso = () => ultimaFoto()?.posti[0]?.nome;
    let ultimo: string | null = null;
    let pubblicheConBea = 0;
    for (let i = 0; i < 400 && pubblicheConBea < 2; i++) {
      const passaA = /^Passa il dispositivo a (.+)$/.exec(document.querySelector('.passaggio h1')?.textContent ?? '')?.[1] ?? null;
      if (!(await passo())) break;
      if (passaA) {
        ultimo = passaA;
        expect(nomeInBasso()).toBe(passaA);
      }
      const area = document.querySelector('.area-azione');
      const pubblica = area !== null && !area.hasAttribute('data-giocatore') && !document.querySelector('.passaggio');
      if (ultimo && pubblica) expect(nomeInBasso()).toBe(ultimo);
      if (ultimo === 'Bea' && pubblica) pubblicheConBea++;
    }
    expect(pubblicheConBea).toBeGreaterThan(0);
  }, 60_000);

  it('il cassetto si abbassa con la maniglia e torna su da solo quando cambia la schermata', async () => {
    await iniziaConNomi();
    const maniglia = () => document.querySelector('.cassetto .maniglia')!;
    expect(maniglia().getAttribute('aria-expanded')).toBe('true');
    expect(maniglia().textContent).toBe(T.scena.cassetto.abbassa);
    // La maniglia controlla il contenuto del cassetto (id unico)
    const contenuto = document.getElementById(maniglia().getAttribute('aria-controls')!);
    expect(contenuto?.classList.contains('cassetto-contenuto')).toBe(true);
    await clic(maniglia());
    expect(maniglia().getAttribute('aria-expanded')).toBe('false');
    expect(maniglia().textContent).toBe(T.scena.cassetto.alza);
    expect(document.querySelector<HTMLElement>('.cassetto-contenuto')?.hidden).toBe(true);
    await clic(pulsante('Continua'));
    // La schermata dopo è privata: si passa il telefono, e il cassetto del nuovo giocatore è su
    if (document.querySelector('.passaggio')) await clic(pulsante('Sono '));
    expect(maniglia().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLElement>('.cassetto-contenuto')?.hidden).toBe(false);
  });

  it('il menu della partita ha le Opzioni della scena', async () => {
    await iniziaConNomi();
    await clic(document.querySelector('.pulsante-menu'));
    const menu = document.querySelector('.menu')!;
    expect(menu.textContent).toContain(T.scena.opzioni.titolo);
    const veloci = [...menu.querySelectorAll('[role=switch]')].find((b) => b.textContent?.startsWith('Animazioni veloci'));
    expect(veloci).toBeDefined();
  });
});

describe('Partita di prova', () => {
  const consiglio = () => document.querySelector('.consiglio')?.textContent ?? '';
  const chiudiConsigli = async () => {
    for (let i = 0; i < 20 && pulsante('Ho capito'); i++) await clic(pulsante('Ho capito'));
  };

  it('dalla Home parte la prova: consiglio di inizio, nessun Passa il dispositivo', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    expect(consiglio()).toMatch(/Questa è una partita di prova contro Bea e Leo/);
    expect(document.querySelector('.passaggio')).toBeNull();
  });

  it("nella prova in basso c'è sempre chi gioca (g1), con la mano sempre scoperta", async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    let attese = 0;
    for (let i = 0; i < 60; i++) {
      if (/sta pensando/.test(document.querySelector('.area-azione')?.textContent ?? '')) attese++;
      await passoProva([]);
    }
    expect(scena.chiamate.length).toBeGreaterThan(5);
    expect(scena.chiamate.every((c) => c.foto.posti[0]!.id === 'g1')).toBe(true);
    // Un solo umano sul dispositivo: la sua mano resta scoperta anche quando pensano i bot
    expect(attese).toBeGreaterThan(0);
    expect(scena.chiamate.every((c) => c.foto.mano !== null)).toBe(true);
  }, 60_000);

  it('il consiglio della prova sta in basso, sopra il cassetto, non nella striscia in cima', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const consiglio = document.querySelector('.consiglio')!;
    expect(consiglio.closest('.fondo-scena')).not.toBeNull();
    expect(consiglio.closest('.testata-scena')).toBeNull();
    // Prima del cassetto, nello stesso fondo
    const fondo = consiglio.closest('.fondo-scena')!;
    const cassetto = fondo.querySelector('.cassetto')!;
    expect(consiglio.compareDocumentPosition(cassetto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // In cima solo intestazione e cronaca
    const testata = document.querySelector('.testata-scena')!;
    expect([...testata.children].map((c) => c.className)).toEqual(expect.arrayContaining(['intestazione']));
    expect([...testata.children].every((c) => ['intestazione', 'cronaca'].includes(c.className))).toBe(true);
  });

  it('il consiglio si chiude con Ho capito e arriva il successivo', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await clic(pulsante('Ho capito'));
    expect(consiglio()).toMatch(/Ogni round si scopre un Guaio/);
  });

  it('in modalità di sviluppo (StrictMode) i bot muovono lo stesso', async () => {
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    await clic(pulsante('Partita di prova'));
    await chiudiConsigli();
    await clic(pulsante('Continua'));
    await chiudiConsigli();
    await clic(document.querySelector('.area-azione .mano button.carta:not(.spenta)'));
    await clic(pulsante('Gioca'));
    await aspetta(5000);
    expect(document.querySelector('.area-azione')?.textContent ?? '').not.toMatch(/sta pensando/);
  });

  it('una mossa di un bot non deseleziona la carta che stai scegliendo', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await chiudiConsigli();
    await clic(pulsante('Continua'));
    await chiudiConsigli();
    const carta = document.querySelector<HTMLButtonElement>('.area-azione .mano button.carta:not(.spenta)')!;
    const id = carta.dataset.carta;
    await clic(carta);
    await aspetta(2500); // intanto Bea e Leo scelgono
    expect(document.querySelector(`.area-azione [data-carta="${id}"]`)?.getAttribute('aria-pressed')).toBe('true');
  });

  it('mentre gioca un bot compare "sta pensando" e nessun pulsante d\'azione', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await chiudiConsigli();
    await clic(pulsante('Continua'));
    await chiudiConsigli();
    expect(document.querySelector('.passaggio')).toBeNull();
    await clic(document.querySelector('.area-azione .mano button.carta:not(.spenta)'));
    await clic(pulsante('Gioca'));
    expect(document.querySelector('.area-azione')?.textContent).toMatch(/(Bea|Leo) sta pensando…/);
    expect(document.querySelectorAll('.area-azione button')).toHaveLength(0);
  });
});

/** Un passo della prova con le mosse "ovvie" del piano: la carta più alta, le Gemelle nel round 2, poi si lascia passare. */
async function passoProva(consigli: string[]): Promise<'fine-prova' | 'fine-partita' | 'avanti'> {
  if (document.querySelector('.fine-prova')) return 'fine-prova';
  if (document.querySelector('.fine-partita')) return 'fine-partita';
  const hoCapito = pulsante('Ho capito');
  if (hoCapito) {
    consigli.push(document.querySelector('.consiglio p')?.textContent ?? '');
    await clic(hoCapito);
    return 'avanti';
  }
  const area = document.querySelector('.area-azione');
  if (/sta pensando/.test(area?.textContent ?? '')) {
    await aspetta(1100);
    return 'avanti';
  }
  const round = Number(/Round (\d+)/.exec(document.querySelector('.titolo-round')?.textContent ?? '')?.[1] ?? 0);
  if (/scegli in segreto/i.test(area?.querySelector('h2')?.textContent ?? '')) {
    const carte = [...document.querySelectorAll<HTMLButtonElement>('.area-azione .mano button.carta:not(.spenta)')];
    const def = (b: HTMLButtonElement) => defCarta(b.dataset.carta!) as { famiglia: string; valore?: number; gemella?: boolean };
    const trovate = carte.filter((b) => def(b).famiglia === 'trovata');
    const gemelle = trovate.filter((b) => def(b).gemella);
    const scelte = round === 2 && gemelle.length >= 2 ? gemelle.slice(0, 2) : [[...trovate.filter((b) => !def(b).gemella), ...trovate].sort((a, b) => (def(b).valore ?? 0) - (def(a).valore ?? 0))[0]!];
    for (const b of scelte) await clic(b);
    await clic([...document.querySelectorAll('.area-azione button')].find((b) => /^Gioca/.test(b.textContent ?? '')));
    return 'avanti';
  }
  const sceltaFinale = [...document.querySelectorAll<HTMLButtonElement>('.area-azione button')].find((b) => b.textContent === 'Scegli una Trovata');
  if (sceltaFinale) {
    await clic(document.querySelector('.area-azione .mano button.carta:not(.spenta)'));
    await clic([...document.querySelectorAll('.area-azione button')].find((b) => /^Gioca/.test(b.textContent ?? '')));
    return 'avanti';
  }
  if (pulsante('Lancia il dado')) {
    await clic(pulsante('Lancia il dado'));
    await aspetta(1000);
    return 'avanti';
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
    return 'avanti';
  }
  if (document.querySelector('.area-azione .furto')) {
    for (let k = 0; k < 10; k++) {
      const piu = [...document.querySelectorAll('.area-azione .furto button')].find((x) => x.textContent === '+' && !(x as HTMLButtonElement).disabled);
      if (!piu) break;
      await clic(piu);
    }
    await clic(pulsante('Conferma'));
    return 'avanti';
  }
  for (const t of ['Continua', 'Lascia passare', 'Non usarlo', 'Non scarto', 'Prendo il Guaio', 'Tieni', 'Conferma']) {
    const b = pulsante(t);
    if (b) {
      await clic(b);
      return 'avanti';
    }
  }
  const qualsiasi = [...document.querySelectorAll<HTMLButtonElement>('.area-azione button')].find((b) => !b.disabled);
  if (!qualsiasi) {
    await aspetta(1100);
    return 'avanti';
  }
  await clic(qualsiasi);
  return 'avanti';
}

async function provaFinoA(meta: 'fine-prova' | 'fine-partita', consigli: string[] = []) {
  for (let i = 0; i < 4000; i++) {
    const r = await passoProva(consigli);
    if (r === meta) return consigli;
    if (r !== 'avanti') throw new Error(`la prova è arrivata a ${r} invece di ${meta}`);
  }
  throw new Error(`la prova non arriva a ${meta}: ${document.querySelector('.titolo-round')?.textContent} — ${document.querySelector('.area-azione')?.textContent?.slice(0, 300)}`);
}

describe('Partita di prova completa', () => {
  it('la prova arriva a "Ora sai come si gioca!" mostrando i consigli principali', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const consigli = await provaFinoA('fine-prova');
    const C = T.prova.consigli;
    for (const k of ['inizio', 'guaio', 'scelta', 'rivelazione', 'tuoDado', 'pascolo', 'furto', 'beeeNo', 'testata', 'fineRound'] as const) {
      expect(consigli, k).toContain(C[k]);
    }
    expect(document.querySelector('.fine-prova h2')?.textContent).toBe('Ora sai come si gioca!');
    // Il riquadro finale sta in basso anche senza cassetto
    expect(document.querySelector('.fine-prova')?.closest('.fondo-scena')).not.toBeNull();
    expect(document.querySelector('.fine-prova')?.closest('.testata-scena')).toBeNull();
    // Con il riquadro finale aperto, sotto non si gioca
    expect(document.querySelector('.area-azione')).toBeNull();
  }, 120_000);

  it('nel tiro del montone il cassetto è a tutta altezza sotto la striscia; abbassato o in altri pannelli no', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    const fondo = () => document.querySelector<HTMLElement>('.fondo-scena')!;
    let altriPannelli = 0;
    for (let i = 0; i < 4000 && !document.querySelector('svg.arena'); i++) {
      if (document.querySelector('.area-azione')) {
        altriPannelli++;
        expect(fondo().classList.contains('a-tutta-altezza')).toBe(false);
      }
      await passoProva([]);
    }
    expect(document.querySelector('svg.arena')).not.toBeNull();
    expect(altriPannelli).toBeGreaterThan(0);
    expect(fondo().classList.contains('a-tutta-altezza')).toBe(true);
    // Parte subito sotto la striscia in cima (in jsdom l'altezza di riserva)
    expect(fondo().style.getPropertyValue('--spazio-alto')).toBe('67px');
    await clic(document.querySelector('.cassetto .maniglia'));
    expect(fondo().classList.contains('a-tutta-altezza')).toBe(false);
    await clic(document.querySelector('.cassetto .maniglia'));
    expect(fondo().classList.contains('a-tutta-altezza')).toBe(true);
  }, 120_000);

  it('Continua la partita porta fino alla fine', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await provaFinoA('fine-prova');
    await clic(pulsante('Continua la partita'));
    await provaFinoA('fine-partita');
    expect(document.querySelector('.fine-partita h2')?.textContent).toMatch(/^Vinc/);
  }, 120_000);

  it('Torna alla schermata principale esce dalla prova', async () => {
    render(<App />);
    await clic(pulsante('Partita di prova'));
    await provaFinoA('fine-prova');
    await clic(pulsante('Torna alla schermata principale'));
    expect(document.querySelector('main.home')).not.toBeNull();
    expect(document.querySelector('.fine-prova')).toBeNull();
  }, 120_000);

  it('una partita vera salvata resta riprendibile', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('Inizia la partita'));
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    const salvata = localStorage.getItem('hls-partita-locale');
    await clic(pulsante('Partita di prova'));
    await clic(pulsante('Ho capito'));
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    expect(localStorage.getItem('hls-partita-locale')).toBe(salvata);
    await clic(pulsante('Riprendi la partita'));
    expect(document.querySelector('.passaggio h1')?.textContent ?? document.querySelector('.area-azione')?.textContent).toBeTruthy();
    expect(document.querySelector('.consiglio')).toBeNull();
  });

  it('ricaricando durante la prova si riapre la Home', async () => {
    const primo = render(<App />);
    await clic(pulsante('Partita di prova'));
    primo.unmount();
    render(<App />);
    expect(document.querySelector('main.home')).not.toBeNull();
    expect(pulsante('Riprendi la partita')).toBeUndefined();
  });
});

describe('Home', () => {
  it('non mostra più il sottotitolo sotto il logo', () => {
    render(<App />);
    expect(document.querySelector('.home')?.textContent).not.toMatch(/Tenere pecore/);
  });
});

describe('Nuova partita', () => {
  it('dopo una partita, "Nuova partita" riparte con dati nuovi', async () => {
    render(<App />);
    await clic(pulsante('Gioca su questo dispositivo'));
    await clic(pulsante('4'));
    fireEvent.change(document.querySelector('input[aria-label="Nome 1"]')!, { target: { value: 'Ada' } });
    await clic(pulsante('Inizia la partita'));
    await clic(document.querySelector('.pulsante-menu'));
    await clic(pulsante('Esci'));
    await clic(pulsante('Gioca su questo dispositivo'));
    expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(3);
    expect((document.querySelector('input[aria-label="Nome 1"]') as HTMLInputElement).value).toBe('');
  });
});

describe('Riassunto e regole', () => {
  it('nella Home il "?" accanto a "Gioca su questo dispositivo" spiega il passaggio del dispositivo', async () => {
    render(<App />);
    const aiuto = document.querySelector('button[aria-label="Come funziona il gioco su un solo dispositivo"]');
    expect(aiuto?.textContent).toBe('?');
    expect(aiuto?.getAttribute('aria-expanded')).toBe('false');
    // aria-controls punta sempre a un elemento che esiste, nascosto finché la spiegazione è chiusa
    const spiega = document.getElementById(aiuto!.getAttribute('aria-controls')!);
    expect(spiega).not.toBeNull();
    expect((spiega as HTMLElement).hidden).toBe(true);
    await clic(aiuto);
    expect(aiuto?.getAttribute('aria-expanded')).toBe('true');
    expect((spiega as HTMLElement).hidden).toBe(false);
    expect(spiega?.textContent).toMatch(/tutti insieme/);
    expect(spiega?.textContent).toMatch(/passa/);
    await clic(aiuto);
    expect((spiega as HTMLElement).hidden).toBe(true);
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
    // Oltre a scorrere, porta il punto della tastiera sul titolo del riassunto
    expect(document.activeElement).toBe(document.querySelector('.riassunto h2'));
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
