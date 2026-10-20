// Le domande dei momenti senza mano: fasi automatiche, "Chi risponde?", dado, furto e Testata.
// Regole prese da pannelli.tsx (PannelloAutomatico, PannelloDomanda, PannelloLancio, PannelloDichiarazione).
// In queste domande la mano non è mai toccabile: carte, sollevate, trascinabili, guai e grandi restano vuote.
import type { Azione, IdGiocatore, NomeFase } from '../../../../engine/src';
import { descriviVoce, nome, nomi } from '../../partita/descrizioni';
import { T } from '../../testi';
import type { Domanda, Esito, Gesto, IdPulsante, Momento, Scelta } from './tipi';

export type Di<K extends Azione['tipo']> = Extract<Azione, { tipo: K }>;
export const filtra = <K extends Azione['tipo']>(azioni: Azione[], tipo: K) => azioni.filter((a): a is Di<K> => a.tipo === tipo);

export type Risultato = { scelta: Scelta; esito: Esito | null };

const somma = (q: Partial<Record<IdGiocatore, number>>): number => Object.values(q).reduce<number>((t, x) => t + (x ?? 0), 0);

/** Una domanda senza niente di toccabile: la base su cui ogni momento accende ciò che serve. */
export function vuota(chiave: string, scritta: string): Domanda {
  return {
    chiave,
    scritta,
    avvisi: [],
    carte: [],
    sollevate: [],
    trascinabili: [],
    pecore: [],
    dado: false,
    guai: [],
    guaioScelto: null,
    grandi: [],
    centro: null,
    furto: null,
    pulsanti: [],
    testata: false,
  };
}

export const senzaEsito = (scelta: Scelta): Risultato => ({ scelta, esito: null });
export const conMossa = (scelta: Scelta, azione: Azione): Risultato => ({ scelta, esito: { tipo: 'mossa', azione } });
export const pulsanteAttivo = (d: Domanda, id: IdPulsante): boolean => d.pulsanti.some((p) => p.id === id && p.attivo);

// ─── Fasi automatiche ────────────────────────────────────────────────────────

/** La mossa del pulsante "Continua": il prosegui del sistema (dove il sistema aspetta solo la scadenza, quella). */
function proseguiDi(m: Momento): Azione | undefined {
  return m.sistema.find((a) => a.tipo === 'prosegui') ?? m.sistema.find((a) => a.tipo === 'scadenza');
}

/** Titolo del pannello della fase; per il Guaio al peggiore il suo messaggio (chi lo prende). Gli aiuti diventano avvisi. */
function testiAutomatica(m: Momento, fase: NomeFase): { scritta: string; avvisi: string[] } {
  const v = m.vista;
  const f = v.fase;
  if (fase === 'guaio_al_peggiore' && f.nome === 'guaio_al_peggiore') {
    const scritta = f.destinatario
      ? T.guai.prende(nome(v, f.destinatario))
      : f.spareggio
        ? T.guai.spareggio(nomi(v, f.spareggio))
        : v.datiRound.partecipanti.length >= 2 && v.datiRound.piuAlti.length === 0
          ? T.guai.tuttiPari
          : T.guai.inFondo;
    return { scritta, avvisi: [] };
  }
  if (fase === 'fine_round') return { scritta: T.fineRound.titolo, avvisi: [T.fineRound.aiuto] };
  if (fase === 'ultimo_round') return { scritta: T.ultimoRound.titolo, avvisi: [T.ultimoRound.aiuto] };
  return { scritta: T.fasi[fase], avvisi: [] };
}

/** Nessuna carta al centro, nemmeno nella fase del Guaio (decisione: il Guaio del round lo racconta la scena). */
function automatica(m: Momento, chiave: string, fase: NomeFase): Domanda {
  const { scritta, avvisi } = testiAutomatica(m, fase);
  const d = vuota(chiave, scritta);
  d.avvisi = avvisi;
  d.pulsanti = [{ id: 'continua', testo: T.azioni.continua, attivo: proseguiDi(m) !== undefined }];
  return d;
}

