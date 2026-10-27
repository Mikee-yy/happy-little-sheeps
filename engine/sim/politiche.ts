// Giocatori simulati: "casuale" (sceglie a caso tra le azioni valide), "semplice" (buon senso, ispirato al bot
// descritto nel brief §5) e "normale" (il bot del gioco: "semplice" più attento ai Guai e ai Belati, D47).
import { angoloElimina, defCarta, punteggioTotale, tipiCheEliminano } from '../src';
import type { Azione, IdCarta, IdGiocatore, Stato, TipoGuaioCarta, VocePila } from '../src';

export type Casuale = () => number;

export interface Politica {
  nome: string;
  /** Propone un'azione; il simulatore la verifica e, se non è valida, ne sceglie una a caso tra quelle possibili. */
  scegli(s: Stato, g: IdGiocatore, azioni: Azione[], r: Casuale): Azione;
}

export const scegliACaso = <T>(lista: T[], r: Casuale): T => lista[Math.floor(r() * lista.length)] as T;

function scegliPesato<T>(lista: T[], peso: (x: T) => number, r: Casuale): T {
  const pesi = lista.map((x) => Math.max(0, peso(x)));
  let resto = r() * pesi.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lista.length; i++) {
    resto -= pesi[i] as number;
    if (resto < 0) return lista[i] as T;
  }
  return lista[lista.length - 1] as T;
}

export const casuale: Politica = {
  nome: 'casuale',
  scegli: (_s, _g, azioni, r) => scegliACaso(azioni, r),
};

// ─── Politica semplice ───────────────────────────────────────────────────────

const giocatore = (s: Stato, id: IdGiocatore) => s.giocatori.find((g) => g.id === id)!;
const effettoBelato = (c: IdCarta): string | null => {
  const d = defCarta(c);
  return d.famiglia === 'belato' ? d.effetto : null;
};
const valoreTrovata = (c: IdCarta): number | null => {
  const d = defCarta(c);
  return d.famiglia === 'trovata' ? d.valore : null;
};
const valoreBelato = (c: IdCarta): number => {
  const d = defCarta(c);
  return d.famiglia === 'belato' ? (d.valore ?? 0) : 0;
};
/** Quanto conviene tenere una carta: Trovate per valore, Beee-NO! molto, altri Belati abbastanza. */
const pregio = (c: IdCarta): number => valoreTrovata(c) ?? (effettoBelato(c) === 'beee_no' ? 9 : 6);
const tipiAngolo = (s: Stato, id: IdGiocatore): TipoGuaioCarta[] =>
  giocatore(s, id).angolo.map((c) => {
    const d = defCarta(c);
    return d.famiglia === 'guaio' ? d.tipo : 'tosatura';
  });
const tipoGuaio = (c: IdCarta): TipoGuaioCarta => {
  const d = defCarta(c);
  return d.famiglia === 'guaio' ? d.tipo : 'tosatura';
};
const cartaInMano = (s: Stato, g: IdGiocatore, effetto: string): IdCarta | undefined =>
  giocatore(s, g).mano.find((c) => effettoBelato(c) === effetto);
const avversariPerAgnellini = (s: Stato, g: IdGiocatore): IdGiocatore[] =>
  s.giocatori
    .filter((x) => x.id !== g && !x.eliminato)
    .sort((a, b) => b.agnellini - a.agnellini)
    .map((x) => x.id);
const totali = (s: Stato): Array<[IdGiocatore, number]> =>
  s.datiRound.partecipanti.map((id) => [id, punteggioTotale(s, id)]);
const passa = (g: IdGiocatore): Azione => ({ tipo: 'passa', giocatore: g });

