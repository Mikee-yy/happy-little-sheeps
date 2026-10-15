// Regia degli eventi (bozza scena.src.html, righe 406–435 e 453–462).
// La scena sa sempre se un evento è in corso (Guaio, meteo, furto, Beee-NO!, dado, vittoria…): solo allora può
// accelerare (animazioni veloci) o saltare. Chi è "in viaggio" lo dice chi li muove (`inViaggioValido`): la regia chiede, non duplica.
import type { Orologio } from '../orologio';
import { opzioni } from './opzioni';

export interface Regia {
  /** Eventi aperti adesso. */
  aperti: number;
  /** L'utente ha chiesto di saltare l'evento in corso. */
  salto: boolean;
  /** Agnellini che corrono o volano da un recinto all'altro (si ripulisce da solo con `inViaggioValido`). */
  inViaggio: Set<unknown>;
  /** Apre un evento; la funzione restituita lo chiude (una volta sola, anche se chiamata due volte). */
  apriEvento(nome: string): () => void;
  /** Tiene "in corso" un evento finché la funzione (anche asincrona) non ha finito. */
  conEvento<A extends unknown[], R>(nome: string, fn: (...a: A) => R): (...a: A) => R;
  eventoInCorso(): boolean;
  velocita(): 1 | 2 | 6;
  salta(): void;
}

export function creaRegia(c: { orologio: Orologio; meteoAttivo: () => boolean; inViaggioValido: (g: unknown) => boolean }): Regia {
  const regia: Regia = {
    aperti: 0,
    salto: false,
    inViaggio: new Set<unknown>(),
    apriEvento() {
      regia.aperti++;
      let chiuso = false;
      return () => {
        if (!chiuso) {
          chiuso = true;
          regia.aperti--;
        }
      };
    },
    conEvento(nome, fn) {
      return function (this: unknown, ...argomenti) {
        const chiudi = regia.apriEvento(nome);
        let r: ReturnType<typeof fn>;
        try {
          r = fn.apply(this, argomenti);
        } catch (e) {
          chiudi();
          throw e;
        }
        if (r && typeof (r as { then?: unknown }).then === 'function') {
          return (r as unknown as Promise<unknown>).finally(chiudi) as ReturnType<typeof fn>;
        }
        chiudi();
        return r;
      };
    },
    eventoInCorso() {
      // Chi non corre né vola più (preso in regia, tolto dalla scena) non è più in viaggio
      for (const g of regia.inViaggio) if (!c.inViaggioValido(g)) regia.inViaggio.delete(g);
      return regia.aperti > 0 || c.meteoAttivo() || c.orologio.eventiInSospeso() > 0 || regia.inViaggio.size > 0;
    },
    velocita() {
      if (!regia.eventoInCorso()) return 1;
      return regia.salto ? 6 : opzioni().veloci ? 2 : 1;
    },
    salta() {
      if (regia.eventoInCorso()) regia.salto = true;
    },
  };
  return regia;
}