// ─── "Chi risponde?" ─────────────────────────────────────────────────────────

function chiRisponde(m: Momento, chiave: string, contesto: 'reazione' | 'punteggio', candidati: IdGiocatore[]): Domanda {
  const cima = m.vista.pila[m.vista.pila.length - 1];
  const domanda = contesto === 'reazione' ? T.scena.scelte.chiRisponde : T.scena.scelte.chiPunteggio;
  const d = vuota(chiave, cima ? `${descriviVoce(m.vista, cima)} · ${domanda}` : domanda);
  d.pecore = [...candidati];
  d.pulsanti = [{ id: 'nessuno', testo: T.azioni.nessuno, attivo: m.sistema.some((a) => a.tipo === 'scadenza') }];
  return d;
}

// ─── Furto ───────────────────────────────────────────────────────────────────

interface DatiFurto {
  /** Le divisioni permesse dal motore (stessi oggetti di `azioni`). */
  furti: Array<Di<'dichiaraDado'>>;
  avversari: IdGiocatore[];
  /** Quanti agnellini in tutto si prendono dagli avversari. */
  totale: number;
  massimo: (id: IdGiocatore) => number;
}

function datiFurto(m: Momento): DatiFurto | null {
  const furti = filtra(m.azioni, 'dichiaraDado').filter((a) => a.furto);
  if (furti.length === 0) return null;
  const avversari = [...new Set(furti.flatMap((a) => Object.keys(a.furto ?? {})))];
  return {
    furti,
    avversari,
    totale: somma(furti[0]!.furto!),
    massimo: (id) => Math.max(...furti.map((a) => a.furto![id] ?? 0)),
  };
}

/** La mossa permessa che divide il furto esattamente come i presi, se c'è. */
function furtoScelto(f: DatiFurto, presi: Partial<Record<IdGiocatore, number>>): Di<'dichiaraDado'> | undefined {
  return f.furti.find((a) => f.avversari.every((id) => (a.furto![id] ?? 0) === (presi[id] ?? 0)));
}

function furto(chiave: string, s: Scelta, f: DatiFurto): Domanda {
  const d = vuota(chiave, T.scena.scelte.rubaAncora(f.totale - somma(s.furto)));
  d.pecore = f.avversari.filter((id) => f.massimo(id) > 0);
  d.furto = { presi: { ...s.furto } };
  d.pulsanti = [
    { id: 'conferma', testo: T.azioni.conferma, attivo: furtoScelto(f, s.furto) !== undefined },
    { id: 'annulla', testo: T.azioni.annulla, attivo: somma(s.furto) > 0, secondario: true },
  ];
  return d;
}

function avanzaFurto(s: Scelta, g: Gesto, d: Domanda, f: DatiFurto): Risultato {
  if (g.tipo === 'pecora') {
    const preso = s.furto[g.chi] ?? 0;
    if (!d.pecore.includes(g.chi) || preso >= f.massimo(g.chi) || somma(s.furto) >= f.totale) return senzaEsito(s);
    return senzaEsito({ ...s, furto: { ...s.furto, [g.chi]: preso + 1 } });
  }
  if (g.tipo === 'agnellino') {
    const preso = s.furto[g.chi] ?? 0;
    if (preso <= 0) return senzaEsito(s);
    const resto = { ...s.furto };
    if (preso > 1) resto[g.chi] = preso - 1;
    else delete resto[g.chi];
    return senzaEsito({ ...s, furto: resto });
  }
  if (g.tipo === 'pulsante' && pulsanteAttivo(d, g.id)) {
    if (g.id === 'annulla') return senzaEsito({ ...s, furto: {} });
    if (g.id === 'conferma') {
      const azione = furtoScelto(f, s.furto);
      if (azione) return conMossa(s, azione);
    }
  }
  return senzaEsito(s);
}