/** La voce in cima alla pila danneggia g, o fa vincere un avversario? */
function voceDaFermare(s: Stato, g: IdGiocatore, v: VocePila): boolean {
  const d = v.dettagli;
  const posti = s.config.postiOvile;
  if (d.tipo === 'belato' && d.effetto === 'beee_no') {
    // Qualcuno annulla una mia voce: rispondo.
    const sotto = s.pila.find((x) => x.id === d.voceBersaglio);
    return sotto?.autore === g;
  }
  if (v.autore === g) return false;
  if (d.tipo === 'dado') {
    const autore = giocatore(s, v.autore);
    const dich = d.dichiarazione;
    if (dich.effetto === 'pascolo') return autore.agnellini + dich.quantita >= posti;
    if (dich.effetto === 'furto') {
      const totale = Object.values(dich.daAvversari).reduce((a, b) => a + b, 0) + dich.dalGregge;
      return (dich.daAvversari[g] ?? 0) > 0 || autore.agnellini + totale >= posti;
    }
    return dich.bersaglio === g;
  }
  if (d.tipo === 'effetto_trovata') {
    if (d.effetto === 'sposta_agnellino') return d.bersaglio === g;
    if (d.effetto === 'prendi_agnellino') return giocatore(s, v.autore).agnellini + 1 >= posti;
    return false;
  }
  if (d.effetto === 'modifica_punteggio') {
    return valoreBelato(d.carta) < 0 && d.bersaglio === g;
  }
  if (d.effetto === 'devia_guaio') return d.bersaglio === g;
  return false;
}

function belatoDiPunteggio(s: Stato, g: IdGiocatore): Azione | null {
  if (!s.datiRound.partecipanti.includes(g)) return null;
  const t = totali(s);
  const mio = punteggioTotale(s, g);
  const valori = t.map(([, v]) => v);
  const max = Math.max(...valori);
  const min = Math.min(...valori);
  const piuDue = giocatore(s, g).mano.find((c) => valoreBelato(c) > 0);
  const menoDue = giocatore(s, g).mano.find((c) => valoreBelato(c) < 0);
  const passo = s.datiRound.raddoppioBelati ? 4 : 2;
  const scambio = cartaInMano(s, g, 'scambia_punteggi');
  const unicoMin = mio === min && valori.filter((v) => v === min).length === 1;
  if (mio === min && max - min >= 4 && scambio) return { tipo: 'giocaBelato', giocatore: g, carta: scambio };
  if (mio === min && piuDue) {
    // +2 serve solo se mi toglie dal fondo.
    const secondo = Math.min(...valori.filter((v) => v > min), Infinity);
    if (unicoMin && secondo !== Infinity && mio + passo > secondo) {
      return { tipo: 'giocaBelato', giocatore: g, carta: piuDue, bersaglio: g };
    }
  }
  if (mio === min && menoDue && unicoMin) {
    // Spingo giù il penultimo sotto di me.
    const penultimo = t.filter(([, v]) => v > min).sort((a, b) => a[1] - b[1])[0];
    if (penultimo && penultimo[1] - passo < mio) {
      return { tipo: 'giocaBelato', giocatore: g, carta: menoDue, bersaglio: penultimo[0] };
    }
  }
  if (mio < max && mio >= max - 2 && menoDue) {
    const capo = t.filter(([, v]) => v === max);
    if (capo.length === 1) return { tipo: 'giocaBelato', giocatore: g, carta: menoDue, bersaglio: capo[0]![0] };
  }
  return null;
}

