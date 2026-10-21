// Le domande dei momenti con la mano: carta del round, effetto, richieste, risposte (Beee-NO!), Belati di
// punteggio, Belato finale, salvataggio dal Guaio e consolazione. Sono tutte schermate `privata`.
// Regole prese da pannelli.tsx (PannelloScelta, PannelloEffetto, PannelloRichiesta, PannelloReazione, PannelloPunteggio,
// PannelloBelatoFinale, PannelloSalvataggio, PannelloConsolazione), spostate qui senza DOM.
// Regola anti-sbirciata: con `manoScoperta` falso nessuna carta della mano (né ciò che ne dipende: carte grandi
// pescate, Guai curabili) è toccabile e i gesti `carta` e `trascinata` non producono niente.
import type { Azione, IdCarta, IdGiocatore, Vista } from '../../../../engine/src';
import { avvisiDi, descriviVoce, nome, nomeCarta, valoreCarta } from '../../partita/descrizioni';
import { T } from '../../testi';
import { conMossa, filtra, pulsanteAttivo, senzaEsito, vuota } from './tavolo';
import type { Risultato } from './tavolo';
import type { Domanda, Gesto, Momento, PulsanteDomanda, Scelta } from './tipi';

const unici = <T>(x: T[]): T[] => [...new Set(x)];
const stessoInsieme = (a: IdCarta[], b: IdCarta[]) => a.length === b.length && a.every((x) => b.includes(x));
/** Le carte della scelta a metà che si possono ancora toccare adesso (la mano o le mosse possono essere cambiate). */
const valide = (s: Scelta, carte: IdCarta[]): IdCarta[] => s.carte.filter((c) => carte.includes(c));
/** Tocco su una carta, una alla volta: la abbassa se è sollevata, altrimenti la solleva; ogni mira in corso cade. */
const toccaUna = (s: Scelta, c: IdCarta): Scelta => ({ ...s, carte: s.carte.includes(c) ? [] : [c], carta: null });
const indietro = (s: Scelta): Risultato => ({ scelta: s, esito: { tipo: 'indietro' } });

const annulla = (): PulsanteDomanda => ({ id: 'annulla', testo: T.azioni.annulla, attivo: true, secondario: true });

function voceEffetto(v: Vista) {
  const f = v.fase;
  return f.nome === 'effetti' ? f.coda[f.indice] : undefined;
}

// ─── Carta del round e Belato finale ─────────────────────────────────────────

/** Le carte che si possono giocare, una opzione per volta (una carta, o una coppia di Gemelle). */
function opzioniScelta(m: Momento, finale: boolean): IdCarta[][] {
  return finale ? filtra(m.azioni, 'sceltaFinale').map((a) => [a.carta]) : filtra(m.azioni, 'scegliTrovata').map((a) => a.carte);
}

/** La mossa permessa che gioca esattamente queste carte (lo stesso oggetto del motore). */
function mossaScelta(m: Momento, finale: boolean, carte: IdCarta[]): Azione | undefined {
  if (finale) return filtra(m.azioni, 'sceltaFinale').find((a) => carte.length === 1 && a.carta === carte[0]);
  return filtra(m.azioni, 'scegliTrovata').find((a) => stessoInsieme(a.carte, carte));
}

/** Carta rilasciata sulla tovaglia: la coppia sollevata se ne fa parte, altrimenti lei sola; altrimenti niente. */
function mossaTrascinata(m: Momento, finale: boolean, sollevate: IdCarta[], c: IdCarta): Azione | undefined {
  if (sollevate.includes(c)) {
    const coppia = mossaScelta(m, finale, sollevate);
    if (coppia) return coppia;
  }
  return mossaScelta(m, finale, [c]);
}

