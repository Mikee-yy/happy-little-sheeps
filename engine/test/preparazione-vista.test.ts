// Dati del catalogo, preparazione della partita, viste per giocatore e API pubblica del motore.
// Regole: brief sezione 3 ("Preparazione", "Variante a 2 giocatori") e sezione 4 ("Carte");
// specifica docs/motore.md sezioni 1–3, 10, 11, 13, 14 e decisioni D5, D9, D15, D24, D26, D33, D34, D36, D37, D40.
import { describe, expect, it } from 'vitest';
import {
  applica,
  azioniPossibili,
  CATALOGO,
  configPer,
  creaMazzoGuai,
  creaMazzoPrincipale,
  defCarta,
  eFaseAutomatica,
  ErroreRegola,
  inAttesaDi,
  nuovaPartita,
  postiLiberi,
  punteggioTotale,
  tentaApplica,
  tipoDi,
  vistaPer,
} from '../src';
import type {
  Attesa,
  Azione,
  DefBelato,
  DefGuaio,
  DefTrovata,
  EffettoTrovata,
  Evento,
  Fase,
  GruppoEffetto,
  IdCarta,
  IdGiocatore,
  IdPecora,
  IdTipoCarta,
  NomeFase,
  RegolaEliminazione,
  Stato,
  StatoGiocatore,
  Vista,
  VistaFase,
  VistaGiocatore,
  VoceEffetto,
} from '../src';
import { avanza, carta, chiudiPunteggio, conFaccia, nessunaReazione, prosegui, scegli, scenario } from './aiuti';
import type { OpzioniScenario } from './aiuti';
import carteJson from '../data/cards.json';
import setupJson from '../data/setup.json';

// ─── Aiuti locali ────────────────────────────────────────────────────────────

type Chi = IdGiocatore | 'sistema';
type FaseDi<N extends NomeFase> = Extract<Fase, { nome: N }>;
type VistaFaseDi<N extends VistaFase['nome']> = Extract<VistaFase, { nome: N }>;
type EventoPescate = Extract<Evento, { tipo: 'pescate' }>;
type Mani = Record<IdGiocatore, IdTipoCarta[]>;

/** La Tosatura non attiva tratti (brief §2): con questo Guaio non ci sono righe 'tratto'. */
const GUAIO_NEUTRO = 'tosatura-a-sorpresa';

const ordinati = (xs: readonly string[]): string[] => [...xs].sort();
const tipoLocale = (c: string): string => c.split('#')[0] ?? c;
const ids = (s: Stato): IdGiocatore[] => s.giocatori.map((g) => g.id);

function fase<N extends NomeFase>(s: Stato, nome: N): FaseDi<N> {
  if (s.fase.nome !== nome) throw new Error(`fase attesa '${nome}', trovata '${s.fase.nome}'`);
  return s.fase as FaseDi<N>;
}

function faseVista<N extends VistaFase['nome']>(v: Vista, nome: N): VistaFaseDi<N> {
  if (v.fase.nome !== nome) throw new Error(`fase della vista attesa '${nome}', trovata '${v.fase.nome}'`);
  return v.fase as VistaFaseDi<N>;
}

function gioc(s: Stato, id: IdGiocatore): StatoGiocatore {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} inesistente`);
  return g;
}

function giocVista(v: Vista, id: IdGiocatore): VistaGiocatore {
  const g = v.giocatori.find((x) => x.id === id);
  if (!g) throw new Error(`giocatore ${id} assente dalla vista`);
  return g;
}

const mano = (s: Stato, id: IdGiocatore): IdCarta[] => gioc(s, id).mano;

function trovata(c: IdCarta | IdTipoCarta): DefTrovata {
  const d = defCarta(c);
  if (d.famiglia !== 'trovata') throw new Error(`${c} non è una Trovata`);
  return d;
}

function belato(c: IdCarta | IdTipoCarta): DefBelato {
  const d = defCarta(c);
  if (d.famiglia !== 'belato') throw new Error(`${c} non è un Belato`);
  return d;
}

function guaioDef(c: IdCarta | IdTipoCarta): DefGuaio {
  const d = defCarta(c);
  if (d.famiglia !== 'guaio') throw new Error(`${c} non è un Guaio`);
  return d;
}

function conta(xs: readonly string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const x of xs) r[x] = (r[x] ?? 0) + 1;
  return r;
}

/** Istanze "tipo#n" (n da 1) di un elenco di tipi con copie, nell'ordine dato. */
function istanze(tipi: ReadonlyArray<{ id: string; copie: number }>): IdCarta[] {
  return tipi.flatMap((t) => Array.from({ length: t.copie }, (_, i) => `${t.id}#${i + 1}`));
}

/** true se gli elementi compaiono nello stesso ordine relativo che hanno in `riferimento`. */
function inOrdineDi(xs: readonly string[], riferimento: readonly string[]): boolean {
  const posizione = new Map(riferimento.map((c, i) => [c, i]));
  const indici = xs.map((c) => posizione.get(c) ?? -1);
  return indici.every((x, i) => i === 0 || x > (indici[i - 1] ?? -1));
}

function voceCorrente(s: Stato): VoceEffetto {
  const f = fase(s, 'effetti');
  const voce = f.coda[f.indice];
  if (!voce) throw new Error('nessuna voce corrente');
  return voce;
}

function cima(s: Stato): number {
  const voce = s.pila[s.pila.length - 1];
  if (!voce) throw new Error('pila vuota');
  return voce.id;
}

/** Congela in profondità: se il motore scrivesse sullo stato ricevuto, lancerebbe TypeError. */
function congela<T>(x: T): T {
  if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congela(v);
  }
  return x;
}

function sottoinsiemi<T>(xs: readonly T[], massimo: number): T[][] {
  const tutti: T[][] = [[]];
  for (const x of xs) tutti.push(...tutti.filter((s) => s.length < massimo).map((s) => [...s, x]));
  return tutti;
}

// ─── Azioni: normalizzazione e accettazione ──────────────────────────────────

/**
 * Chiave canonica di un'azione: carte ridotte al tipo ("per i Belati e le carte uguali basta una
 * istanza per tipo", specifica §2), campi in ordine alfabetico, furto senza le quote a zero.
 */
function chiave(a: Azione): string {
  const campi = Object.entries(a)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]): [string, unknown] => {
      if ((k === 'carta' || k === 'scarta') && typeof v === 'string') return [k, tipoLocale(v)];
      if (k === 'carte' && Array.isArray(v)) return [k, v.map((c: string) => tipoLocale(c)).sort()];
      if (k === 'furto' && typeof v === 'object' && v !== null) {
        const quote = Object.entries(v as Record<string, number>).filter(([, n]) => n !== 0);
        return [k, quote.sort(([x], [y]) => x.localeCompare(y))];
      }
      return [k, v];
    })
    .sort(([x], [y]) => x.localeCompare(y));
  return JSON.stringify(campi);
}

const chiaviDi = (azioni: readonly Azione[]): string[] => [...new Set(azioni.map(chiave))].sort();

/** azioniPossibili(s, chi), verificando che ogni azione sia di chi e che applica la accetti. */
function accettate(s: Stato, chi: Chi): Azione[] {
  const azioni = azioniPossibili(s, chi);
  for (const a of azioni) {
    const descrizione = `${chi}: ${JSON.stringify(a)}`;
    if (chi === 'sistema') expect(['prosegui', 'scadenza'], descrizione).toContain(a.tipo);
    else expect('giocatore' in a ? a.giocatore : null, descrizione).toBe(chi);
    let errore: unknown = null;
    try {
      applica(s, a);
    } catch (e) {
      errore = e;
    }
    expect(errore, `azione elencata ma rifiutata — ${descrizione}`).toBeNull();
  }
  return azioni;
}

// ─── Attesa e vista secondo la specifica ─────────────────────────────────────

/** Chi si aspetta, ricavato dallo stato secondo la specifica §11. */
function attesaDaSpecifica(s: Stato): Attesa {
  const f = s.fase;
  if (f.nome === 'fine_partita') return { sistema: false, giocatori: [] };
  if (s.richiesta) return { sistema: false, giocatori: [s.richiesta.giocatore] };
  if (s.finestra) return { sistema: false, giocatori: [...s.finestra.inAttesa] };
  switch (f.nome) {
    case 'guaio':
    case 'rivelazione':
    case 'guaio_al_peggiore':
    case 'fine_round':
    case 'ultimo_round':
      return { sistema: true, giocatori: [] };
    case 'scelta':
      return { sistema: false, giocatori: Object.keys(f.scelte).filter((g) => f.scelte[g] === null) };
    case 'belato_finale':
      return { sistema: false, giocatori: f.partecipanti.filter((g) => f.scelte[g] === null) };
    case 'effetti': {
      const voce = f.coda[f.indice];
      return { sistema: false, giocatori: voce ? [voce.giocatore] : [] };
    }
    case 'belati_punteggio':
      return { sistema: false, giocatori: [...f.inAttesa] };
    case 'dado': {
      const lanciatore = s.datiRound.lanciatori[f.indice];
      return { sistema: false, giocatori: lanciatore ? [lanciatore] : [] };
    }
    case 'risoluzione_dado':
      return { sistema: false, giocatori: [f.lanciatore] };
    case 'belati_salvataggio':
    case 'consolazione':
      return { sistema: false, giocatori: [f.destinatario] };
    default:
      throw new Error(`fase imprevista ${JSON.stringify(f)}`);
  }
}

function attesaOrdinata(s: Stato): Attesa {
  const a = inAttesaDi(s);
  return { sistema: a.sistema, giocatori: ordinati(a.giocatori) };
}

function controllaAttesa(s: Stato): void {
  const atteso = attesaDaSpecifica(s);
  expect(attesaOrdinata(s)).toEqual({ sistema: atteso.sistema, giocatori: ordinati(atteso.giocatori) });
}

function controllaHaScelto(haScelto: Record<IdGiocatore, boolean>, scelte: Record<IdGiocatore, unknown>): void {
  for (const [g, scelta] of Object.entries(scelte)) expect(haScelto[g], `haScelto ${g}`).toBe(scelta !== null);
  for (const [g, h] of Object.entries(haScelto)) if (!(g in scelte)) expect(h, `haScelto ${g}`).toBe(false);
}