export const semplice: Politica = {
  nome: 'semplice',
  scegli(s, g, azioni, r) {
    const io = giocatore(s, g);

    // Finestra di reazione: Beee-NO! solo quando serve.
    const cima = s.pila[s.pila.length - 1];
    if (s.finestra && cima) {
      const no = azioni.find((a) => a.tipo === 'giocaBelato');
      return no && voceDaFermare(s, g, cima) ? no : passa(g);
    }

    // Richieste private.
    const ric = s.richiesta;
    if (ric) {
      if (ric.tipo === 'scarta_e_somma') {
        const migliore = io.mano.filter((c) => valoreTrovata(c) !== null).sort((a, b) => pregio(b) - pregio(a))[0]!;
        return { tipo: 'completaEffetto', giocatore: g, carte: [migliore] };
      }
      if (ric.tipo === 'guarda_due') {
        const tenuta = [...ric.carte].sort((a, b) => pregio(b) - pregio(a))[0]!;
        return { tipo: 'completaEffetto', giocatore: g, carte: [tenuta] };
      }
      const deboli = io.mano.filter((c) => pregio(c) <= 3).sort((a, b) => pregio(a) - pregio(b)).slice(0, 3);
      return { tipo: 'completaEffetto', giocatore: g, carte: deboli };
    }

    const f = s.fase;
    switch (f.nome) {
      case 'scelta': {
        const scelte = azioni.filter((a) => a.tipo === 'scegliTrovata');
        return scegliPesato(scelte, (a) => (a.tipo === 'scegliTrovata' ? a.carte.reduce((t, c) => t + (valoreTrovata(c) ?? 0), 0) + 1 : 0), r);
      }
      case 'effetti': {
        const voce = f.coda[f.indice]!;
        const rinuncia: Azione = { tipo: 'rinunciaEffetto', giocatore: g, carta: voce.carta };
        if (voce.effetto === 'scambia_punteggi') {
          const t = totali(s).map(([, v]) => v);
          return punteggioTotale(s, g) === Math.min(...t) ? { tipo: 'attivaEffetto', giocatore: g, carta: voce.carta } : rinuncia;
        }
        if (voce.effetto === 'sposta_agnellino') {
          const bersaglio = avversariPerAgnellini(s, g).find((id) => giocatore(s, id).agnellini > 0);
          return bersaglio ? { tipo: 'attivaEffetto', giocatore: g, carta: voce.carta, bersaglio } : rinuncia;
        }
        return { tipo: 'attivaEffetto', giocatore: g, carta: voce.carta };
      }
      case 'belati_punteggio':
        return belatoDiPunteggio(s, g) ?? passa(g);
      case 'risoluzione_dado': {
        if (f.passo !== 'dichiarazione') break;
        if (f.faccia.startsWith('furto')) {
          const dich = azioni.filter((a) => a.tipo === 'dichiaraDado');
          // Ruba a chi ha più agnellini: tra le ripartizioni valide, la più sbilanciata verso i più ricchi.
          const ordine = avversariPerAgnellini(s, g);
          const punteggio = (a: Azione) =>
            a.tipo === 'dichiaraDado' && a.furto
              ? Object.entries(a.furto).reduce((t, [id, q]) => t + q * (ordine.length - ordine.indexOf(id)), 0)
              : 0;
          return dich.sort((a, b) => punteggio(b) - punteggio(a))[0] ?? azioni[0]!;
        }
        const bersaglio = avversariPerAgnellini(s, g).find((id) => giocatore(s, id).agnellini > 0);
        return { tipo: 'dichiaraDado', giocatore: g, bersaglio: bersaglio! };
      }
      case 'belato_finale': {
        const migliore = io.mano.filter((c) => valoreTrovata(c) !== null).sort((a, b) => pregio(b) - pregio(a))[0]!;
        return { tipo: 'sceltaFinale', giocatore: g, carta: migliore };
      }
      case 'belati_salvataggio': {
        const guaio = s.datiRound.guaio;
        if (!guaio) break;
        const rischio = angoloElimina([...tipiAngolo(s, g), tipoGuaio(guaio)], s.config.regoleEliminazione);
        if (!rischio) return passa(g);
        const inFondo = cartaInMano(s, g, 'guaio_in_fondo');
        if (inFondo) return { tipo: 'giocaBelato', giocatore: g, carta: inFondo };
        const devia = cartaInMano(s, g, 'devia_guaio');
        const vittima = s.datiRound.partecipanti
          .filter((id) => id !== g && !giocatore(s, id).eliminato)
          .sort((a, b) => giocatore(s, b).agnellini - giocatore(s, a).agnellini)[0];
        if (devia && vittima) return { tipo: 'giocaBelato', giocatore: g, carta: devia, bersaglio: vittima };
        return passa(g);
      }
      case 'consolazione': {
        const cura = cartaInMano(s, g, 'cura');
        if (cura && angoloElimina(tipiAngolo(s, g), s.config.regoleEliminazione)) {
          const salva = io.angolo.find((c) => {
            const resto = io.angolo.filter((x) => x !== c).map(tipoGuaio);
            return !angoloElimina(resto, s.config.regoleEliminazione);
          });
          if (salva) return { tipo: 'giocaBelato', giocatore: g, carta: cura, guaio: salva };
        }
        const peggiore = [...io.mano].sort((a, b) => pregio(a) - pregio(b))[0];
        return { tipo: 'concludiConsolazione', giocatore: g, scarta: peggiore && pregio(peggiore) <= 2 ? peggiore : null };
      }
      default:
        break;
    }
    return scegliACaso(azioni, r);
  },
};

