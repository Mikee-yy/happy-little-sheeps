// @vitest-environment jsdom
// Il pezzo comune tra la partita su un dispositivo e le stanze. Le prove di Partita e App controllano già tutto il resto
// (scritta, X, Testata, riserva, festa, "Passa a"): qui lo sblocco da fuori, che serve alle stanze quando chi ospita
// rifiuta una mossa già partita (punto di revisione 4 del pezzo 4).
import { act, cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { flushSync } from 'react-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { azioniPossibili, nuovaPartita, tentaApplica, vistaPer } from '../../../engine/src';
import type { Azione, Stato } from '../../../engine/src';
import { fotografia } from '../scena/fotografia';
import type { Domanda, Gesto, Momento } from '../scena/scelte/tipi';
import { caricaScena } from './caricaScena';
import { GiocoInScena } from './GiocoInScena';
import { scena } from './regia';

/** Un teatro finto, come in App.test.tsx ma ridotto: ricorda la domanda e chi ne riceve i gesti. */
const finto = vi.hoisted(() => ({
  domanda: null as Domanda | null,
  suGesto: null as ((g: Gesto) => void) | null,
}));
vi.mock('../scena/teatro', () => ({
  creaTeatro: (radice: HTMLElement) => {
    radice.classList.add('teatro');
    const nulla = () => {};
    return {
      allinea: nulla,
      recita: nulla,
      occupato: () => false,
      ascoltaOccupato: () => nulla,
      chiedi(d: Domanda, suGesto: (g: Gesto) => void) {
        finto.domanda = d;
        finto.suGesto = suGesto;
      },
      smettiDiChiedere() {
        finto.domanda = null;
        finto.suGesto = null;
      },
      pensa: nulla,
      adatta: nulla,
      sospendi: nulla,
      avanza: nulla,
      eventoInCorso: () => false,
      salta: nulla,
      stato: () => ({}),
      rivediSuggerimenti: nulla,
      distruggi() {
        radice.innerHTML = '';
        finto.domanda = null;
        finto.suGesto = null;
      },
      ordini: {},
      ctx: {},
    };
  },
}));

beforeAll(async () => {
  await caricaScena();
});
beforeEach(() => {
  finto.domanda = null;
  finto.suGesto = null;
});
afterEach(cleanup);

/** Una partita a 3 portata fino alla scelta in segreto del primo giocatore (le fasi automatiche proseguono da sole). */
function finoAllaScelta(): Stato {
  let s = nuovaPartita({
    giocatori: [
      { id: 'g1', nome: 'Anna', pecora: 'ricciolo' },
      { id: 'g2', nome: 'Bruno', pecora: 'brontolana' },
      { id: 'g3', nome: 'Carla', pecora: 'sospirella' },
    ],
    seme: 7,
  });
  for (let i = 0; i < 20; i++) {
    const sc = scena(vistaPer(s, null), null);
    if (sc.tipo === 'privata' && sc.pannello === 'scelta') return s;
    const prosegui = azioniPossibili(s, 'sistema').find((a) => a.tipo === 'prosegui');
    if (!prosegui) break;
    const r = tentaApplica(s, prosegui);
    if (!r.ok) break;
    s = r.stato;
  }
  throw new Error('la scelta in segreto non arriva');
}

/** Le props come le darà una stanza: il telefono del giocatore della scelta, mano sempre scoperta. */
function props(s: Stato) {
  const tavolo = vistaPer(s, null);
  const sc = scena(tavolo, null);
  if (sc.tipo !== 'privata') throw new Error('serve una schermata privata');
  const io = sc.giocatore;
  const vistaIo = vistaPer(s, io);
  const momento: Momento = {
    vista: vistaIo,
    schermo: sc,
    azioni: azioniPossibili(s, io),
    sistema: [],
    condiviso: false,
    manoScoperta: true,
  };
  const mano = vistaIo.giocatori.find((g) => g.id === io)?.mano ?? null;
  return {
    tavolo,
    foto: fotografia(tavolo, io, mano),
    momento,
    conAzioni: true,
    errore: null,
    togliErrore: () => {},
    onMenu: () => {},
    riserva: null,
  };
}

async function gesto(g: Gesto) {
  const f = finto.suGesto;
  if (!f) throw new Error(`nessuna domanda a cui rispondere (${JSON.stringify(g)})`);
  await act(async () => {
    f(g);
  });
}

describe('GiocoInScena: sblocco da fuori', () => {
  it('dopo una mossa i gesti si ignorano; cambiando `sblocca` tornano validi e la scelta riparte vuota', async () => {
    const base = props(finoAllaScelta());
    // Come nelle stanze: la mossa parte (vero) ma la vista non cambia finché chi ospita non risponde
    const invia = vi.fn((_a: Azione) => true);
    const { rerender } = render(<GiocoInScena {...base} invia={invia} sblocca={0} />);
    await act(async () => {});
    const d = finto.domanda;
    expect(d, 'la scena chiede la scelta in segreto').not.toBeNull();
    const [prima, seconda] = d!.carte;
    expect(seconda).toBeDefined();

    await gesto({ tipo: 'carta', carta: prima! });
    expect(finto.domanda!.sollevate).toEqual([prima]);
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(1);
    const sollevateDopo = finto.domanda!.sollevate;

    // Bloccata: un'altra carta e un altro "Gioca" non fanno niente
    await gesto({ tipo: 'carta', carta: seconda! });
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(1);
    expect(finto.domanda!.sollevate).toEqual(sollevateDopo);

    // Chi ospita rifiuta: chi lo usa cambia `sblocca`; la scelta riparte vuota e la domanda risponde di nuovo
    rerender(<GiocoInScena {...base} invia={invia} sblocca={1} />);
    await act(async () => {});
    expect(finto.domanda!.sollevate).toEqual([]);
    await gesto({ tipo: 'carta', carta: seconda! });
    expect(finto.domanda!.sollevate).toEqual([seconda]);
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(2);
    expect(invia.mock.calls[1]![0]).not.toEqual(invia.mock.calls[0]![0]);
  });
});

describe('GiocoInScena: blocco legato alla situazione di chi gioca (stanze)', () => {
  /** La stessa partita dopo la scelta di un altro giocatore: un evento in più sul tavolo, niente di cambiato per `io`. */
  function dopoUnAltro(s: Stato, io: string): Stato {
    const altro = (['g1', 'g2', 'g3'] as const).find((g) => g !== io && azioniPossibili(s, g).length > 0)!;
    const r = tentaApplica(s, azioniPossibili(s, altro)[0]!);
    if (!r.ok) throw new Error('mossa altrui rifiutata');
    return r.stato;
  }

  it("senza `situazione` (Partita) un evento nuovo del tavolo toglie il blocco, come prima", async () => {
    const s = finoAllaScelta();
    const base = props(s);
    const invia = vi.fn((_a: Azione) => true);
    const { rerender } = render(<GiocoInScena {...base} invia={invia} />);
    await act(async () => {});
    await gesto({ tipo: 'carta', carta: finto.domanda!.carte[0]! });
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(1);
    const io = base.momento.schermo.tipo === 'privata' ? base.momento.schermo.giocatore : '';
    const tavolo = vistaPer(dopoUnAltro(s, io), null);
    rerender(<GiocoInScena {...base} tavolo={tavolo} invia={invia} />);
    await act(async () => {});
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(2);
  });

  it("con `situazione` l'evento di un altro non toglie il blocco; cambiata la situazione i gesti tornano validi", async () => {
    const s = finoAllaScelta();
    const base = props(s);
    const invia = vi.fn((_a: Azione) => true);
    const { rerender } = render(<GiocoInScena {...base} invia={invia} situazione="prima" />);
    await act(async () => {});
    const [prima, seconda] = finto.domanda!.carte;
    await gesto({ tipo: 'carta', carta: prima! });
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(1);

    // Un altro giocatore sceglie: il tavolo ha un evento nuovo, la mia mossa aspetta ancora chi ospita
    const io = base.momento.schermo.tipo === 'privata' ? base.momento.schermo.giocatore : '';
    const tavolo = vistaPer(dopoUnAltro(s, io), null);
    rerender(<GiocoInScena {...base} tavolo={tavolo} invia={invia} situazione="prima" />);
    await act(async () => {});
    await gesto({ tipo: 'carta', carta: seconda! });
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(1);

    // Chi ospita ha applicato la mossa: la mia situazione cambia e si può di nuovo rispondere
    expect(finto.domanda!.sollevate).toEqual([prima]);
    rerender(<GiocoInScena {...base} tavolo={tavolo} invia={invia} situazione="dopo" />);
    await act(async () => {});
    await gesto({ tipo: 'pulsante', id: 'gioca' });
    expect(invia).toHaveBeenCalledTimes(2);
  });
});

describe("GiocoInScena: l'errore del motore non resta sulla domanda nuova", () => {
  it('cambiata la domanda, già al primo disegno della nuova (prima che il browser dipinga) l\'errore non c\'è più', async () => {
    const base = props(finoAllaScelta());
    const altro: Momento = { ...base.momento, azioni: base.momento.azioni.slice(1) };
    const cambia: { a: ((m: Momento) => void) | null } = { a: null };
    function Involucro() {
      const [momento, setMomento] = useState(base.momento);
      const [errore, setErrore] = useState<string | null>('Errore della domanda di prima');
      cambia.a = setMomento;
      return (
        <GiocoInScena
          {...base}
          momento={momento}
          invia={() => true}
          errore={errore}
          suCambioDomanda={() => setErrore(null)}
        />
      );
    }
    const { container } = render(<Involucro />);
    await act(async () => {});
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Errore della domanda di prima');

    // Fuori da act: flushSync dà il disegno sincrono, come un tocco vero; gli effetti normali verrebbero dopo
    const env = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const primaEnv = env.IS_REACT_ACT_ENVIRONMENT;
    env.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      flushSync(() => cambia.a!(altro));
      expect(container.querySelector('.testata-scena .scritta'), 'la domanda nuova è già mostrata').not.toBeNull();
      expect(container.querySelector('[role="alert"]')).toBeNull();
    } finally {
      env.IS_REACT_ACT_ENVIRONMENT = primaEnv;
    }
    await act(async () => {});
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