/** Vista per `per` conforme alla specifica §10: nasconde solo ciò che è segreto, il resto è identico allo stato. */
function controllaVista(s: Stato, per: IdGiocatore | null): Vista {
  const v = vistaPer(s, per);
  const testo = JSON.stringify(v);
  expect(v.per).toBe(per);
  expect(v.attesa).toEqual(inAttesaDi(s));

  // Niente generatore né contenuto dei mazzi.
  for (const campo of ['rng', 'mazzo', 'mazzoGuai']) expect(v).not.toHaveProperty(campo);
  expect(testo).not.toContain('"rng"');
  expect(v.carteNelMazzo).toBe(s.mazzo.length);
  expect(v.carteNelMazzoGuai).toBe(s.mazzoGuai.length);
  for (const c of s.mazzo) expect(testo, `carta del mazzo ${c} visibile a ${per}`).not.toContain(`"${c}"`);

  // Mani: solo la propria; degli altri il numero di carte.
  expect(v.giocatori.map((g) => g.id)).toEqual(ids(s));
  for (const g of s.giocatori) {
    const { mano: manoVista, carteInMano, ...pubblico } = giocVista(v, g.id);
    const { mano: manoStato, ...pubblicoStato } = g;
    expect(pubblico).toEqual(pubblicoStato);
    expect(carteInMano).toBe(manoStato.length);
    if (g.id === per) {
      expect(manoVista).toEqual(manoStato);
    } else {
      expect(manoVista).toBeNull();
      for (const c of manoStato) expect(testo, `carta di ${g.id} visibile a ${per}`).not.toContain(`"${c}"`);
    }
  }

  // Informazioni pubbliche.
  expect(v.config).toEqual(s.config);
  expect(v.gregge).toBe(s.gregge);
  expect(v.scarti).toEqual(s.scarti);
  expect(v.guaiFuoriGioco).toEqual(s.guaiFuoriGioco);
  expect(v.round).toBe(s.round);
  expect(v.primoGiocatore).toBe(s.primoGiocatore);
  expect(v.ultimoRound).toBe(s.ultimoRound);
  expect(v.datiRound).toEqual(s.datiRound);
  expect(v.pila).toEqual(s.pila);
  expect(v.finestra).toEqual(s.finestra);
  expect(v.esito).toEqual(s.esito);

  // Fase: scelte segrete in scelta e belato_finale.
  if (s.fase.nome === 'scelta') {
    const f = faseVista(v, 'scelta');
    expect(f).not.toHaveProperty('scelte');
    controllaHaScelto(f.haScelto, s.fase.scelte);
    expect(f.miaScelta).toEqual(per === null ? null : (s.fase.scelte[per] ?? null));
  } else if (s.fase.nome === 'belato_finale') {
    const f = faseVista(v, 'belato_finale');
    expect(f).not.toHaveProperty('scelte');
    expect(f.partecipanti).toEqual(s.fase.partecipanti);
    expect(f.storico).toEqual(s.fase.storico);
    controllaHaScelto(f.haScelto, s.fase.scelte);
    expect(f.miaScelta).toEqual(per === null ? null : (s.fase.scelte[per] ?? null));
  } else {
    expect(v.fase).toEqual(s.fase);
  }

  // Richiesta: le carte di guarda_due solo al proprietario.
  if (s.richiesta?.tipo === 'guarda_due' && s.richiesta.giocatore !== per) {
    expect(v.richiesta).toEqual({ ...s.richiesta, carte: [] });
  } else {
    expect(v.richiesta).toEqual(s.richiesta);
  }

  // Eventi: identici, tranne le carte delle pescate altrui.
  expect(v.eventi).toHaveLength(s.eventi.length);
  s.eventi.forEach((e, i) => {
    const ve = v.eventi[i];
    if (e.tipo === 'pescate' && e.giocatore !== per) {
      const { carte: _segrete, ...resto } = e;
      expect(ve).toMatchObject(resto);
      expect((ve as EventoPescate).carte ?? []).toEqual([]);
    } else {
      expect(ve).toEqual(e);
    }
  });
  return v;
}

/**
 * Controlli comuni a ogni stato: attesa secondo §11, viste di tutti (e del tavolo) secondo §10,
 * ogni azione possibile di ogni giocatore e del sistema accettata da applica.
 */
function controlla(s: Stato): (chi: Chi) => Azione[] {
  controllaAttesa(s);
  for (const per of [...ids(s), null]) controllaVista(s, per);
  const azioni = new Map<Chi, Azione[]>();
  for (const chi of [...ids(s), 'sistema']) azioni.set(chi, accettate(s, chi));
  const di = (chi: Chi): Azione[] => azioni.get(chi) ?? [];
  const attesa = inAttesaDi(s);
  for (const g of attesa.giocatori) expect(di(g).length, `${g} è atteso ma non ha azioni`).toBeGreaterThan(0);
  if (attesa.sistema) expect(di('sistema').map((a) => a.tipo)).toContain('prosegui');
  return di;
}

// ─── Percorsi verso le fasi ──────────────────────────────────────────────────

/** Dal Guaio scoperto fino a belati_punteggio, con Trovate senza effetto. */
function finoAlPunteggio(s: Stato, scelte: Mani): Stato {
  s = scegli(prosegui(s), scelte);
  fase(s, 'rivelazione');
  s = prosegui(s);
  fase(s, 'belati_punteggio');
  return s;
}

/** Dal Guaio scoperto fino alla fase effetti (almeno una Trovata con effetto attivabile). */
function finoAgliEffetti(s: Stato, scelte: Mani): Stato {
  s = scegli(prosegui(s), scelte);
  fase(s, 'rivelazione');
  s = prosegui(s);
  fase(s, 'effetti');
  return s;
}

function alDado(s: Stato, scelte: Mani): Stato {
  s = chiudiPunteggio(finoAlPunteggio(s, scelte));
  fase(s, 'dado');
  return s;
}

/** Il lanciatore corrente lancia il Dado del Pastore ottenendo la faccia indicata. */
function lancia(s: Stato, faccia: string): Stato {
  const f = fase(s, 'dado');
  const lanciatore = s.datiRound.lanciatori[f.indice];
  if (lanciatore === undefined) throw new Error('nessun lanciatore');
  return applica(conFaccia(s, faccia), { tipo: 'lanciaDado', giocatore: lanciatore });
}

/** Carriola 8, Balla di fieno 5, Coperta di lana 6: nessun effetto, g1 il più alto, g2 il più basso. */
const TRE_SENZA_EFFETTI: Mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] };

function alDadoBase(altro: OpzioniScenario = {}): Stato {
  return alDado(scenario({ guaio: GUAIO_NEUTRO, mani: TRE_SENZA_EFFETTI, ...altro }), TRE_SENZA_EFFETTI);
}

/** 4 giocatori, mazzo vuoto: g4 non ha Trovate e resta fuori dal round (D32, D34). */
function inSceltaConGemelle(): Stato {
  const s = prosegui(
    scenario({
      giocatori: 4,
      guaio: GUAIO_NEUTRO,
      mazzo: [],
      mani: {
        g1: ['ciliegie-appaiate', 'pantofola-gemella', 'calzino-gemello', 'carriola', 'belato-di-gruppo'],
        g2: ['orecchino-gemello', 'orecchino-gemello', 'balla-di-fieno'],
        g3: ['coperta-di-lana', 'beee-no'],
        g4: ['beee-no'],
      },
    }),
  );
  fase(s, 'scelta');
  expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
  return s;
}

/** g1 ha giocato Campanaccio stonato (sposta_agnellino); g3 non ha agnellini, quindi l'unico bersaglio è g2. */
function inEffettiCampanaccio(): Stato {
  const s = finoAgliEffetti(
    scenario({
      guaio: GUAIO_NEUTRO,
      agnellini: { g3: 0 },
      mani: { g1: ['campanaccio-stonato', 'beee-no'], g2: ['balla-di-fieno', 'beee-no'], g3: ['coperta-di-lana'] },
    }),
    { g1: ['campanaccio-stonato'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
  );
  expect(voceCorrente(s)).toMatchObject({ giocatore: 'g1', effetto: 'sposta_agnellino', esito: 'attesa' });
  return s;
}

function attivaCampanaccio(s: Stato): Stato {
  return applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voceCorrente(s).carta, bersaglio: 'g2' });
}

/** 4 giocatori: g1 8, g2 5, g3 6 partecipano; g4 (solo un Belato, mazzo vuoto) è fuori dal round. */
function inPunteggioQuattro(): Stato {
  const s = finoAlPunteggio(
    scenario({
      giocatori: 4,
      guaio: GUAIO_NEUTRO,
      mazzo: [],
      mani: {
        g1: ['carriola', 'belato-di-gruppo'],
        g2: ['balla-di-fieno', 'mondo-alla-rovescia'],
        g3: ['coperta-di-lana', 'pernacchia', 'faccio-finta-di-niente', 'beee-no', 'visita-di-garzina'],
        g4: ['belato-di-gruppo'],
      },
    }),
    TRE_SENZA_EFFETTI,
  );
  expect(s.datiRound.partecipanti).toEqual(['g1', 'g2', 'g3']);
  return s;
}

/** Cannocchiale di g1 attivato e non annullato: richiesta guarda_due con le prime 2 carte del mazzo. */
function inGuardaDue(): { s: Stato; guardate: IdCarta[]; cannocchiale: IdCarta } {
  const iniziale = scenario({
    guaio: GUAIO_NEUTRO,
    mani: { g1: ['cannocchiale'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    mazzo: ['carriola', 'trifoglio-qualunque', 'corona-di-margherite', 'ombrello-bucato'],
  });
  const guardate = iniziale.mazzo.slice(0, 2);
  let s = finoAgliEffetti(iniziale, { g1: ['cannocchiale'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] });
  const cannocchiale = voceCorrente(s).carta;
  s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: cannocchiale }));
  expect(s.richiesta?.tipo).toBe('guarda_due');
  return { s, guardate, cannocchiale };
}

function inDichiarazioneTestata(): Stato {
  const s = lancia(alDadoBase({ agnellini: { g2: 2, g3: 3 } }), 'testata');
  expect(fase(s, 'risoluzione_dado').passo).toBe('dichiarazione');
  return s;
}