// ─── Politica normale (il bot del gioco, D47) ────────────────────────────────
// Come "semplice", con qualche attenzione in più. Usa solo ciò che un giocatore vede: la propria mano e il tavolo.

/**
 * Peso delle Trovate nella scelta: (valore + 1)^2, più deciso del (valore + 1) di "semplice" ma non sempre la più alta.
 * Con 3 o 4 il bot vince poco di più ma a 4 giocatori le partite finiscono troppo spesso col mazzo (oltre il 70%).
 */
const ESPONENTE_SCELTA = 2;
/** A due giocatori, un pascolo o un furto da almeno tanti agnellini che porta l'avversario davanti merita un Beee-NO!. */
const DADO_GRANDE = 3;
/** Quanti tipi di Guaio eliminerebbero g, con questo Angolo. */
const esposizione = (angolo: IdCarta[], regole: Stato['config']['regoleEliminazione']): number =>
  (['meteo', 'predatori', 'drammi', 'tosatura'] as const).filter((t) => angoloElimina([...angolo.map(tipoGuaio), t], regole)).length;
/** Il Guaio del round eliminerebbe g? */
const guaioCheElimina = (s: Stato, g: IdGiocatore): boolean => {
  const c = s.datiRound.guaio;
  return c !== null && tipiCheEliminano(s, g).includes(tipoGuaio(c));
};
const quanteInMano = (s: Stato, g: IdGiocatore, effetto: string): number =>
  giocatore(s, g).mano.filter((c) => effettoBelato(c) === effetto).length;
const valoreScelta = (a: Azione): number =>
  a.tipo === 'scegliTrovata' ? a.carte.reduce((t, c) => t + (valoreTrovata(c) ?? 0), 0) : 0;

/** Una mia voce che vale la pena difendere da un Beee-NO!: il dado e i Belati che salvano. */
function voceMiaDaDifendere(v: VocePila): boolean {
  const d = v.dettagli;
  if (d.tipo === 'dado') return true;
  return d.tipo === 'belato' && (d.effetto === 'guaio_in_fondo' || d.effetto === 'devia_guaio' || d.effetto === 'cura');
}

