// Telefoni modesti (bozza scena.src.html, righe 436–452 e 1515–1516).
// Riposo: 20 s senza tocchi né eventi e lo sfondo si aggiorna 20 volte al secondo invece di 60.
// Modo leggero: se per 5 s di fila la scena va sotto i 30 fotogrammi al secondo, meno particelle e ombre più semplici.
// Non torna indietro durante la partita, così l'aspetto non cambia a scatti.
// Il tempo `ora` è quello del ciclo (millisecondi): lo dà ciclo.ts, qui non si legge nessun orologio.

export interface Risparmio {
  ultimoTocco: number;
  riposo: boolean;
  leggero: boolean;
  accumulo: number;
  finestra: { inizio: number; fotogrammi: number };
  secondiLenti: number;
  limiteParticelle(): number;
  misuraFluidita(ora: number, dtReale: number): void;
  /** Un tocco dell'utente (o l'avvio del ciclo): sveglia la scena. */
  tocco(ora: number): void;
  /** Aggiorna `riposo`: un evento in corso conta come attività. */
  valutaRiposo(ora: number, eventoInCorso: boolean): void;
}

export function creaRisparmio(scena: HTMLElement): Risparmio {
  const r: Risparmio = {
    ultimoTocco: 0,
    riposo: false,
    leggero: false,
    accumulo: 0,
    finestra: { inizio: 0, fotogrammi: 0 },
    secondiLenti: 0,
    limiteParticelle: () => (r.leggero ? 60 : 140),
    misuraFluidita(ora, dtReale) {
      const f = r.finestra;
      // A riposo, con la pagina nascosta o al ritorno da un'altra scheda (fotogramma lunghissimo) non si misura.
      // Il primo fotogramma apre la finestra invece di contare come un secondo intero.
      if (!f.inizio || r.leggero || r.riposo || document.hidden || dtReale > 0.25) {
        f.inizio = ora;
        f.fotogrammi = 0;
        return;
      }
      f.fotogrammi++;
      if (ora - f.inizio < 1000) return;
      r.secondiLenti = f.fotogrammi < 30 ? r.secondiLenti + 1 : 0;
      f.inizio = ora;
      f.fotogrammi = 0;
      if (r.secondiLenti >= 5) {
        r.leggero = true;
        scena.classList.add('leggero');
      }
    },
    tocco(ora) {
      r.ultimoTocco = ora;
      r.riposo = false;
    },
    valutaRiposo(ora, eventoInCorso) {
      if (eventoInCorso) r.ultimoTocco = ora;
      r.riposo = ora - r.ultimoTocco > 20000;
    },
  };
  return r;
}