function inEsitoTestata(): Stato {
  const s = nessunaReazione(applica(inDichiarazioneTestata(), { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' }));
  expect(fase(s, 'risoluzione_dado').passo).toBe('esito_testata');
  return s;
}

/** g2 e g3 pari al minimo (Carriola 8) sotto g1 (Corona 9): dopo il dado si va al Belato Finale. */
function inBelatoFinale(): Stato {
  let s = scenario({
    guaio: GUAIO_NEUTRO,
    mani: {
      g1: ['corona-di-margherite'],
      g2: ['carriola', 'balla-di-fieno', 'coperta-di-lana'],
      g3: ['carriola', 'balla-di-fieno', 'orecchino-gemello', 'orecchino-gemello'],
    },
  });
  s = alDado(s, { g1: ['corona-di-margherite'], g2: ['carriola'], g3: ['carriola'] });
  s = avanza(nessunaReazione(lancia(s, 'pascolo_piccolo')));
  const f = fase(s, 'belato_finale');
  expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3']);
  return s;
}

/** g2 (Balla 5) è il più basso e sta per prendere il Guaio; ha già un Guaio meteo nell'Angolo. */
function inSalvataggio(): Stato {
  let s = scenario({
    guaio: GUAIO_NEUTRO,
    angoli: { g2: ['grandine-a-sorpresa'] },
    mani: {
      g1: ['carriola'],
      g2: ['balla-di-fieno', 'faccio-finta-di-niente', 'finta-svenuta', 'beee-no', 'belato-di-gruppo', 'visita-di-garzina'],
      g3: ['coperta-di-lana'],
    },
  });
  s = alDado(s, TRE_SENZA_EFFETTI);
  s = avanza(nessunaReazione(lancia(s, 'pascolo_piccolo')));
  expect(fase(s, 'belati_salvataggio').destinatario).toBe('g2');
  return s;
}

function inConsolazione(): Stato {
  const s = applica(inSalvataggio(), { tipo: 'passa', giocatore: 'g2' });
  expect(fase(s, 'consolazione').destinatario).toBe('g2');
  return s;
}

/** Tutti pari (§4.6): nessuno lancia, guaio_al_peggiore senza destinatario né spareggio. */
function inGuaioAlPeggiore(altro: OpzioniScenario = {}): Stato {
  const tre: Mani = { g1: ['carriola'], g2: ['carriola'], g3: ['carriola'] };
  const s = chiudiPunteggio(finoAlPunteggio(scenario({ guaio: GUAIO_NEUTRO, mani: tre, ...altro }), tre));
  expect(fase(s, 'guaio_al_peggiore')).toMatchObject({ destinatario: null, spareggio: null });
  return s;
}

function inFineRound(altro: OpzioniScenario = {}): Stato {
  const s = prosegui(inGuaioAlPeggiore(altro));
  fase(s, 'fine_round');
  return s;
}

function inUltimoRound(): Stato {
  const s = prosegui(inFineRound({ ultimoRound: 2 }));
  fase(s, 'ultimo_round');
  return s;
}

/** g1 ha un agnellino in meno dei posti dell'Ovile (14 su 15) e prende l'agnellino di Agnellino smarrito: Ovile pieno (§9.1). */
function partitaFinita(): Stato {
  let s = finoAgliEffetti(
    scenario({
      guaio: GUAIO_NEUTRO,
      agnellini: { g1: configPer(3).postiOvile - 1 },
      mani: {
        g1: ['agnellino-smarrito', 'carriola'],
        g2: ['balla-di-fieno', 'beee-no', 'belato-di-gruppo'],
        g3: ['coperta-di-lana', 'beee-no'],
      },
    }),
    { g1: ['agnellino-smarrito'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
  );
  s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voceCorrente(s).carta }));
  fase(s, 'fine_partita');
  expect(s.esito).toEqual({ modo: 'ovile_pieno', vincitori: ['g1'] });
  return s;
}

function statiCampione(): Array<[string, Stato]> {
  const guaio = scenario({ guaio: GUAIO_NEUTRO, mani: TRE_SENZA_EFFETTI });
  const effetti = inEffettiCampanaccio();
  const dado = alDadoBase();
  return [
    ['guaio', guaio],
    ['scelta', inSceltaConGemelle()],
    ['rivelazione', scegli(prosegui(guaio), TRE_SENZA_EFFETTI)],
    ['effetti', effetti],
    ['finestra su effetto', attivaCampanaccio(effetti)],
    ['richiesta guarda_due', inGuardaDue().s],
    ['belati_punteggio', inPunteggioQuattro()],
    ['dado', dado],
    ['dichiarazione del furto', lancia(dado, 'furto_piccolo')],
    ['dichiarazione della Testata', inDichiarazioneTestata()],
    ['esito della Testata', inEsitoTestata()],
    ['guaio_al_peggiore', inGuaioAlPeggiore()],
    ['belato_finale', inBelatoFinale()],
    ['belati_salvataggio', inSalvataggio()],
    ['consolazione', inConsolazione()],
    ['fine_round', inFineRound()],
    ['ultimo_round', inUltimoRound()],
    ['fine_partita', partitaFinita()],
  ];
}

// ─── Dati ────────────────────────────────────────────────────────────────────

/** Gruppi di risoluzione degli effetti delle Trovate (brief §4, tabella degli effetti). */
const GRUPPO_DI_EFFETTO: Record<EffettoTrovata, GruppoEffetto> = {
  ignora_effetti: 'round',
  scarta_e_somma: 'normale',
  prendi_agnellino: 'normale',
  scarta_fino_a_tre: 'normale',
  sposta_agnellino: 'normale',
  guarda_due: 'normale',
  scambia_punteggi: 'punteggio',
  raddoppia_belati: 'punteggio',
};

const QUANDO_DI_BELATO: Record<string, DefBelato['quando']> = {
  modifica_punteggio: 'punteggio',
  scambia_punteggi: 'punteggio',
  guaio_in_fondo: 'salvataggio',
  devia_guaio: 'salvataggio',
  beee_no: 'sempre',
  cura: 'dopo_guaio',
};

const eTrovata = (c: IdCarta): boolean => defCarta(c).famiglia === 'trovata';
const eBelato = (c: IdCarta): boolean => defCarta(c).famiglia === 'belato';

describe('Dati: mazzo principale (brief §4, specifica §3 e D37)', () => {
  it('a 3 e 4 giocatori: 62 istanze non mescolate, in ordine di catalogo (Trovate poi Belati)', () => {
    const atteso = istanze([...carteJson.trovate, ...carteJson.belati]);
    expect(atteso).toHaveLength(62);
    expect(creaMazzoPrincipale(3)).toEqual(atteso);
    expect(creaMazzoPrincipale(4)).toEqual(atteso);
  });

  it('44 Trovate: 4 per ogni valore da 0 a 9 più 4 extra sui valori 4, 5 e 6', () => {
    const trovate = creaMazzoPrincipale(3).filter(eTrovata);
    expect(trovate).toHaveLength(44);
    expect(conta(trovate.map((c) => String(trovata(c).valore)))).toEqual({
      '0': 4,
      '1': 4,
      '2': 4,
      '3': 4,
      '4': 5,
      '5': 6,
      '6': 5,
      '7': 4,
      '8': 4,
      '9': 4,
    });
  });

  it('8 Trovate Gemelle, tutte di valore da 1 a 4 e senza altri effetti (D9)', () => {
    const gemelle = creaMazzoPrincipale(3).filter((c) => eTrovata(c) && trovata(c).gemella);
    expect(gemelle).toHaveLength(8);
    for (const c of gemelle) {
      const d = trovata(c);
      expect(d.valore, c).toBeGreaterThanOrEqual(1);
      expect(d.valore, c).toBeLessThanOrEqual(4);
      expect(d.effetto, c).toBeNull();
      expect(d.gruppo, c).toBeNull();
    }
  });

  it('circa metà delle Trovate senza effetto; le altre usano gli 8 effetti del brief con il gruppo giusto', () => {
    const trovate = creaMazzoPrincipale(3).filter(eTrovata);
    const senzaEffetto = trovate.filter((c) => trovata(c).effetto === null).length;
    expect(senzaEffetto / trovate.length).toBeGreaterThanOrEqual(0.4);
    expect(senzaEffetto / trovate.length).toBeLessThanOrEqual(0.6);
    const effetti = new Set(trovate.map((c) => trovata(c).effetto).filter((e): e is EffettoTrovata => e !== null));
    expect(ordinati([...effetti])).toEqual(ordinati(Object.keys(GRUPPO_DI_EFFETTO)));
    for (const t of carteJson.trovate) {
      const d = trovata(t.id);
      expect(d.gruppo, t.id).toBe(d.effetto === null ? null : GRUPPO_DI_EFFETTO[d.effetto]);
    }
  });

  it('18 Belati con le copie di cards.json: i 16 del brief più 2 Visita di Garzina (D37)', () => {
    const belati = creaMazzoPrincipale(3).filter(eBelato);
    expect(belati).toHaveLength(18);
    expect(conta(belati.map(tipoDi))).toEqual({
      'belato-di-gruppo': 3,
      pernacchia: 3,
      'mondo-alla-rovescia': 2,
      'faccio-finta-di-niente': 2,
      'finta-svenuta': 2,
      'beee-no': 4,
      'visita-di-garzina': 2,
    });
    expect(belato('belato-di-gruppo')).toMatchObject({ effetto: 'modifica_punteggio', quando: 'punteggio', valore: 2 });
    expect(belato('pernacchia')).toMatchObject({ effetto: 'modifica_punteggio', quando: 'punteggio', valore: -2 });
    expect(belato('mondo-alla-rovescia')).toMatchObject({ effetto: 'scambia_punteggi', quando: 'punteggio' });
    expect(belato('faccio-finta-di-niente')).toMatchObject({ effetto: 'guaio_in_fondo', quando: 'salvataggio' });
    expect(belato('finta-svenuta')).toMatchObject({ effetto: 'devia_guaio', quando: 'salvataggio' });
    expect(belato('beee-no')).toMatchObject({ effetto: 'beee_no', quando: 'sempre' });
    expect(belato('visita-di-garzina')).toMatchObject({ effetto: 'cura', quando: 'dopo_guaio' });
  });

  it('variante a 2 (D36): 50 carte, nessuna Trovata di valore 1, 2, 3; restano solo le Gemelle di valore 4', () => {
    const due = creaMazzoPrincipale(2);
    expect(due).toHaveLength(50);
    expect(due).toEqual(
      creaMazzoPrincipale(3).filter((c) => !eTrovata(c) || ![1, 2, 3].includes(trovata(c).valore)),
    );
    expect(due.filter(eTrovata)).toHaveLength(32);
    expect(due.filter(eBelato)).toHaveLength(18);
    const gemelle = due.filter((c) => eTrovata(c) && trovata(c).gemella);
    expect(gemelle.map(tipoDi)).toEqual(['orecchino-gemello', 'orecchino-gemello']);
    expect(gemelle.map((c) => trovata(c).valore)).toEqual([4, 4]);
    expect(setupJson.varianteDueGiocatori.valoriTrovateTolti).toEqual([1, 2, 3]);
  });
});

describe('Dati: mazzo Guai, istanze e catalogo (brief §2 e §4, specifica §2)', () => {
  it('creaMazzoGuai: 24 istanze in ordine di catalogo, 7 meteo, 7 predatori, 7 drammi, 3 tosature', () => {
    const guai = creaMazzoGuai();
    expect(guai).toEqual(carteJson.guai.map((g) => `${g.id}#1`));
    expect(guai).toHaveLength(24);
    expect(conta(guai.map((c) => guaioDef(c).tipo))).toEqual({ meteo: 7, predatori: 7, drammi: 7, tosatura: 3 });
    for (const c of guai) expect(guaioDef(c).copie, c).toBe(1);
  });

  it('istanze nel formato "tipo#n" con n da 1 al numero di copie, senza doppioni', () => {
    const tutte = [...creaMazzoPrincipale(3), ...creaMazzoGuai()];
    expect(new Set(tutte).size).toBe(tutte.length);
    for (const c of tutte) {
      const m = /^([a-z0-9-]+)#([1-9]\d*)$/.exec(c);
      expect(m, c).not.toBeNull();
      if (!m) continue;
      expect(tipoDi(c)).toBe(m[1]);
      expect(Number(m[2])).toBeLessThanOrEqual(defCarta(c).copie);
    }
  });

  it('tipoDi accetta istanze e tipi', () => {
    expect(tipoDi('calzino-gemello#2')).toBe('calzino-gemello');
    expect(tipoDi('calzino-gemello')).toBe('calzino-gemello');
    expect(tipoDi('beee-no#4')).toBe('beee-no');
    expect(tipoDi('lupo-vegetariano#1')).toBe('lupo-vegetariano');
  });

  it('defCarta: stessa definizione per istanza e tipo, coerente con CATALOGO', () => {
    expect(defCarta('calzino-gemello#2')).toEqual(defCarta('calzino-gemello'));
    expect(defCarta('calzino-gemello')).toEqual(CATALOGO.carte['calzino-gemello']);
    expect(trovata('calzino-gemello#2')).toMatchObject({
      id: 'calzino-gemello',
      famiglia: 'trovata',
      valore: 3,
      gemella: true,
      effetto: null,
      gruppo: null,
      copie: 2,
    });
    expect(trovata('tappi-per-le-orecchie')).toMatchObject({ valore: 9, effetto: 'ignora_effetti', gruppo: 'round' });
    expect(trovata('capriola#1')).toMatchObject({ valore: 5, effetto: 'scambia_punteggi', gruppo: 'punteggio' });
    expect(guaioDef('rasatura-integrale#1')).toMatchObject({ famiglia: 'guaio', tipo: 'tosatura', copie: 1 });
    // Istanze oltre le copie (usate da scenario, specifica §14): il tipo è quello del prefisso.
    expect(trovata('carriola#7').valore).toBe(8);
  });

  it('defCarta lancia se il tipo non esiste', () => {
    expect(() => defCarta('pecora-volante')).toThrow();
    expect(() => defCarta('pecora-volante#1')).toThrow();
    expect(() => defCarta('')).toThrow();
  });

  it('CATALOGO.carte contiene esattamente Trovate, Belati e Guai di cards.json', () => {
    const attesi = [...carteJson.trovate, ...carteJson.belati, ...carteJson.guai].map((c) => c.id);
    expect(ordinati(Object.keys(CATALOGO.carte))).toEqual(ordinati(attesi));
    for (const [id, d] of Object.entries(CATALOGO.carte)) expect(d.id).toBe(id);
    for (const t of carteJson.trovate) expect(CATALOGO.carte[t.id]).toMatchObject({ ...t, famiglia: 'trovata' });
    for (const b of carteJson.belati) {
      expect(CATALOGO.carte[b.id]).toMatchObject({ ...b, famiglia: 'belato', quando: QUANDO_DI_BELATO[b.effetto] });
    }
    for (const g of carteJson.guai) expect(CATALOGO.carte[g.id]).toMatchObject({ ...g, famiglia: 'guaio', copie: 1 });
  });

  it('CATALOGO.pecore: le quattro pecore con bonus e malus del brief §2', () => {
    expect(ordinati(Object.keys(CATALOGO.pecore))).toEqual(['brontolana', 'nerina', 'ricciolo', 'sospirella']);
    expect(CATALOGO.pecore.ricciolo).toMatchObject({ nome: 'Ricciolo', bonus: 'meteo', malus: 'predatori' });
    expect(CATALOGO.pecore.brontolana).toMatchObject({ nome: 'Brontolana', bonus: 'predatori', malus: 'drammi' });
    expect(CATALOGO.pecore.sospirella).toMatchObject({ nome: 'Sospirella', bonus: 'drammi', malus: 'meteo' });
    expect(CATALOGO.pecore.nerina).toMatchObject({ nome: 'Nerina', bonus: 'predatori', malus: 'meteo' });
  });
});

// ─── Preparazione ────────────────────────────────────────────────────────────

const NORMALE: RegolaEliminazione[] = [
  { regola: 'uguali', quanti: 3 },
  { regola: 'diversi', quanti: 4 },
];
const DUE_GIOCATORI: RegolaEliminazione[] = [
  { regola: 'uguali', quanti: 4 },
  { regola: 'diversi', quanti: 4 },
];

interface CasoPreparazione {
  n: number;
  posti: number;
  totali: number;
  gregge: number;
  carte: number;
  mazzo: number;
  regole: RegolaEliminazione[];
}

const CASI: CasoPreparazione[] = [
  { n: 2, posti: 18, totali: 36, gregge: 30, carte: 50, mazzo: 40, regole: DUE_GIOCATORI },
  { n: 3, posti: 15, totali: 45, gregge: 36, carte: 62, mazzo: 47, regole: NORMALE },
  { n: 4, posti: 12, totali: 44, gregge: 32, carte: 62, mazzo: 42, regole: NORMALE },
];

const PARTECIPANTI: Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }> = [
  { id: 'anna', nome: 'Anna', pecora: 'ricciolo' },
  { id: 'bruno', nome: 'Bruno', pecora: 'nerina' },
  { id: 'carla', nome: 'Carla', pecora: 'sospirella' },
  { id: 'dario', nome: 'Dario', pecora: 'brontolana' },
];
const primi = (n: number): Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }> =>
  PARTECIPANTI.slice(0, n).map((p) => ({ ...p }));