/** Il Beee-NO! si tiene per i momenti che contano; con due in mano si è un po' più larghi. */
function voceDaFermareNormale(s: Stato, g: IdGiocatore, v: VocePila): boolean {
  const d = v.dettagli;
  const posti = s.config.postiOvile;
  const largo = quanteInMano(s, g, 'beee_no') >= 2;
  if (d.tipo === 'belato' && d.effetto === 'beee_no') {
    const sotto = s.pila.find((x) => x.id === d.voceBersaglio);
    return !!sotto && sotto.autore === g && voceMiaDaDifendere(sotto);
  }
  if (v.autore === g) return false;
  if (d.tipo === 'dado') {
    const autore = giocatore(s, v.autore);
    const dich = d.dichiarazione;
    // A due è una corsa: un pascolo o un furto grande che porta l'avversario davanti a me si ferma. Con più giocatori
    // no: il Beee-NO! speso aiuterebbe anche gli altri (e a 4 le partite finirebbero troppo spesso col mazzo).
    const inGioco = s.giocatori.filter((x) => !x.eliminato).length;
    const davanti = (q: number) => inGioco === 2 && q >= DADO_GRANDE && autore.agnellini + q > giocatore(s, g).agnellini;
    if (dich.effetto === 'pascolo') return autore.agnellini + dich.quantita >= posti || davanti(dich.quantita);
    if (dich.effetto === 'furto') {
      const totale = Object.values(dich.daAvversari).reduce((a, b) => a + b, 0) + dich.dalGregge;
      const daMe = dich.daAvversari[g] ?? 0;
      return autore.agnellini + totale >= posti || daMe >= 2 || (daMe > 0 && largo) || davanti(totale);
    }
    return dich.bersaglio === g && (giocatore(s, g).agnellini >= 2 || largo);
  }
  if (d.tipo === 'effetto_trovata') {
    if (d.effetto === 'prendi_agnellino') return giocatore(s, v.autore).agnellini + 1 >= posti;
    if (d.effetto === 'sposta_agnellino') return d.bersaglio === g && largo;
    return false;
  }
  if (d.effetto === 'devia_guaio') return d.bersaglio === g && (guaioCheElimina(s, g) || largo);
  if (d.effetto === 'modifica_punteggio' && valoreBelato(d.carta) < 0 && d.bersaglio === g && s.datiRound.guaio) {
    // Il −2 mi manderebbe in fondo da solo?
    const passo = s.datiRound.raddoppioBelati ? 4 : 2;
    const dopo = punteggioTotale(s, g) - passo;
    return totali(s).every(([id, t]) => id === g || t > dopo);
  }
  return false;
}

/** Belati di punteggio: prima non restare in fondo quando c'è un Guaio, poi salire da soli in cima per il dado. */
function belatoDiPunteggioNormale(s: Stato, g: IdGiocatore): Azione | null {
  const mano = giocatore(s, g).mano;
  const piuDue = mano.find((c) => valoreBelato(c) > 0);
  const menoDue = mano.find((c) => valoreBelato(c) < 0);
  const scambio = cartaInMano(s, g, 'scambia_punteggi');
  const passo = s.datiRound.raddoppioBelati ? 4 : 2;
  const t = totali(s);
  const gioca = (carta: IdCarta, bersaglio?: IdGiocatore): Azione =>
    bersaglio === undefined ? { tipo: 'giocaBelato', giocatore: g, carta } : { tipo: 'giocaBelato', giocatore: g, carta, bersaglio };

  if (s.datiRound.partecipanti.includes(g)) {
    const mio = punteggioTotale(s, g);
    const altri = t.filter(([id]) => id !== g);
    const minAltri = Math.min(...altri.map(([, v]) => v));
    const maxAltri = Math.max(...altri.map(([, v]) => v));
    if (s.datiRound.guaio && mio <= minAltri) {
      // Sono in fondo (da solo o a pari): mi aspetta il Guaio, o il Belato Finale.
      if (scambio && maxAltri - mio >= 4) return gioca(scambio);
      if (piuDue && mio + passo > minAltri) return gioca(piuDue, g);
      // −2 a chi mi sta appena sopra (o a pari), se così resta in fondo da solo: tra questi, chi ha più agnellini.
      const sopra = altri.filter(([, v]) => v - passo < mio).map(([id]) => id);
      if (menoDue && sopra.length > 0 && altri.filter(([, v]) => v === minAltri).length === 1) {
        const bersaglio = avversariPerAgnellini(s, g).find((id) => sopra.includes(id));
        if (bersaglio) return gioca(menoDue, bersaglio);
      }
      return null;
    }
    // Non sono in fondo: salgo da solo in cima per lanciare il dado, o abbasso chi c'è.
    if (piuDue && mio <= maxAltri && mio + passo > maxAltri) return gioca(piuDue, g);
    const capi = altri.filter(([, v]) => v === maxAltri);
    if (menoDue && capi.length === 1 && mio < maxAltri && maxAltri - passo <= mio) return gioca(menoDue, capi[0]![0]);
    return null;
  }

  // Fuori dal round: −2 al primo in classifica se è anche chi ha più agnellini e così perde il dado da solo.
  const ordinati = [...t].sort((a, b) => b[1] - a[1]);
  const [primo, secondo] = ordinati;
  if (menoDue && primo && secondo && primo[1] > secondo[1] && primo[0] === avversariPerAgnellini(s, g)[0] && primo[1] - passo <= secondo[1]) {
    return gioca(menoDue, primo[0]);
  }
  return null;
}

