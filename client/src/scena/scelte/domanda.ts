// La "domanda di adesso": dal momento della partita (schermo, mosse permesse) cosa si può toccare nella scena,
// e come un gesto diventa una mossa del motore. Parte pura: niente DOM, niente tempo, niente caso.
// I momenti senza mano stanno in tavolo.ts, quelli con la mano (schermate private) in carte.ts.
import { avanzaCarte, domandaCarte } from './carte';
import { avanzaTavolo, domandaTavolo } from './tavolo';
import type { Domanda, Esito, Gesto, Momento, Scelta } from './tipi';

/** Ciò che identifica la domanda: lo schermo, la fase e le mosse permesse. Stessa chiave = la scelta a metà si conserva. */
export function chiaveDi(m: Momento): string {
  const sc = m.schermo;
  const schermo =
    sc.tipo === 'privata' || sc.tipo === 'pubblica'
      ? [sc.tipo, sc.giocatore, sc.pannello]
      : sc.tipo === 'domanda'
        ? [sc.tipo, sc.contesto, sc.candidati, m.vista.finestra?.voce ?? null]
        : sc.tipo === 'automatica'
          ? [sc.tipo, sc.fase]
          : sc.tipo === 'attesaBot'
            ? [sc.tipo, sc.giocatore]
            : [sc.tipo];
  return JSON.stringify([schermo, m.vista.fase.nome, m.azioni, m.sistema]);
}

export function sceltaVuota(chiave: string): Scelta {
  return { chiave, carte: [], carta: null, furto: {}, guaio: null };
}

/** Null: niente da chiedere (attesa del bot, fine). */
export function domandaDi(m: Momento, s: Scelta): Domanda | null {
  const chiave = chiaveDi(m);
  return domandaTavolo(m, chiave, s) ?? domandaCarte(m, chiave, s);
}

export function avanza(m: Momento, s: Scelta, g: Gesto): { scelta: Scelta; esito: Esito | null } {
  const d = domandaDi(m, s);
  if (!d) return { scelta: s, esito: null };
  // Tocco sul prato: abbassa le carte sollevate e spegne la carta in attesa del bersaglio; senza niente da togliere è la stessa scelta
  if (g.tipo === 'prato') return { scelta: s.carte.length === 0 && s.carta === null ? s : { ...s, carte: [], carta: null }, esito: null };
  return m.schermo.tipo === 'privata' ? avanzaCarte(m, s, g, d) : avanzaTavolo(m, s, g, d);
}