describe('configPer (brief §3 "Preparazione" e "Variante a 2 giocatori", specifica §3 e §8)', () => {
  it.each(CASI)('$n giocatori: Ovile da $posti, $totali agnellini, 3 iniziali, regole di eliminazione', (c) => {
    expect(configPer(c.n)).toEqual({
      numeroGiocatori: c.n,
      postiOvile: c.posti,
      agnelliniTotali: c.totali,
      agnelliniIniziali: 3,
      manoIniziale: 5,
      regoleEliminazione: c.regole,
      dado: setupJson.dado,
      esitoMassimoTestata: 3,
    });
  });

  it('dado: 6 facce (Pascolo 3, Pascolo 5, Furto 2, Furto 4, Testata fino a 3 ×2)', () => {
    const dado = configPer(3).dado;
    expect(dado.reduce((t, f) => t + f.copie, 0)).toBe(6);
    expect(dado.map((f) => [f.effetto, f.quantita, f.copie])).toEqual([
      ['pascolo', 3, 1],
      ['pascolo', 5, 1],
      ['furto', 2, 1],
      ['furto', 4, 1],
      ['testata', 3, 2],
    ]);
  });
});

describe('Preparazione: nuovaPartita (brief §3 "Preparazione", specifica §3)', () => {
  it.each(CASI)('$n giocatori: 3 agnellini e 5 carte a testa, Gregge $gregge, mazzo da $mazzo', (c) => {
    const s = nuovaPartita({ giocatori: primi(c.n), seme: 11 });
    expect(s.giocatori.map((g) => [g.id, g.nome, g.pecora])).toEqual(primi(c.n).map((p) => [p.id, p.nome, p.pecora]));
    for (const g of s.giocatori) {
      expect(g.agnellini, g.id).toBe(3);
      expect(g.mano, g.id).toHaveLength(5);
      expect(g.angolo, g.id).toEqual([]);
      expect(g.eliminato, g.id).toBe(false);
    }
    expect(s.gregge).toBe(c.totali - 3 * c.n);
    expect(s.gregge).toBe(c.gregge);
    expect(s.mazzo).toHaveLength(c.mazzo);
    expect(s.config).toEqual(configPer(c.n));
    expect(s.config.regoleEliminazione).toEqual(c.regole);
  });

  it.each(CASI)('$n giocatori: le carte in gioco sono esattamente il mazzo principale, mescolato', (c) => {
    const s = nuovaPartita({ giocatori: primi(c.n), seme: 11 });
    const inGioco = [...s.giocatori.flatMap((g) => g.mano), ...s.mazzo];
    expect(inGioco).toHaveLength(c.carte);
    expect(ordinati(inGioco)).toEqual(ordinati(creaMazzoPrincipale(c.n)));
    expect(inOrdineDi(s.mazzo, creaMazzoPrincipale(c.n))).toBe(false);
  });

  it.each(CASI)('$n giocatori: fase guaio del round 1, Guaio già scoperto, mazzo Guai da 23 mescolato', (c) => {
    const s = nuovaPartita({ giocatori: primi(c.n), seme: 11 });
    expect(s.fase).toEqual({ nome: 'guaio' });
    expect(s.round).toBe(1);
    expect(s.datiRound.numero).toBe(1);
    const guaio = s.datiRound.guaio;
    expect(guaio).not.toBeNull();
    if (guaio === null) return;
    expect(defCarta(guaio).famiglia).toBe('guaio');
    expect(s.mazzoGuai).toHaveLength(23);
    expect(s.mazzoGuai).not.toContain(guaio);
    expect(ordinati([guaio, ...s.mazzoGuai])).toEqual(ordinati(creaMazzoGuai()));
    expect(inOrdineDi([guaio, ...s.mazzoGuai], creaMazzoGuai())).toBe(false);
    expect(ids(s)).toContain(s.primoGiocatore);
  });

  it('stato iniziale pulito: pila, finestra, richiesta, esito, scarti e ultimo round vuoti', () => {
    const s = nuovaPartita({ giocatori: primi(3), seme: 5 });
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.richiesta).toBeNull();
    expect(s.esito).toBeNull();
    expect(s.scarti).toEqual([]);
    expect(s.guaiFuoriGioco).toEqual([]);
    expect(s.ultimoRound).toBeNull();
    expect(s.datiRound).toMatchObject({
      partecipanti: [],
      tavolo: [],
      raddoppioBelati: false,
      ignoraEffetti: null,
      piuAlti: [],
      piuBassi: [],
      lanciatori: [],
      presoDa: null,
    });
    expect(Object.values(s.datiRound.giocate).every((g) => g.length === 0)).toBe(true);
    expect(Object.values(s.datiRound.punteggi).every((r) => r.length === 0)).toBe(true);
    expect(Number.isInteger(s.rng) && s.rng >= 0 && s.rng < 2 ** 32).toBe(true);
  });

  it('eventi iniziali: round_iniziato (round 1) e guaio_rivelato, con seq crescenti (§4.1, §12)', () => {
    const s = nuovaPartita({ giocatori: primi(3), seme: 5 });
    const iRound = s.eventi.findIndex((e) => e.tipo === 'round_iniziato' && e.round === 1 && !e.ultimo);
    const iGuaio = s.eventi.findIndex((e) => e.tipo === 'guaio_rivelato' && e.carta === s.datiRound.guaio);
    expect(iRound).toBeGreaterThanOrEqual(0);
    expect(iGuaio).toBeGreaterThan(iRound);
    const seq = s.eventi.map((e) => e.seq);
    seq.forEach((x, i) => {
      if (i > 0) expect(x).toBeGreaterThan(seq[i - 1] ?? -Infinity);
      expect(x).toBeLessThan(s.prossimoEvento);
    });
  });

  it('stesso seme ⇒ stato identico; semi diversi ⇒ mescolate diverse (§1, §3.3)', () => {
    const a = nuovaPartita({ giocatori: primi(3), seme: 42 });
    expect(nuovaPartita({ giocatori: primi(3), seme: 42 })).toEqual(a);
    const b = nuovaPartita({ giocatori: primi(3), seme: 43 });
    expect(b.mazzo).not.toEqual(a.mazzo);
    expect([b.datiRound.guaio, ...b.mazzoGuai]).not.toEqual([a.datiRound.guaio, ...a.mazzoGuai]);
  });

  it('il seme vale come uint32 (rng = seme >>> 0): −1 ≡ 2³²−1 e 2³²+5 ≡ 5', () => {
    expect(nuovaPartita({ giocatori: primi(3), seme: -1 })).toEqual(nuovaPartita({ giocatori: primi(3), seme: 2 ** 32 - 1 }));
    expect(nuovaPartita({ giocatori: primi(3), seme: 2 ** 32 + 5 })).toEqual(nuovaPartita({ giocatori: primi(3), seme: 5 }));
  });

  it('primoGiocatore è estratto a caso: cambia al variare del seme (§3.6, D33)', () => {
    const primiGiocatori = new Set<IdGiocatore>();
    for (let seme = 1; seme <= 40; seme++) primiGiocatori.add(nuovaPartita({ giocatori: primi(3), seme }).primoGiocatore);
    expect(primiGiocatori.size).toBeGreaterThan(1);
    for (const g of primiGiocatori) expect(['anna', 'bruno', 'carla']).toContain(g);
  });

  it('variante a 2: nessuna Trovata di valore 1, 2, 3 né in mano né nel mazzo (brief §3, D36)', () => {
    for (const seme of [1, 2, 3]) {
      const s = nuovaPartita({ giocatori: primi(2), seme });
      const inGioco = [...s.giocatori.flatMap((g) => g.mano), ...s.mazzo];
      expect(inGioco.filter((c) => eTrovata(c) && [1, 2, 3].includes(trovata(c).valore))).toEqual([]);
      expect(s.config.postiOvile).toBe(18);
    }
  });

  it('rifiuta 0, 1 o 5 giocatori (giocatori_non_validi)', () => {
    expect(() => nuovaPartita({ giocatori: [], seme: 1 })).toThrow(ErroreRegola);
    expect(() => nuovaPartita({ giocatori: primi(1), seme: 1 })).toThrow(ErroreRegola);
    const cinque = [...primi(4), { id: 'elena', nome: 'Elena', pecora: 'ricciolo' as IdPecora }];
    expect(() => nuovaPartita({ giocatori: cinque, seme: 1 })).toThrow(ErroreRegola);
  });

  it('rifiuta id duplicati, pecore duplicate o inesistenti (giocatori_non_validi)', () => {
    const idDoppio = [
      { id: 'anna', nome: 'Anna', pecora: 'ricciolo' as IdPecora },
      { id: 'anna', nome: 'Anna bis', pecora: 'nerina' as IdPecora },
    ];
    const pecoraDoppia = [
      { id: 'anna', nome: 'Anna', pecora: 'ricciolo' as IdPecora },
      { id: 'bruno', nome: 'Bruno', pecora: 'ricciolo' as IdPecora },
      { id: 'carla', nome: 'Carla', pecora: 'sospirella' as IdPecora },
    ];
    const pecoraInesistente = [
      { id: 'anna', nome: 'Anna', pecora: 'ricciolo' as IdPecora },
      { id: 'bruno', nome: 'Bruno', pecora: 'dolly' as IdPecora },
    ];
    expect(() => nuovaPartita({ giocatori: idDoppio, seme: 1 })).toThrow(ErroreRegola);
    expect(() => nuovaPartita({ giocatori: pecoraDoppia, seme: 1 })).toThrow(ErroreRegola);
    expect(() => nuovaPartita({ giocatori: pecoraInesistente, seme: 1 })).toThrow(ErroreRegola);
    // Le quattro pecore diverse vanno bene.
    expect(() => nuovaPartita({ giocatori: primi(4), seme: 1 })).not.toThrow();
  });

  it('in fase guaio aspetta solo il sistema; prosegui porta alla scelta; viste e azioni coerenti', () => {
    const s = nuovaPartita({ giocatori: primi(3), seme: 9 });
    expect(inAttesaDi(s)).toEqual({ sistema: true, giocatori: [] });
    const di = controlla(s);
    expect(di('sistema')).toEqual([{ tipo: 'prosegui' }]);
    for (const g of ids(s)) expect(di(g), g).toEqual([]);
    const scelta = prosegui(s);
    fase(scelta, 'scelta');
    controlla(scelta);
  });
});