export const normale: Politica = {
  nome: 'normale',
  scegli(s, g, azioni, r) {
    const io = giocatore(s, g);

    const cima = s.pila[s.pila.length - 1];
    if (s.finestra && cima) {
      const no = azioni.find((a) => a.tipo === 'giocaBelato');
      return no && voceDaFermareNormale(s, g, cima) ? no : passa(g);
    }
    if (s.richiesta) return semplice.scegli(s, g, azioni, r);

    const f = s.fase;
    switch (f.nome) {
      case 'scelta': {
        // Con un Guaio che mi eliminerebbe gioco la Trovata (o le Gemelle) più alta; altrimenti scelta pesata sul valore.
        const scelte = azioni.filter((a) => a.tipo === 'scegliTrovata');
        if (!guaioCheElimina(s, g)) return scegliPesato(scelte, (a) => (valoreScelta(a) + 1) ** ESPONENTE_SCELTA, r);
        const massimo = Math.max(...scelte.map(valoreScelta));
        return scegliACaso(scelte.filter((a) => valoreScelta(a) === massimo), r);
      }
      case 'belati_punteggio':
        return belatoDiPunteggioNormale(s, g) ?? passa(g);
      case 'belati_salvataggio': {
        if (!guaioCheElimina(s, g)) return passa(g);
        // Prima la Finta svenuta verso chi ha più agnellini, poi Faccio finta di niente.
        const devia = cartaInMano(s, g, 'devia_guaio');
        const vittima = avversariPerAgnellini(s, g).find((id) => s.datiRound.partecipanti.includes(id));
        if (devia && vittima) return { tipo: 'giocaBelato', giocatore: g, carta: devia, bersaglio: vittima };
        const inFondo = cartaInMano(s, g, 'guaio_in_fondo');
        if (inFondo) return { tipo: 'giocaBelato', giocatore: g, carta: inFondo };
        return passa(g);
      }
      case 'consolazione': {
        // Garzina: per forza se il Guaio mi elimina; anche prima, se l'Angolo è già molto esposto.
        const cura = cartaInMano(s, g, 'cura');
        const regole = s.config.regoleEliminazione;
        if (!cura || io.angolo.length === 0) break;
        if (angoloElimina(tipiAngolo(s, g), regole) || esposizione(io.angolo, regole) >= 3) {
          const migliore = io.angolo
            .map((c) => ({ c, resto: io.angolo.filter((x) => x !== c) }))
            .filter(({ resto }) => !angoloElimina(resto.map(tipoGuaio), regole))
            .sort((a, b) => esposizione(a.resto, regole) - esposizione(b.resto, regole))[0];
          if (migliore) return { tipo: 'giocaBelato', giocatore: g, carta: cura, guaio: migliore.c };
        }
        break;
      }
      default:
        break;
    }
    return semplice.scegli(s, g, azioni, r);
  },
};

export const POLITICHE: Record<string, Politica> = { casuale, semplice, normale };