// ─── Dado e Testata ──────────────────────────────────────────────────────────

function lancio(m: Momento, chiave: string, giocatore: IdGiocatore): Domanda {
  const d = vuota(chiave, T.dado.tocca(nome(m.vista, giocatore)));
  if (m.vista.datiRound.lanciatori.length > 1) d.avvisi = [T.dado.pari];
  d.dado = filtra(m.azioni, 'lanciaDado').length > 0;
  return d;
}

function testataBersaglio(m: Momento, chiave: string): Domanda {
  const d = vuota(chiave, T.dado.testataTitolo);
  d.pecore = [...new Set(filtra(m.azioni, 'dichiaraDado').flatMap((a) => (a.bersaglio !== undefined ? [a.bersaglio] : [])))];
  return d;
}

/** Il riquadro di mira: la mossa la manda Testata.tsx, nella scena non c'è niente da toccare. */
function testataMira(chiave: string): Domanda {
  const d = vuota(chiave, T.testata.titolo);
  d.testata = true;
  return d;
}

// ─── Punto d'ingresso ────────────────────────────────────────────────────────

/** La domanda dei momenti senza mano; null per gli altri (attesa del bot, fine, schermate private). */
export function domandaTavolo(m: Momento, chiave: string, s: Scelta): Domanda | null {
  const sc = m.schermo;
  switch (sc.tipo) {
    case 'automatica':
      return automatica(m, chiave, sc.fase);
    case 'domanda':
      return chiRisponde(m, chiave, sc.contesto, sc.candidati);
    case 'pubblica': {
      if (sc.pannello === 'lancio') return lancio(m, chiave, sc.giocatore);
      if (sc.pannello === 'testata') return testataMira(chiave);
      const f = datiFurto(m);
      return f ? furto(chiave, s, f) : testataBersaglio(m, chiave);
    }
    default:
      return null;
  }
}

/** Il gesto sulla domanda `d` (già calcolata da `domandaTavolo`): una mossa permessa, una risposta o la scelta a metà. */
export function avanzaTavolo(m: Momento, s: Scelta, g: Gesto, d: Domanda): Risultato {
  const sc = m.schermo;
  if (sc.tipo === 'automatica') {
    if (g.tipo !== 'pulsante' || g.id !== 'continua' || !pulsanteAttivo(d, 'continua')) return senzaEsito(s);
    const azione = proseguiDi(m);
    return azione ? conMossa(s, azione) : senzaEsito(s);
  }
  if (sc.tipo === 'domanda') {
    if (g.tipo === 'pecora' && d.pecore.includes(g.chi)) return { scelta: s, esito: { tipo: 'risponde', chi: g.chi } };
    if (g.tipo === 'pulsante' && g.id === 'nessuno' && pulsanteAttivo(d, 'nessuno')) {
      const scadenza = m.sistema.find((a) => a.tipo === 'scadenza');
      return scadenza ? conMossa(s, scadenza) : senzaEsito(s);
    }
    return senzaEsito(s);
  }
  if (sc.tipo === 'pubblica') {
    if (sc.pannello === 'lancio') {
      const lancia = filtra(m.azioni, 'lanciaDado')[0];
      return g.tipo === 'dado' && d.dado && lancia ? conMossa(s, lancia) : senzaEsito(s);
    }
    if (sc.pannello === 'dichiarazione') {
      const f = datiFurto(m);
      if (f) return avanzaFurto(s, g, d, f);
      if (g.tipo !== 'pecora' || !d.pecore.includes(g.chi)) return senzaEsito(s);
      const azione = filtra(m.azioni, 'dichiaraDado').find((a) => a.bersaglio === g.chi);
      return azione ? conMossa(s, azione) : senzaEsito(s);
    }
  }
  return senzaEsito(s);
}