// ─── Vista ───────────────────────────────────────────────────────────────────

describe('vistaPer: informazioni nascoste (brief §6, specifica §10)', () => {
  it('nuova partita: ognuno vede solo la propria mano, degli altri solo quante carte hanno', () => {
    const s = nuovaPartita({ giocatori: primi(3), seme: 7 });
    for (const g of ids(s)) {
      const v = vistaPer(s, g);
      expect(v.per).toBe(g);
      for (const vg of v.giocatori) {
        expect(vg.carteInMano).toBe(5);
        expect(vg.mano).toEqual(vg.id === g ? mano(s, g) : null);
      }
    }
    for (const per of [...ids(s), null]) controllaVista(s, per);
  });

  it('vista tavolo (null): nessuna mano, nessuna carta in mano nel testo della vista', () => {
    const s = nuovaPartita({ giocatori: primi(4), seme: 7 });
    const v = vistaPer(s, null);
    expect(v.per).toBeNull();
    expect(v.giocatori.map((g) => g.mano)).toEqual([null, null, null, null]);
    expect(v.giocatori.map((g) => g.carteInMano)).toEqual([5, 5, 5, 5]);
    const testo = JSON.stringify(v);
    for (const g of s.giocatori) for (const c of g.mano) expect(testo).not.toContain(`"${c}"`);
  });

  it('niente rng e niente contenuto dei mazzi: solo carteNelMazzo e carteNelMazzoGuai', () => {
    const s = nuovaPartita({ giocatori: primi(3), seme: 7 });
    for (const per of [...ids(s), null]) {
      const v = vistaPer(s, per);
      expect(v).not.toHaveProperty('rng');
      expect(v).not.toHaveProperty('mazzo');
      expect(v).not.toHaveProperty('mazzoGuai');
      expect(v.carteNelMazzo).toBe(47);
      expect(v.carteNelMazzoGuai).toBe(23);
      const testo = JSON.stringify(v);
      expect(testo).not.toContain('"rng"');
      for (const c of [...s.mazzo, ...s.mazzoGuai]) expect(testo, `${c} visibile a ${per}`).not.toContain(`"${c}"`);
      // Il Guaio scoperto è pubblico.
      expect(v.datiRound.guaio).toBe(s.datiRound.guaio);
    }
  });

  it('scelta segreta: tutti vedono haScelto, solo chi ha scelto vede miaScelta (anche se cambia, D40)', () => {
    const s0 = inSceltaConGemelle();
    const coppia = [carta(s0, 'g1', 'ciliegie-appaiate'), carta(s0, 'g1', 'pantofola-gemella')];
    const s = applica(s0, { tipo: 'scegliTrovata', giocatore: 'g1', carte: coppia });

    const mia = faseVista(vistaPer(s, 'g1'), 'scelta');
    expect(mia.haScelto).toMatchObject({ g1: true, g2: false, g3: false });
    expect(ordinati(mia.miaScelta ?? [])).toEqual(ordinati(coppia));
    for (const per of ['g2', 'g3', 'g4', null]) {
      const v = vistaPer(s, per);
      const f = faseVista(v, 'scelta');
      expect(f).not.toHaveProperty('scelte');
      expect(f.miaScelta).toBeNull();
      expect(f.haScelto).toMatchObject({ g1: true, g2: false, g3: false });
      expect(f.haScelto.g4 ?? false).toBe(false);
      for (const c of coppia) expect(JSON.stringify(v), `${c} visibile a ${per}`).not.toContain(`"${c}"`);
    }
    for (const per of [...ids(s), null]) controllaVista(s, per);

    const carriola = carta(s, 'g1', 'carriola');
    const cambiata = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carriola] });
    expect(faseVista(vistaPer(cambiata, 'g1'), 'scelta').miaScelta).toEqual([carriola]);
    expect(faseVista(vistaPer(cambiata, 'g2'), 'scelta').miaScelta).toBeNull();
    expect(JSON.stringify(vistaPer(cambiata, 'g2'))).not.toContain(`"${carriola}"`);
  });

  it('Belato Finale: scelta segreta finché non hanno scelto tutti; poi lo storico è pubblico (§4.9)', () => {
    const s0 = inBelatoFinale();
    const balla2 = carta(s0, 'g2', 'balla-di-fieno');
    const s1 = applica(s0, { tipo: 'sceltaFinale', giocatore: 'g2', carta: balla2 });

    const f2 = faseVista(vistaPer(s1, 'g2'), 'belato_finale');
    expect(f2.miaScelta).toBe(balla2);
    expect(f2.haScelto).toMatchObject({ g2: true, g3: false });
    expect(f2.storico).toEqual([]);
    for (const per of ['g1', 'g3', null]) {
      const v = vistaPer(s1, per);
      const f = faseVista(v, 'belato_finale');
      expect(f).not.toHaveProperty('scelte');
      expect(f.miaScelta).toBeNull();
      expect(f.haScelto).toMatchObject({ g2: true, g3: false });
      expect(ordinati(f.partecipanti)).toEqual(['g2', 'g3']);
      expect(JSON.stringify(v), `scelta di g2 visibile a ${per}`).not.toContain(`"${balla2}"`);
    }
    for (const per of [...ids(s1), null]) controllaVista(s1, per);

    // g3 sceglie lo stesso valore: rivelazione, nuova parità, si ripete tra loro.
    const balla3 = carta(s1, 'g3', 'balla-di-fieno');
    const s2 = applica(s1, { tipo: 'sceltaFinale', giocatore: 'g3', carta: balla3 });
    expect(fase(s2, 'belato_finale').storico).toEqual([{ g2: balla2, g3: balla3 }]);
    for (const per of [...ids(s2), null]) {
      const v = controllaVista(s2, per);
      const f = faseVista(v, 'belato_finale');
      expect(f.storico).toEqual([{ g2: balla2, g3: balla3 }]);
      expect(f.haScelto).toMatchObject({ g2: false, g3: false });
      expect(f.miaScelta).toBeNull();
      expect(v.datiRound.tavolo).toEqual(expect.arrayContaining([balla2, balla3]));
    }
  });

  it('richiesta guarda_due: le due carte solo al proprietario, agli altri la richiesta con carte: []', () => {
    const { s, guardate, cannocchiale } = inGuardaDue();
    const r = s.richiesta;
    if (r?.tipo !== 'guarda_due') throw new Error('richiesta guarda_due attesa');
    expect(r.giocatore).toBe('g1');
    expect(r.carta).toBe(cannocchiale);
    expect(ordinati(r.carte)).toEqual(ordinati(guardate));

    expect(vistaPer(s, 'g1').richiesta).toEqual(r);
    for (const per of ['g2', 'g3', null]) {
      const v = vistaPer(s, per);
      expect(v.richiesta).toEqual({ tipo: 'guarda_due', giocatore: 'g1', carta: cannocchiale, carte: [] });
      for (const c of guardate) expect(JSON.stringify(v), `${c} visibile a ${per}`).not.toContain(`"${c}"`);
    }
    for (const per of [...ids(s), null]) controllaVista(s, per);
  });

  it('pescate di fine round: le carte pescate sono visibili solo a chi pesca (§4.12, §12)', () => {
    const prima = inGuaioAlPeggiore();
    const s = prosegui(prima);
    fase(s, 'fine_round');
    const nuove = (eventi: Evento[]): EventoPescate[] =>
      eventi.filter((e): e is EventoPescate => e.tipo === 'pescate' && e.seq >= prima.prossimoEvento);

    for (const g of ids(s)) {
      expect(mano(s, g), g).toHaveLength(5);
      const sue = nuove(s.eventi).filter((e) => e.giocatore === g);
      expect(sue.reduce((t, e) => t + e.quante, 0), g).toBe(5);

      const viste = nuove(vistaPer(s, g).eventi);
      const proprie = viste.filter((e) => e.giocatore === g).flatMap((e) => e.carte ?? []);
      expect(ordinati(proprie), `${g} vede le proprie pescate`).toEqual(ordinati(mano(s, g)));
      for (const e of viste.filter((x) => x.giocatore !== g)) {
        expect(e.carte ?? [], `${g} vede le pescate di ${e.giocatore}`).toEqual([]);
        expect(e.quante).toBe(5);
      }
    }
    for (const e of nuove(vistaPer(s, null).eventi)) expect(e.carte ?? []).toEqual([]);
    for (const per of [...ids(s), null]) controllaVista(s, per);
  });

  it('ripescata: le carte nuove restano segrete, la mano scartata va negli scarti pubblici (§4.2)', () => {
    const s0 = scenario({
      guaio: GUAIO_NEUTRO,
      mani: { g1: ['sasso-comodo'], g2: ['capriola'], g3: ['beee-no', 'pernacchia'] },
      mazzo: [
        'carriola',
        'balla-di-fieno',
        'coperta-di-lana',
        'trifoglio-qualunque',
        'corona-di-margherite',
        'ombrello-bucato',
        'megafono-di-latta',
      ],
    });
    const scartate = mano(s0, 'g3');
    const pescate = s0.mazzo.slice(0, 5);
    const s = prosegui(s0);
    fase(s, 'scelta');
    expect(ordinati(mano(s, 'g3'))).toEqual(ordinati(pescate));

    for (const per of ['g1', 'g2', null]) {
      const v = vistaPer(s, per);
      const testo = JSON.stringify(v);
      for (const c of pescate) expect(testo, `${c} visibile a ${per}`).not.toContain(`"${c}"`);
      expect(v.scarti).toEqual(expect.arrayContaining(scartate));
      expect(giocVista(v, 'g3')).toMatchObject({ mano: null, carteInMano: 5 });
      expect(v.eventi).toContainEqual(
        expect.objectContaining({ tipo: 'ripescata', giocatore: 'g3', scartate: 2, pescate: 5 }),
      );
    }
    expect(ordinati(giocVista(vistaPer(s, 'g3'), 'g3').mano ?? [])).toEqual(ordinati(pescate));
    for (const per of [...ids(s), null]) controllaVista(s, per);
  });

  it('Angoli, scarti, Guai fuori gioco, pila, giocate e punteggi sono pubblici; gli eliminati restano visibili', () => {
    let s = scenario({
      giocatori: 4,
      eliminati: ['g4'],
      agnellini: { g4: 0 },
      guaio: GUAIO_NEUTRO,
      angoli: { g1: ['lupo-vegetariano'], g2: ['nebbia-fitta', 'insonnia'] },
      scarti: ['carriola', 'pernacchia'],
      guaiFuoriGioco: ['volpe-gentile', 'spuntatina'],
      mani: { g1: ['campanaccio-stonato'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    });
    s = finoAgliEffetti(s, { g1: ['campanaccio-stonato'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] });
    const campanaccio = voceCorrente(s).carta;
    s = applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: campanaccio, bersaglio: 'g2' });

    const v = vistaPer(s, 'g3');
    expect(giocVista(v, 'g1').angolo.map(tipoDi)).toEqual(['lupo-vegetariano']);
    expect(giocVista(v, 'g2').angolo.map(tipoDi)).toEqual(['nebbia-fitta', 'insonnia']);
    expect(giocVista(v, 'g4')).toMatchObject({ eliminato: true, agnellini: 0, carteInMano: 0, mano: null });
    expect(v.scarti.map(tipoDi)).toEqual(['carriola', 'pernacchia']);
    expect(v.guaiFuoriGioco.map(tipoDi)).toEqual(['volpe-gentile', 'spuntatina']);
    expect(v.datiRound.giocate.g1).toEqual([campanaccio]);
    expect(v.datiRound.punteggi.g1).toContainEqual(expect.objectContaining({ tipo: 'valore', delta: 4, carta: campanaccio }));
    expect(v.pila).toHaveLength(1);
    expect(v.pila[0]).toMatchObject({
      autore: 'g1',
      dettagli: { tipo: 'effetto_trovata', carta: campanaccio, effetto: 'sposta_agnellino', bersaglio: 'g2' },
    });
    expect(ordinati(v.finestra?.inAttesa ?? [])).toEqual(['g2', 'g3']);
    expect(azioniPossibili(s, 'g4')).toEqual([]);
    for (const per of [...ids(s), null]) controllaVista(s, per);
  });

  it('vista.attesa coincide con inAttesaDi in ogni fase, per ogni giocatore e per il tavolo', () => {
    for (const [nome, s] of statiCampione()) {
      for (const per of [...ids(s), null]) expect(vistaPer(s, per).attesa, `${nome}, vista di ${per}`).toEqual(inAttesaDi(s));
    }
  });

  it('in ogni fase le viste nascondono solo ciò che è segreto (controllo completo su tutti gli stati campione)', () => {
    for (const [, s] of statiCampione()) for (const per of [...ids(s), null]) controllaVista(s, per);
  });
});