function domandaScelta(m: Momento, chiave: string, s: Scelta, giocatore: IdGiocatore, finale: boolean): Domanda {
  const opzioni = opzioniScelta(m, finale);
  const carte = m.manoScoperta ? unici(opzioni.flat()) : [];
  const sollevate = valide(s, carte);
  const haGemelle = opzioni.some((o) => o.length === 2);
  const titolo = finale ? T.belatoFinale.titolo(nome(m.vista, giocatore)) : T.scelta.titolo(nome(m.vista, giocatore));
  const d = vuota(chiave, haGemelle ? T.scena.scelte.conDettaglio(titolo, T.scelta.gemelleInsieme) : titolo);
  d.avvisi = finale ? [] : avvisiDi(m.vista, giocatore);
  d.carte = carte;
  d.sollevate = sollevate;
  d.trascinabili = carte.filter((c) => mossaTrascinata(m, finale, sollevate, c) !== undefined);
  d.pulsanti = [
    {
      id: 'gioca',
      testo: T.scena.scelte.gioca(sollevate.reduce((t, c) => t + valoreCarta(c), 0)),
      attivo: mossaScelta(m, finale, sollevate) !== undefined,
      sottoLaCarta: true,
    },
  ];
  return d;
}

function avanzaScelta(m: Momento, s: Scelta, g: Gesto, d: Domanda, finale: boolean): Risultato {
  if (g.tipo === 'carta' && d.carte.includes(g.carta)) {
    const sol = d.sollevate;
    if (sol.includes(g.carta)) return senzaEsito({ ...s, carte: sol.filter((x) => x !== g.carta), carta: null });
    // con una carta sollevata, la sua gemella (se la coppia è permessa) si solleva insieme
    if (sol.length === 1 && opzioniScelta(m, finale).some((o) => stessoInsieme(o, [sol[0]!, g.carta]))) {
      return senzaEsito({ ...s, carte: [sol[0]!, g.carta], carta: null });
    }
    return senzaEsito({ ...s, carte: [g.carta], carta: null });
  }
  if (g.tipo === 'trascinata' && d.carte.includes(g.carta)) {
    const azione = mossaTrascinata(m, finale, d.sollevate, g.carta);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo === 'pulsante' && g.id === 'gioca' && pulsanteAttivo(d, 'gioca')) {
    const azione = mossaScelta(m, finale, d.sollevate);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  return senzaEsito(s);
}

// ─── Effetto della Trovata ───────────────────────────────────────────────────

/** Le mosse dell'effetto: quelle che lo attivano, quelle con un bersaglio (cioè se serve mirare) e la rinuncia. */
function mosseEffetto(m: Momento) {
  const attiva = filtra(m.azioni, 'attivaEffetto');
  const conBersaglio = attiva.filter((a) => a.bersaglio !== undefined);
  const rinuncia = filtra(m.azioni, 'rinunciaEffetto')[0];
  return { attiva, conBersaglio, rinuncia };
}

function domandaEffetto(m: Momento, chiave: string, s: Scelta, giocatore: IdGiocatore): Domanda {
  const voce = voceEffetto(m.vista);
  const { attiva, conBersaglio, rinuncia } = mosseEffetto(m);
  const mira = voce !== undefined && conBersaglio.length > 0 && s.carta === voce.carta;
  const titolo = voce ? T.effetti.titolo(nome(m.vista, giocatore), nomeCarta(voce.carta)) : T.fasi.effetti;
  const d = vuota(chiave, mira ? T.effetti.bersaglio : titolo);
  d.avvisi = [T.effetti.facoltativo];
  d.centro = voce?.carta ?? null;
  if (mira) d.pecore = unici(conBersaglio.map((a) => a.bersaglio!));
  d.pulsanti = [
    { id: 'attiva', testo: T.azioni.attiva, attivo: attiva.length > 0 && !mira },
    { id: 'rinuncia', testo: T.azioni.rinuncia, attivo: rinuncia !== undefined, secondario: true },
  ];
  if (mira) d.pulsanti.push(annulla());
  return d;
}

function avanzaEffetto(m: Momento, s: Scelta, g: Gesto, d: Domanda): Risultato {
  const { attiva, conBersaglio, rinuncia } = mosseEffetto(m);
  if (g.tipo === 'pecora' && d.pecore.includes(g.chi)) {
    const azione = attiva.find((a) => a.bersaglio === g.chi);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo !== 'pulsante' || !pulsanteAttivo(d, g.id)) return senzaEsito(s);
  if (g.id === 'attiva') {
    // un effetto con bersaglio accende le pecore e aspetta; gli altri partono subito
    if (conBersaglio.length > 0) return d.centro ? senzaEsito({ ...s, carta: d.centro }) : senzaEsito(s);
    return attiva[0] ? conMossa(s, attiva[0]) : senzaEsito(s);
  }
  if (g.id === 'rinuncia') {
    return rinuncia ? conMossa(s, rinuncia) : senzaEsito(s);
  }
  if (g.id === 'annulla') return senzaEsito({ ...s, carta: null });
  return senzaEsito(s);
}

// ─── Richieste (dopo l'effetto di una Trovata) ───────────────────────────────

function domandaRichiesta(m: Momento, chiave: string, s: Scelta): Domanda {
  const r = m.vista.richiesta;
  if (!r) return vuota(chiave, T.fasi[m.vista.fase.nome]);
  if (r.tipo === 'guarda_due') {
    const d = vuota(chiave, T.scena.scelte.conDettaglio(nomeCarta(r.carta), T.effetti.guardaDue));
    d.grandi = m.manoScoperta ? [...r.carte] : [];
    return d;
  }
  const multipla = r.tipo === 'scarta_fino_a_tre';
  const opzioni = filtra(m.azioni, 'completaEffetto');
  const carte = m.manoScoperta ? unici(opzioni.flatMap((a) => a.carte)) : [];
  const sollevate = valide(s, carte);
  const d = vuota(chiave, T.scena.scelte.conDettaglio(nomeCarta(r.carta), multipla ? T.effetti.scartaFinoATre : T.effetti.scartaESomma));
  // Le carte da scartare si toccano e basta: né `scarta_e_somma` né `scarta_fino_a_tre` hanno il trascinamento (voluto,
  // il gesto di scartare è il pulsante), quindi `trascinabili` resta vuota
  d.carte = carte;
  d.sollevate = sollevate;
  const attivo = opzioni.some((a) => stessoInsieme(a.carte, sollevate));
  if (multipla) {
    d.pulsanti = [
      sollevate.length === 0
        ? { id: 'nonScartare', testo: T.azioni.nonScartare, attivo }
        : { id: 'conferma', testo: T.scena.scelte.scarta(sollevate.length), attivo },
    ];
  } else {
    d.pulsanti = [{ id: 'conferma', testo: sollevate[0] ? `${T.azioni.scarta} ${nomeCarta(sollevate[0])}` : T.azioni.scarta, attivo }];
  }
  return d;
}

function avanzaRichiesta(m: Momento, s: Scelta, g: Gesto, d: Domanda): Risultato {
  const completa = filtra(m.azioni, 'completaEffetto');
  if (g.tipo === 'grande' && d.grandi.includes(g.carta)) {
    const azione = completa.find((a) => stessoInsieme(a.carte, [g.carta]));
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo === 'carta' && d.carte.includes(g.carta)) {
    const sol = d.sollevate;
    if (sol.includes(g.carta)) return senzaEsito({ ...s, carte: sol.filter((x) => x !== g.carta) });
    if (m.vista.richiesta?.tipo !== 'scarta_fino_a_tre') return senzaEsito({ ...s, carte: [g.carta] });
    // fino a tre carte: il quarto tocco non fa niente
    return sol.length < 3 ? senzaEsito({ ...s, carte: [...sol, g.carta] }) : senzaEsito(s);
  }
  if (g.tipo === 'pulsante' && (g.id === 'conferma' || g.id === 'nonScartare') && pulsanteAttivo(d, g.id)) {
    const azione = completa.find((a) => stessoInsieme(a.carte, d.sollevate));
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  return senzaEsito(s);
}

// ─── Risposta: Beee-NO! ──────────────────────────────────────────────────────

function domandaReazione(m: Momento, chiave: string, s: Scelta, giocatore: IdGiocatore): Domanda {
  const belati = filtra(m.azioni, 'giocaBelato');
  const passa = filtra(m.azioni, 'passa')[0];
  const carte = m.manoScoperta ? unici(belati.map((a) => a.carta)) : [];
  const sollevate = valide(s, carte);
  const cima = m.vista.pila[m.vista.pila.length - 1];
  const privato = T.reazione.privato(nome(m.vista, giocatore));
  const d = vuota(chiave, cima ? T.scena.scelte.conDettaglio(descriviVoce(m.vista, cima), privato) : privato);
  if (m.manoScoperta && belati.length === 0) d.avvisi = [T.reazione.nonHai];
  d.carte = carte;
  d.sollevate = sollevate;
  d.trascinabili = [...carte];
  d.pulsanti = [
    { id: 'gioca', testo: T.azioni.beeeNo, attivo: sollevate.length === 1, sottoLaCarta: true },
    { id: 'passo', testo: T.scena.scelte.passo, attivo: passa !== undefined, secondario: true },
  ];
  if (m.condiviso) d.pulsanti.push(annulla());
  return d;
}

function avanzaReazione(m: Momento, s: Scelta, g: Gesto, d: Domanda): Risultato {
  const belati = filtra(m.azioni, 'giocaBelato');
  if (g.tipo === 'carta' && d.carte.includes(g.carta)) return senzaEsito(toccaUna(s, g.carta));
  if (g.tipo === 'trascinata' && d.carte.includes(g.carta)) {
    const azione = belati.find((a) => a.carta === g.carta);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo !== 'pulsante' || !pulsanteAttivo(d, g.id)) return senzaEsito(s);
  if (g.id === 'gioca') {
    const azione = belati.find((a) => a.carta === d.sollevate[0]);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.id === 'passo') {
    const passa = filtra(m.azioni, 'passa')[0];
    return passa ? conMossa(s, passa) : senzaEsito(s);
  }
  if (g.id === 'annulla') return indietro(s);
  return senzaEsito(s);
}

// ─── Belati di punteggio e salvataggio dal Guaio ─────────────────────────────

/** Un Belato giocabile è "semplice" se ha una sola mossa e nessun bersaglio: parte da solo. */
function datiBelati(m: Momento, s: Scelta) {
  const belati = filtra(m.azioni, 'giocaBelato');
  const carte = m.manoScoperta ? unici(belati.map((a) => a.carta)) : [];
  const sollevate = valide(s, carte);
  const perCarta = (c: IdCarta) => belati.filter((a) => a.carta === c);
  const semplice = (c: IdCarta) => perCarta(c).length === 1 && perCarta(c)[0]!.bersaglio === undefined;
  const conBersagli = (c: IdCarta) => perCarta(c).some((a) => a.bersaglio !== undefined);
  const carta = sollevate[0] ?? null;
  const mira = carta !== null && s.carta === carta && conBersagli(carta);
  return { belati, carte, sollevate, perCarta, semplice, conBersagli, carta, mira };
}

function domandaBelati(m: Momento, chiave: string, s: Scelta, giocatore: IdGiocatore, salvataggio: boolean): Domanda {
  const { belati, carte, sollevate, perCarta, semplice, conBersagli, carta, mira } = datiBelati(m, s);
  const passa = filtra(m.azioni, 'passa')[0];
  const chi = nome(m.vista, giocatore);
  const scritta = salvataggio
    ? mira
      ? T.salvataggio.aChi
      : T.salvataggio.titolo(chi)
    : mira
      ? T.punteggio.suChi
      : T.punteggio.privato(chi);
  const d = vuota(chiave, scritta);
  if (salvataggio) d.avvisi = avvisiDi(m.vista, giocatore);
  else if (m.manoScoperta && belati.length === 0) d.avvisi = [T.punteggio.nonHai];
  if (salvataggio) d.centro = m.vista.datiRound.guaio;
  d.carte = carte;
  d.sollevate = sollevate;
  d.trascinabili = carte.filter(semplice);
  if (mira && carta) d.pecore = unici(perCarta(carta).flatMap((a) => (a.bersaglio !== undefined ? [a.bersaglio] : [])));
  d.pulsanti = [
    {
      id: 'gioca',
      testo: carta ? nomeCarta(carta) : T.scena.scelte.giocaCarta,
      attivo: carta !== null && !mira && (semplice(carta) || conBersagli(carta)),
      sottoLaCarta: true,
    },
    salvataggio
      ? { id: 'prendiGuaio', testo: T.azioni.prendiGuaio, attivo: passa !== undefined, secondario: true }
      : { id: 'passo', testo: T.scena.scelte.passo, attivo: passa !== undefined, secondario: true },
  ];
  // in mira "Annulla" spegne i bersagli; altrimenti, solo per i Belati di punteggio su un dispositivo condiviso, torna indietro
  if (mira || (!salvataggio && m.condiviso)) d.pulsanti.push(annulla());
  return d;
}

function avanzaBelati(m: Momento, s: Scelta, g: Gesto, d: Domanda, salvataggio: boolean): Risultato {
  const { belati, perCarta, semplice } = datiBelati(m, s);
  const inMira = d.pecore.length > 0;
  if (g.tipo === 'carta' && d.carte.includes(g.carta)) return senzaEsito(toccaUna(s, g.carta));
  if (g.tipo === 'trascinata' && d.trascinabili.includes(g.carta)) {
    const azione = perCarta(g.carta)[0];
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo === 'pecora' && d.pecore.includes(g.chi)) {
    const azione = belati.find((a) => a.carta === s.carta && a.bersaglio === g.chi);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo !== 'pulsante' || !pulsanteAttivo(d, g.id)) return senzaEsito(s);
  if (g.id === 'gioca') {
    const carta = d.sollevate[0];
    if (!carta) return senzaEsito(s);
    // senza bersaglio parte la mossa; con bersagli si accendono le pecore
    if (semplice(carta)) return conMossa(s, perCarta(carta)[0]!);
    return senzaEsito({ ...s, carta });
  }
  if (g.id === 'passo' || g.id === 'prendiGuaio') {
    const passa = filtra(m.azioni, 'passa')[0];
    return passa ? conMossa(s, passa) : senzaEsito(s);
  }
  if (g.id === 'annulla') {
    if (inMira) return senzaEsito({ ...s, carta: null });
    return !salvataggio && m.condiviso ? indietro(s) : senzaEsito(s);
  }
  return senzaEsito(s);
}

// ─── Consolazione ────────────────────────────────────────────────────────────

function datiConsolazione(m: Momento, s: Scelta) {
  const cure = filtra(m.azioni, 'giocaBelato').filter((a) => a.guaio !== undefined);
  const conclusioni = filtra(m.azioni, 'concludiConsolazione');
  const guai = m.manoScoperta ? unici(cure.map((a) => a.guaio!)) : [];
  // il Guaio scelto conta solo finché è ancora curabile
  const guaio = s.guaio !== null && guai.includes(s.guaio) ? s.guaio : null;
  const delGuaio = guaio ? cure.filter((a) => a.guaio === guaio) : [];
  // con una sola cura il Guaio scelto aspetta "Cura <Guaio>" (nessuna carta da toccare); con più cure si sceglie la carta
  const unicaCura = delGuaio.length === 1 ? delGuaio[0]! : null;
  const carte = !m.manoScoperta
    ? []
    : guaio
      ? unicaCura
        ? []
        : unici(delGuaio.map((a) => a.carta))
      : unici(conclusioni.flatMap((a) => (a.scarta !== null ? [a.scarta] : [])));
  return { cure, conclusioni, guai, guaio, unicaCura, carte, sollevate: valide(s, carte) };
}

function domandaConsolazione(m: Momento, chiave: string, s: Scelta, giocatore: IdGiocatore): Domanda {
  const { conclusioni, guai, guaio, unicaCura, carte, sollevate } = datiConsolazione(m, s);
  const titolo = T.consolazione.titolo(nome(m.vista, giocatore));
  const d = vuota(
    chiave,
    guaio
      ? T.scena.scelte.conDettaglio(titolo, nomeCarta(guaio))
      : guai.length > 0
        ? T.scena.scelte.conDettaglio(titolo, T.consolazione.cura)
        : titolo,
  );
  d.avvisi = avvisiDi(m.vista, giocatore);
  d.guai = guai;
  d.guaioScelto = guaio;
  d.carte = carte;
  d.sollevate = sollevate;
  if (guaio && unicaCura) {
    d.pulsanti = [{ id: 'conferma', testo: T.scena.scelte.cura(nomeCarta(guaio)), attivo: true }, annulla()];
  } else if (guaio) {
    d.trascinabili = [...carte];
    d.pulsanti = [
      { id: 'gioca', testo: sollevate[0] ? nomeCarta(sollevate[0]) : T.scena.scelte.giocaCarta, attivo: sollevate.length === 1, sottoLaCarta: true },
      annulla(),
    ];
  } else {
    const scarta = sollevate[0] ?? null;
    d.pulsanti = [
      {
        id: 'fatto',
        testo: scarta ? `${T.azioni.scarta} ${nomeCarta(scarta)}` : T.azioni.nonScartare,
        attivo: conclusioni.some((a) => a.scarta === scarta),
      },
    ];
  }
  return d;
}

function avanzaConsolazione(m: Momento, s: Scelta, g: Gesto, d: Domanda): Risultato {
  const { cure, conclusioni, guaio, unicaCura } = datiConsolazione(m, s);
  if (g.tipo === 'guaio' && d.guai.includes(g.carta)) {
    if (guaio === g.carta) return senzaEsito({ ...s, guaio: null, carte: [] });
    // il tocco sceglie sempre il Guaio: con una sola cura la mossa parte con "Cura", con più cure si sceglie anche la carta
    return senzaEsito({ ...s, guaio: g.carta, carte: [] });
  }
  if (g.tipo === 'carta' && d.carte.includes(g.carta)) return senzaEsito(toccaUna(s, g.carta));
  if (g.tipo === 'trascinata' && d.trascinabili.includes(g.carta)) {
    const azione = cure.find((a) => a.guaio === guaio && a.carta === g.carta);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.tipo !== 'pulsante' || !pulsanteAttivo(d, g.id)) return senzaEsito(s);
  if (g.id === 'conferma') return unicaCura ? conMossa(s, unicaCura) : senzaEsito(s);
  if (g.id === 'gioca') {
    const azione = cure.find((a) => a.guaio === guaio && a.carta === d.sollevate[0]);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.id === 'fatto') {
    const scarta = d.sollevate[0] ?? null;
    const azione = conclusioni.find((a) => a.scarta === scarta);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (g.id === 'annulla') return senzaEsito({ ...s, guaio: null, carte: [] });
  return senzaEsito(s);
}

// ─── Punto d'ingresso ────────────────────────────────────────────────────────

/** La domanda dei momenti con la mano; null per gli altri (le schermate non private). */
export function domandaCarte(m: Momento, chiave: string, s: Scelta): Domanda | null {
  const sc = m.schermo;
  if (sc.tipo !== 'privata') return null;
  switch (sc.pannello) {
    case 'scelta':
      return domandaScelta(m, chiave, s, sc.giocatore, false);
    case 'belato_finale':
      return domandaScelta(m, chiave, s, sc.giocatore, true);
    case 'effetto':
      return domandaEffetto(m, chiave, s, sc.giocatore);
    case 'richiesta':
      return domandaRichiesta(m, chiave, s);
    case 'reazione':
      return domandaReazione(m, chiave, s, sc.giocatore);
    case 'punteggio':
      return domandaBelati(m, chiave, s, sc.giocatore, false);
    case 'salvataggio':
      return domandaBelati(m, chiave, s, sc.giocatore, true);
    case 'consolazione':
      return domandaConsolazione(m, chiave, s, sc.giocatore);
  }
}

/** Il gesto sulla domanda `d` (già calcolata da `domandaCarte`): una mossa permessa, "indietro" o la scelta a metà. */
export function avanzaCarte(m: Momento, s: Scelta, g: Gesto, d: Domanda): Risultato {
  const sc = m.schermo;
  if (sc.tipo !== 'privata') return senzaEsito(s);
  switch (sc.pannello) {
    case 'scelta':
      return avanzaScelta(m, s, g, d, false);
    case 'belato_finale':
      return avanzaScelta(m, s, g, d, true);
    case 'effetto':
      return avanzaEffetto(m, s, g, d);
    case 'richiesta':
      return avanzaRichiesta(m, s, g, d);
    case 'reazione':
      return avanzaReazione(m, s, g, d);
    case 'punteggio':
      return avanzaBelati(m, s, g, d, false);
    case 'salvataggio':
      return avanzaBelati(m, s, g, d, true);
    case 'consolazione':
      return avanzaConsolazione(m, s, g, d);
  }
}