// ─── inAttesaDi ──────────────────────────────────────────────────────────────

describe('inAttesaDi (specifica §11)', () => {
  const soloSistema: Attesa = { sistema: true, giocatori: [] };
  const giocatori = (...g: IdGiocatore[]): Attesa => ({ sistema: false, giocatori: ordinati(g) });

  it('fasi automatiche (guaio, rivelazione, guaio_al_peggiore, fine_round, ultimo_round) ⇒ solo il sistema', () => {
    const guaio = scenario({ guaio: GUAIO_NEUTRO, mani: TRE_SENZA_EFFETTI });
    expect(attesaOrdinata(guaio)).toEqual(soloSistema);
    const rivelazione = scegli(prosegui(guaio), TRE_SENZA_EFFETTI);
    fase(rivelazione, 'rivelazione');
    expect(attesaOrdinata(rivelazione)).toEqual(soloSistema);
    expect(attesaOrdinata(inGuaioAlPeggiore())).toEqual(soloSistema);
    expect(attesaOrdinata(inFineRound())).toEqual(soloSistema);
    expect(attesaOrdinata(inUltimoRound())).toEqual(soloSistema);
  });

  it('scelta ⇒ i partecipanti che non hanno ancora scelto; chi è fuori dal round non è atteso', () => {
    const s = inSceltaConGemelle();
    expect(attesaOrdinata(s)).toEqual(giocatori('g1', 'g2', 'g3'));
    const dopo = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    expect(attesaOrdinata(dopo)).toEqual(giocatori('g2', 'g3'));
  });

  it('effetti ⇒ il proprietario della voce corrente; finestra aperta ⇒ finestra.inAttesa', () => {
    const effetti = inEffettiCampanaccio();
    expect(attesaOrdinata(effetti)).toEqual(giocatori('g1'));
    const finestra = attivaCampanaccio(effetti);
    expect(attesaOrdinata(finestra)).toEqual(giocatori('g2', 'g3'));
    expect(attesaOrdinata(finestra)).toEqual(giocatori(...(finestra.finestra?.inAttesa ?? [])));
    const contro = applica(finestra, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(finestra, 'g2', 'beee-no'), voce: cima(finestra) });
    expect(attesaOrdinata(contro)).toEqual(giocatori('g1', 'g3'));
    const passato = applica(contro, { tipo: 'passa', giocatore: 'g3' });
    expect(attesaOrdinata(passato)).toEqual(giocatori('g1'));
  });

  it('richiesta privata ⇒ il giocatore della richiesta', () => {
    expect(attesaOrdinata(inGuardaDue().s)).toEqual(giocatori('g1'));
  });

  it('belati_punteggio ⇒ fase.inAttesa (tutti i non eliminati, anche chi è fuori dal round)', () => {
    const s = inPunteggioQuattro();
    expect(attesaOrdinata(s)).toEqual(giocatori('g1', 'g2', 'g3', 'g4'));
    const dopo = applica(s, { tipo: 'passa', giocatore: 'g4' });
    expect(attesaOrdinata(dopo)).toEqual(giocatori('g1', 'g2', 'g3'));
    expect(attesaOrdinata(dopo)).toEqual(giocatori(...fase(dopo, 'belati_punteggio').inAttesa));
  });

  it('dado e risoluzione_dado (dichiarazione, esito della Testata) ⇒ il lanciatore; reazione ⇒ la finestra', () => {
    expect(attesaOrdinata(alDadoBase())).toEqual(giocatori('g1'));
    const dichiarazione = inDichiarazioneTestata();
    expect(attesaOrdinata(dichiarazione)).toEqual(giocatori('g1'));
    const reazione = applica(dichiarazione, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' });
    expect(attesaOrdinata(reazione)).toEqual(giocatori('g2', 'g3'));
    expect(attesaOrdinata(inEsitoTestata())).toEqual(giocatori('g1'));
  });

  it('belato_finale ⇒ i partecipanti allo spareggio che non hanno ancora scelto', () => {
    const s = inBelatoFinale();
    expect(attesaOrdinata(s)).toEqual(giocatori('g2', 'g3'));
    const dopo = applica(s, { tipo: 'sceltaFinale', giocatore: 'g3', carta: carta(s, 'g3', 'balla-di-fieno') });
    expect(attesaOrdinata(dopo)).toEqual(giocatori('g2'));
  });

  it('belati_salvataggio e consolazione ⇒ il destinatario', () => {
    expect(attesaOrdinata(inSalvataggio())).toEqual(giocatori('g2'));
    expect(attesaOrdinata(inConsolazione())).toEqual(giocatori('g2'));
  });

  it('fine_partita ⇒ nessuno', () => {
    expect(inAttesaDi(partitaFinita())).toEqual({ sistema: false, giocatori: [] });
  });

  it('in tutti gli stati campione inAttesaDi segue la tabella della specifica', () => {
    for (const [, s] of statiCampione()) controllaAttesa(s);
  });
});

// ─── azioniPossibili ─────────────────────────────────────────────────────────

describe('azioniPossibili (specifica §2): ogni azione elencata è accettata da applica', () => {
  it('guaio e rivelazione: il sistema ha solo prosegui, i giocatori nulla', () => {
    const guaio = scenario({ guaio: GUAIO_NEUTRO, mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] } });
    for (const s of [guaio, scegli(prosegui(guaio), TRE_SENZA_EFFETTI)]) {
      const di = controlla(s);
      expect(di('sistema')).toEqual([{ tipo: 'prosegui' }]);
      for (const g of ids(s)) expect(di(g), `${s.fase.nome}, ${g}`).toEqual([]);
    }
  });

  it('scelta: ogni Trovata singola e ogni coppia di Gemelle (anche uguali), mai Belati; niente per chi è fuori (D9, D34)', () => {
    const s = inSceltaConGemelle();
    const di = controlla(s);
    const sceglie = (giocatore: IdGiocatore, ...carte: IdTipoCarta[]): Azione => ({ tipo: 'scegliTrovata', giocatore, carte });
    expect(chiaviDi(di('g1'))).toEqual(
      chiaviDi([
        sceglie('g1', 'ciliegie-appaiate'),
        sceglie('g1', 'pantofola-gemella'),
        sceglie('g1', 'calzino-gemello'),
        sceglie('g1', 'carriola'),
        sceglie('g1', 'ciliegie-appaiate', 'pantofola-gemella'),
        sceglie('g1', 'ciliegie-appaiate', 'calzino-gemello'),
        sceglie('g1', 'pantofola-gemella', 'calzino-gemello'),
      ]),
    );
    expect(chiaviDi(di('g2'))).toEqual(
      chiaviDi([
        sceglie('g2', 'orecchino-gemello'),
        sceglie('g2', 'balla-di-fieno'),
        sceglie('g2', 'orecchino-gemello', 'orecchino-gemello'),
      ]),
    );
    expect(chiaviDi(di('g3'))).toEqual(chiaviDi([sceglie('g3', 'coperta-di-lana')]));
    expect(di('g4')).toEqual([]);
    expect(di('sistema')).toEqual([]);
    for (const a of di('g1')) if (a.tipo === 'scegliTrovata') expect(new Set(a.carte).size).toBe(a.carte.length);

    // Dopo aver scelto si può ancora cambiare (D40).
    const dopo = applica(s, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'carriola')] });
    expect(chiaviDi(controlla(dopo)('g1'))).toEqual(chiaviDi(di('g1')));
  });

  it('effetti con bersaglio: attiva su ogni avversario con agnellini oppure rinuncia; gli altri nulla', () => {
    const s = inEffettiCampanaccio();
    const di = controlla(s);
    expect(chiaviDi(di('g1'))).toEqual(
      chiaviDi([
        { tipo: 'attivaEffetto', giocatore: 'g1', carta: 'campanaccio-stonato', bersaglio: 'g2' },
        { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: 'campanaccio-stonato' },
      ]),
    );
    expect(di('g2')).toEqual([]);
    expect(di('g3')).toEqual([]);
    expect(di('sistema')).toEqual([]);
  });

  it('finestra con Beee-NO! in mano: solo chi è in attesa risponde, l\'autore della cima no (D5, D7)', () => {
    const finestra = attivaCampanaccio(inEffettiCampanaccio());
    const di = controlla(finestra);
    expect(chiaviDi(di('g2'))).toEqual(
      chiaviDi([
        { tipo: 'passa', giocatore: 'g2', voce: cima(finestra) },
        { tipo: 'giocaBelato', giocatore: 'g2', carta: 'beee-no', voce: cima(finestra) },
      ]),
    );
    expect(chiaviDi(di('g3'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g3', voce: cima(finestra) }]));
    expect(di('g1')).toEqual([]); // autore della cima, anche se ha un Beee-NO!
    expect(di('sistema')).toEqual([{ tipo: 'scadenza' }]);

    // Beee-NO! di g2: ora l'autore della cima è g2 e g1 può rispondere (D5, D6).
    const contro = applica(finestra, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(finestra, 'g2', 'beee-no'), voce: cima(finestra) });
    const di2 = controlla(contro);
    expect(chiaviDi(di2('g1'))).toEqual(
      chiaviDi([
        { tipo: 'passa', giocatore: 'g1', voce: cima(contro) },
        { tipo: 'giocaBelato', giocatore: 'g1', carta: 'beee-no', voce: cima(contro) },
      ]),
    );
    expect(di2('g2')).toEqual([]);
    expect(chiaviDi(di2('g3'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g3', voce: cima(contro) }]));
    expect(di2('sistema')).toEqual([{ tipo: 'scadenza' }]);
  });

  it('belati_punteggio: passa e Belati di punteggio solo su partecipanti, anche da chi è fuori dal round (§4.5, D15, D34)', () => {
    const s = inPunteggioQuattro();
    const di = controlla(s);
    const partecipanti = ['g1', 'g2', 'g3'];
    const piuMeno = (giocatore: IdGiocatore, tipoCarta: IdTipoCarta): Azione[] =>
      partecipanti.map((bersaglio) => ({ tipo: 'giocaBelato', giocatore, carta: tipoCarta, bersaglio }));
    expect(chiaviDi(di('g1'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g1', voce: null }, ...piuMeno('g1', 'belato-di-gruppo')]));
    expect(chiaviDi(di('g2'))).toEqual(
      chiaviDi([
        { tipo: 'passa', giocatore: 'g2', voce: null },
        { tipo: 'giocaBelato', giocatore: 'g2', carta: 'mondo-alla-rovescia' },
      ]),
    );
    // Né Faccio finta di niente, né Beee-NO! (pila vuota), né Visita di Garzina.
    expect(chiaviDi(di('g3'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g3', voce: null }, ...piuMeno('g3', 'pernacchia')]));
    expect(chiaviDi(di('g4'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g4', voce: null }, ...piuMeno('g4', 'belato-di-gruppo')]));
    expect(di('sistema')).toEqual([{ tipo: 'scadenza' }]);
  });

  it('belati_punteggio con un Belato in pila: solo passa e Beee-NO!, il sistema ha scadenza (§5)', () => {
    const s0 = inPunteggioQuattro();
    const s = applica(s0, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(s0, 'g1', 'belato-di-gruppo'), bersaglio: 'g2' });
    const di = controlla(s);
    expect(di('g1')).toEqual([]);
    expect(chiaviDi(di('g2'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g2', voce: cima(s) }]));
    expect(chiaviDi(di('g3'))).toEqual(
      chiaviDi([
        { tipo: 'passa', giocatore: 'g3', voce: cima(s) },
        { tipo: 'giocaBelato', giocatore: 'g3', carta: 'beee-no', voce: cima(s) },
      ]),
    );
    expect(chiaviDi(di('g4'))).toEqual(chiaviDi([{ tipo: 'passa', giocatore: 'g4', voce: cima(s) }]));
    expect(di('sistema')).toEqual([{ tipo: 'scadenza' }]);
  });

  it('dado: solo il lanciatore, con lanciaDado', () => {
    const di = controlla(alDadoBase());
    expect(di('g1')).toEqual([{ tipo: 'lanciaDado', giocatore: 'g1' }]);
    expect(di('g2')).toEqual([]);
    expect(di('g3')).toEqual([]);
    expect(di('sistema')).toEqual([]);
  });

  it('dichiarazione del Furto piccolo con due avversari: tutte e tre le ripartizioni (§4.7, D20)', () => {
    const s = lancia(alDadoBase(), 'furto_piccolo');
    expect(fase(s, 'risoluzione_dado')).toMatchObject({ lanciatore: 'g1', faccia: 'furto_piccolo', passo: 'dichiarazione' });
    const di = controlla(s);
    const furto = (f: Record<IdGiocatore, number>): Azione => ({ tipo: 'dichiaraDado', giocatore: 'g1', furto: f });
    expect(chiaviDi(di('g1'))).toEqual(chiaviDi([furto({ g2: 2, g3: 0 }), furto({ g2: 1, g3: 1 }), furto({ g2: 0, g3: 2 })]));
    expect(di('g2')).toEqual([]);
    expect(di('sistema')).toEqual([]);
  });

  it('dichiarazione del Furto grande a 4 giocatori con 1, 2 e 3 agnellini: le 5 ripartizioni valide (§4.7)', () => {
    const scelte: Mani = { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'], g4: ['trifoglio-qualunque'] };
    const dado = alDado(
      scenario({ giocatori: 4, guaio: GUAIO_NEUTRO, agnellini: { g2: 1, g3: 2, g4: 3 }, mani: scelte }),
      scelte,
    );
    const s = lancia(dado, 'furto_grande');
    expect(fase(s, 'risoluzione_dado').passo).toBe('dichiarazione');
    const di = controlla(s);
    const furto = (g2: number, g3: number, g4: number): Azione => ({ tipo: 'dichiaraDado', giocatore: 'g1', furto: { g2, g3, g4 } });
    expect(chiaviDi(di('g1'))).toEqual(
      chiaviDi([furto(0, 1, 3), furto(0, 2, 2), furto(1, 0, 3), furto(1, 1, 2), furto(1, 2, 1)]),
    );
  });

  it('Testata: ogni avversario con agnellini come bersaglio, poi ogni esito da 0 al massimo ammesso (§4.7, D21)', () => {
    const dichiarazione = inDichiarazioneTestata();
    const di = controlla(dichiarazione);
    expect(chiaviDi(di('g1'))).toEqual(
      chiaviDi([
        { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' },
        { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g3' },
      ]),
    );

    const reazione = applica(dichiarazione, { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' });
    const diReazione = controlla(reazione);
    expect(diReazione('sistema')).toEqual([{ tipo: 'scadenza' }]);
    expect(diReazione('g1')).toEqual([]);

    // Bersaglio g2 con 2 agnellini: esiti 0, 1, 2 (mai 3).
    const esito = inEsitoTestata();
    const diEsito = controlla(esito);
    const esitoTestata = (n: number): Azione => ({ tipo: 'esitoTestata', giocatore: 'g1', esito: n });
    expect(chiaviDi(diEsito('g1'))).toEqual(chiaviDi([esitoTestata(0), esitoTestata(1), esitoTestata(2)]));
    expect(() => applica(esito, esitoTestata(3))).toThrow(ErroreRegola);
    expect(diEsito('g2')).toEqual([]);
    expect(diEsito('sistema')).toEqual([]);
  });

  it('richiesta guarda_due: tenere l\'una o l\'altra carta; gli altri e il sistema nulla', () => {
    const { s, guardate } = inGuardaDue();
    const di = controlla(s);
    expect(chiaviDi(di('g1'))).toEqual(chiaviDi(guardate.map((c): Azione => ({ tipo: 'completaEffetto', giocatore: 'g1', carte: [c] }))));
    expect(di('g2')).toEqual([]);
    expect(di('g3')).toEqual([]);
    expect(di('sistema')).toEqual([]);
  });

  it('richiesta scarta_fino_a_tre: tutti i sottoinsiemi da 0 a 3 carte della mano (§2)', () => {
    let s = finoAgliEffetti(
      scenario({
        guaio: GUAIO_NEUTRO,
        mani: {
          g1: ['pulizie-di-primavera', 'carriola', 'beee-no', 'balla-di-fieno', 'trifoglio-qualunque'],
          g2: ['coperta-di-lana'],
          g3: ['ombrello-bucato'],
        },
      }),
      { g1: ['pulizie-di-primavera'], g2: ['coperta-di-lana'], g3: ['ombrello-bucato'] },
    );
    s = nessunaReazione(applica(s, { tipo: 'attivaEffetto', giocatore: 'g1', carta: voceCorrente(s).carta }));
    expect(s.richiesta?.tipo).toBe('scarta_fino_a_tre');
    const di = controlla(s);
    const attese = sottoinsiemi(mano(s, 'g1'), 3).map((carte): Azione => ({ tipo: 'completaEffetto', giocatore: 'g1', carte }));
    expect(attese).toHaveLength(15);
    expect(chiaviDi(di('g1'))).toEqual(chiaviDi(attese));
    expect(di('sistema')).toEqual([]);
  });

  it('belato_finale: una sola Trovata alla volta, anche una Gemella da sola; mai Belati (§4.9, D24)', () => {
    const s = inBelatoFinale();
    const di = controlla(s);
    const finale = (giocatore: IdGiocatore, tipoCarta: IdTipoCarta): Azione => ({ tipo: 'sceltaFinale', giocatore, carta: tipoCarta });
    expect(chiaviDi(di('g2'))).toEqual(chiaviDi([finale('g2', 'balla-di-fieno'), finale('g2', 'coperta-di-lana')]));
    expect(chiaviDi(di('g3'))).toEqual(chiaviDi([finale('g3', 'balla-di-fieno'), finale('g3', 'orecchino-gemello')]));
    expect(di('g1')).toEqual([]);
    expect(di('sistema')).toEqual([]);

    // Dopo il pareggio si ripete: restano le carte non ancora giocate.
    const s2 = applica(
      applica(s, { tipo: 'sceltaFinale', giocatore: 'g2', carta: carta(s, 'g2', 'balla-di-fieno') }),
      { tipo: 'sceltaFinale', giocatore: 'g3', carta: carta(s, 'g3', 'balla-di-fieno') },
    );
    const di2 = controlla(s2);
    expect(chiaviDi(di2('g2'))).toEqual(chiaviDi([finale('g2', 'coperta-di-lana')]));
    expect(chiaviDi(di2('g3'))).toEqual(chiaviDi([finale('g3', 'orecchino-gemello')]));
  });

  it('belati_salvataggio: passa, Faccio finta di niente, Finta svenuta su ogni altro partecipante (§4.10, D26)', () => {
    const s = inSalvataggio();
    const di = controlla(s);
    expect(chiaviDi(di('g2'))).toEqual(
      chiaviDi([
        { tipo: 'passa', giocatore: 'g2', voce: null },
        { tipo: 'giocaBelato', giocatore: 'g2', carta: 'faccio-finta-di-niente' },
        { tipo: 'giocaBelato', giocatore: 'g2', carta: 'finta-svenuta', bersaglio: 'g1' },
        { tipo: 'giocaBelato', giocatore: 'g2', carta: 'finta-svenuta', bersaglio: 'g3' },
      ]),
    );
    expect(di('g1')).toEqual([]);
    expect(di('g3')).toEqual([]);
    expect(di('sistema')).toEqual([]);
  });

  it('consolazione: Visita di Garzina su ogni Guaio dell\'Angolo, concludi con o senza scarto (§4.11, D37)', () => {
    const s = inConsolazione();
    const angolo = gioc(s, 'g2').angolo;
    expect(angolo.map(tipoDi)).toEqual(['grandine-a-sorpresa', 'tosatura-a-sorpresa']);
    const di = controlla(s);
    const conclude = (scarta: IdTipoCarta | null): Azione => ({ tipo: 'concludiConsolazione', giocatore: 'g2', scarta });
    expect(chiaviDi(di('g2'))).toEqual(
      chiaviDi([
        ...angolo.map((guaio): Azione => ({ tipo: 'giocaBelato', giocatore: 'g2', carta: 'visita-di-garzina', guaio })),
        conclude(null),
        conclude('faccio-finta-di-niente'),
        conclude('finta-svenuta'),
        conclude('beee-no'),
        conclude('belato-di-gruppo'),
        conclude('visita-di-garzina'),
      ]),
    );
    expect(di('g1')).toEqual([]);
    expect(di('g3')).toEqual([]);
    expect(di('sistema')).toEqual([]);
  });

  it('fasi automatiche di fine round (guaio_al_peggiore, fine_round, ultimo_round): solo prosegui del sistema', () => {
    for (const s of [inGuaioAlPeggiore(), inFineRound(), inUltimoRound()]) {
      const di = controlla(s);
      expect(di('sistema'), s.fase.nome).toEqual([{ tipo: 'prosegui' }]);
      for (const g of ids(s)) expect(di(g), `${s.fase.nome}, ${g}`).toEqual([]);
    }
  });

  it('fine_partita: nessuna azione per nessuno', () => {
    const s = partitaFinita();
    const di = controlla(s);
    for (const chi of [...ids(s), 'sistema']) expect(di(chi), chi).toEqual([]);
  });

  it('in tutti gli stati campione ogni azione elencata è accettata e chi è atteso ha almeno un\'azione', () => {
    for (const [, s] of statiCampione()) controlla(s);
  });
});

// ─── Purezza, errori, tentaApplica ───────────────────────────────────────────

/**
 * Un round completo con Beee-NO! su un effetto, dado, Guaio, consolazione e pescate,
 * eseguito con la funzione `esegui` (che applica l'azione allo stato corrente).
 */
function roundCompleto(esegui: (s: Stato, a: Azione) => Stato): Stato {
  let s = scenario({
    guaio: GUAIO_NEUTRO,
    mani: { g1: ['campanaccio-stonato'], g2: ['balla-di-fieno', 'beee-no'], g3: ['carriola', 'beee-no'] },
  });
  const fai = (a: Azione): void => {
    s = esegui(s, a);
  };
  fai({ tipo: 'prosegui' });
  fai({ tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(s, 'g1', 'campanaccio-stonato')] });
  fai({ tipo: 'scegliTrovata', giocatore: 'g2', carte: [carta(s, 'g2', 'balla-di-fieno')] });
  fai({ tipo: 'scegliTrovata', giocatore: 'g3', carte: [carta(s, 'g3', 'carriola')] });
  fai({ tipo: 'prosegui' });
  fai({ tipo: 'attivaEffetto', giocatore: 'g1', carta: voceCorrente(s).carta, bersaglio: 'g2' });
  fai({ tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'beee-no'), voce: cima(s) });
  fai({ tipo: 'passa', giocatore: 'g1' });
  fai({ tipo: 'passa', giocatore: 'g3' });
  fase(s, 'belati_punteggio');
  fai({ tipo: 'scadenza' });
  s = conFaccia(s, 'pascolo_grande');
  fai({ tipo: 'lanciaDado', giocatore: 'g3' });
  fai({ tipo: 'scadenza' });
  fai({ tipo: 'prosegui' });
  fai({ tipo: 'passa', giocatore: 'g1' });
  fai({ tipo: 'concludiConsolazione', giocatore: 'g1', scarta: null });
  fase(s, 'fine_round');
  fai({ tipo: 'prosegui' });
  return s;
}

function controllaFineRoundCompleto(s: Stato): void {
  expect(s.fase.nome).toBe('guaio');
  expect(s.round).toBe(2);
  expect(gioc(s, 'g3').agnellini).toBe(8); // 3 + Pascolo grande
  expect(gioc(s, 'g2').agnellini).toBe(3); // Campanaccio annullato dal Beee-NO!
  expect(gioc(s, 'g1').agnellini).toBe(4); // 3 + consolazione
  expect(gioc(s, 'g1').angolo.map(tipoDi)).toEqual([GUAIO_NEUTRO]);
}

describe('Purezza e determinismo (specifica §1)', () => {
  it('applica non modifica lo stato ricevuto: snapshot JSON identico prima e dopo, lungo un round completo', () => {
    const fine = roundCompleto((s, a) => {
      const prima = JSON.stringify(s);
      const dopo = applica(s, a);
      expect(JSON.stringify(s), `stato modificato da ${JSON.stringify(a)}`).toBe(prima);
      expect(dopo).not.toBe(s);
      return dopo;
    });
    controllaFineRoundCompleto(fine);
  });

  it('applica funziona su stati congelati in profondità (nessuna scrittura sull\'argomento)', () => {
    controllaFineRoundCompleto(roundCompleto((s, a) => applica(congela(s), a)));
  });

  it('prosegui con ripescata non modifica lo stato ricevuto', () => {
    const s = scenario({
      guaio: GUAIO_NEUTRO,
      mani: { g1: ['carriola'], g2: ['balla-di-fieno'], g3: ['beee-no'] },
      mazzo: ['pernacchia', 'coperta-di-lana', 'sasso-comodo', 'ombrello-bucato', 'carriola', 'corona-di-margherite'],
    });
    const prima = JSON.stringify(s);
    const dopo = applica(congela(s), { tipo: 'prosegui' });
    expect(JSON.stringify(s)).toBe(prima);
    expect(mano(dopo, 'g3')).toHaveLength(5);
  });

  it('vistaPer, inAttesaDi e azioniPossibili non modificano lo stato (stati congelati)', () => {
    for (const [nome, s] of statiCampione()) {
      const prima = JSON.stringify(s);
      congela(s);
      expect(() => {
        for (const per of [...ids(s), null]) vistaPer(s, per);
        inAttesaDi(s);
        for (const chi of [...ids(s), 'sistema']) azioniPossibili(s, chi);
      }, nome).not.toThrow();
      expect(JSON.stringify(s), nome).toBe(prima);
    }
  });

  it('stesso stato + stessa azione ⇒ stesso risultato, anche per il lancio del dado', () => {
    const dado = alDadoBase();
    const lancio: Azione = { tipo: 'lanciaDado', giocatore: 'g1' };
    expect(applica(dado, lancio)).toEqual(applica(dado, lancio));
    const guaio = scenario({ guaio: GUAIO_NEUTRO, mani: TRE_SENZA_EFFETTI });
    expect(applica(guaio, { tipo: 'prosegui' })).toEqual(applica(guaio, { tipo: 'prosegui' }));
  });
});

describe('Azioni non valide e tentaApplica (specifica §1, §13)', () => {
  it('azione non valida: ErroreRegola e stato originale intatto', () => {
    const guaio = scenario({
      guaio: GUAIO_NEUTRO,
      mani: { g1: ['carriola', 'beee-no'], g2: ['balla-di-fieno'], g3: ['coperta-di-lana'] },
    });
    const scelta = prosegui(guaio);
    const effetti = inEffettiCampanaccio();
    const finestra = attivaCampanaccio(effetti);
    const campanaccio = voceCorrente(effetti).carta;
    const casi: Array<[string, Stato, Azione]> = [
      ['scelta in fase guaio', guaio, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(guaio, 'g1', 'carriola')] }],
      ['dado in fase guaio', guaio, { tipo: 'lanciaDado', giocatore: 'g1' }],
      ['azione sconosciuta', guaio, { tipo: 'vola' } as unknown as Azione],
      ['prosegui in scelta', scelta, { tipo: 'prosegui' }],
      ['Belato come Trovata', scelta, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(scelta, 'g1', 'beee-no')] }],
      ['carta altrui', scelta, { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carta(scelta, 'g2', 'balla-di-fieno')] }],
      ['giocatore inesistente', scelta, { tipo: 'scegliTrovata', giocatore: 'g9', carte: [carta(scelta, 'g1', 'carriola')] }],
      ['Beee-NO! a pila vuota', scelta, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(scelta, 'g1', 'beee-no'), voce: 1 }],
      ['sposta senza bersaglio', effetti, { tipo: 'attivaEffetto', giocatore: 'g1', carta: campanaccio }],
      ['effetto non proprio', effetti, { tipo: 'attivaEffetto', giocatore: 'g2', carta: campanaccio, bersaglio: 'g1' }],
      ['Beee-NO! dell\'autore', finestra, { tipo: 'giocaBelato', giocatore: 'g1', carta: carta(finestra, 'g1', 'beee-no'), voce: cima(finestra) }],
      ['voce non in cima', finestra, { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(finestra, 'g2', 'beee-no'), voce: cima(finestra) + 1 }],
      ['prosegui con la pila piena', finestra, { tipo: 'prosegui' }],
    ];
    for (const [nome, s, a] of casi) {
      const prima = JSON.stringify(s);
      expect(() => applica(s, a), nome).toThrow(ErroreRegola);
      expect(JSON.stringify(s), nome).toBe(prima);
    }
  });

  it('tentaApplica: ok:true con lo stesso stato di applica; ok:false con ErroreRegola, senza lanciare', () => {
    const s = scenario({ guaio: GUAIO_NEUTRO, mani: TRE_SENZA_EFFETTI });
    const prima = JSON.stringify(s);

    const valida = tentaApplica(s, { tipo: 'prosegui' });
    expect(valida.ok).toBe(true);
    if (valida.ok) expect(valida.stato).toEqual(applica(s, { tipo: 'prosegui' }));

    for (const a of [{ tipo: 'lanciaDado', giocatore: 'g1' }, { tipo: 'vola' } as unknown as Azione] as Azione[]) {
      let r: ReturnType<typeof tentaApplica> | undefined;
      expect(() => {
        r = tentaApplica(s, a);
      }).not.toThrow();
      expect(r?.ok).toBe(false);
      if (r && !r.ok) {
        expect(r.errore).toBeInstanceOf(ErroreRegola);
        expect(typeof r.errore.codice).toBe('string');
        expect(r.errore.codice.length).toBeGreaterThan(0);
      }
    }
    expect(JSON.stringify(s)).toBe(prima);
  });

  it('dopo fine_partita ogni azione è rifiutata (partita_finita) e lo stato resta com\'è', () => {
    const s = partitaFinita();
    expect(s.pila).toEqual([]);
    expect(s.finestra).toBeNull();
    expect(s.richiesta).toBeNull();
    const prima = JSON.stringify(s);
    const carriola = carta(s, 'g1', 'carriola');
    const tutte: Azione[] = [
      { tipo: 'prosegui' },
      { tipo: 'scadenza' },
      { tipo: 'scegliTrovata', giocatore: 'g1', carte: [carriola] },
      { tipo: 'attivaEffetto', giocatore: 'g1', carta: carriola },
      { tipo: 'rinunciaEffetto', giocatore: 'g1', carta: carriola },
      { tipo: 'completaEffetto', giocatore: 'g1', carte: [] },
      { tipo: 'giocaBelato', giocatore: 'g2', carta: carta(s, 'g2', 'belato-di-gruppo'), bersaglio: 'g1' },
      { tipo: 'giocaBelato', giocatore: 'g3', carta: carta(s, 'g3', 'beee-no'), voce: s.prossimaVoce - 1 },
      { tipo: 'passa', giocatore: 'g2' },
      { tipo: 'lanciaDado', giocatore: 'g1' },
      { tipo: 'dichiaraDado', giocatore: 'g1', bersaglio: 'g2' },
      { tipo: 'esitoTestata', giocatore: 'g1', esito: 0 },
      { tipo: 'sceltaFinale', giocatore: 'g1', carta: carriola },
      { tipo: 'concludiConsolazione', giocatore: 'g2', scarta: null },
    ];
    for (const a of tutte) {
      expect(() => applica(s, a), a.tipo).toThrow(ErroreRegola);
      const r = tentaApplica(s, a);
      expect(r.ok, a.tipo).toBe(false);
      if (!r.ok) expect(r.errore).toBeInstanceOf(ErroreRegola);
    }
    expect(JSON.stringify(s)).toBe(prima);
  });
});

// ─── Aiuti dell'API ──────────────────────────────────────────────────────────

describe('Aiuti dell\'API (specifica §2)', () => {
  it('eFaseAutomatica: vero solo per guaio, rivelazione, guaio_al_peggiore, fine_round, ultimo_round', () => {
    const automatiche: NomeFase[] = ['guaio', 'rivelazione', 'guaio_al_peggiore', 'fine_round', 'ultimo_round'];
    const altre: NomeFase[] = [
      'scelta',
      'effetti',
      'belati_punteggio',
      'dado',
      'risoluzione_dado',
      'belato_finale',
      'belati_salvataggio',
      'consolazione',
      'fine_partita',
    ];
    for (const n of automatiche) expect(eFaseAutomatica(n), n).toBe(true);
    for (const n of altre) expect(eFaseAutomatica(n), n).toBe(false);
  });

  it('postiLiberi = posti dell\'Ovile − agnellini (15 a 3 giocatori, 18 a 2)', () => {
    const s = scenario({ agnellini: { g1: 5, g2: 0 } });
    expect(postiLiberi(s, 'g1')).toBe(10);
    expect(postiLiberi(s, 'g2')).toBe(15);
    expect(postiLiberi(s, 'g3')).toBe(12);
    expect(postiLiberi(scenario({ giocatori: 2 }), 'g1')).toBe(15);
  });

  it('punteggioTotale: somma delle righe del round, 0 per chi non partecipa', () => {
    const s = inPunteggioQuattro();
    expect(punteggioTotale(s, 'g1')).toBe(8);
    expect(punteggioTotale(s, 'g2')).toBe(5);
    expect(punteggioTotale(s, 'g3')).toBe(6);
    expect(punteggioTotale(s, 'g4')).toBe(0);
  });
});
