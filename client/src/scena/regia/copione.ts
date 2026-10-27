// Il copione: dagli eventi del motore alle battute da recitare nella scena (funzione pura, senza DOM).
// Riceve gli eventi già filtrati (solo quelli nuovi) e la vista del tavolo, che è pubblica:
// nessuna carta di mani private può finire in una battuta.
import { tipoDi } from '../../../../engine/src';
import type { Evento, IdCarta, IdGiocatore, Luogo, Vista } from '../../../../engine/src';
import { nomeCarta } from '../../partita/descrizioni';
import { T } from '../../testi';
import { EFFETTI_GUAIO } from '../meteo/indice';

/** Quanto aspetta il regista prima della battuta successiva. */
export type Attesa = { tipo: 'fine' } | { tipo: 'massimo'; ms: number } | { tipo: 'niente' };

export type Battuta =
  | { tipo: 'guaioRivelato'; carta: IdCarta; attesa: Attesa }
  | { tipo: 'annuncio'; testo: string; attesa: Attesa }
  | { tipo: 'giraCarte'; carte: Partial<Record<IdGiocatore, IdCarta[]>>; attesa: Attesa }
  | { tipo: 'fumetti'; testi: Partial<Record<IdGiocatore, string>>; attesa: Attesa }
  | { tipo: 'volaCarta'; daChi: IdGiocatore; carta: IdCarta; testo: string | null; attesa: Attesa }
  /** L'annullamento: `chi` ha giocato il Beee-NO!, `annullato` aveva fatto la voce annullata (`carta` null per il dado). */
  | { tipo: 'beeeNo'; chi: IdGiocatore; annullato: IdGiocatore | null; carta: IdCarta | null; attesa: Attesa }
  | { tipo: 'dado'; faccia: string; attesa: Attesa }
  | {
      tipo: 'agnellini';
      spostamenti: Array<{ da: Luogo; a: Luogo; quanti: number }>;
      ladro: IdGiocatore | null;
      modo: 'corre' | 'vola';
      attesa: Attesa;
    }
  /** `seq` dell'evento `testata`: sceglie il punto d'arrivo "di scena", lo stesso su tutti i telefoni. */
  | { tipo: 'testata'; chi: IdGiocatore; bersaglio: IdGiocatore; quanti: number; seq: number; attesa: Attesa }
  | { tipo: 'guaio'; carta: IdCarta; chi: IdGiocatore; deviatoDa: IdGiocatore | null; attesa: Attesa }
  | { tipo: 'eliminata'; chi: IdGiocatore; attesa: Attesa }
  | { tipo: 'festa'; vincitori: IdGiocatore[]; attesa: Attesa };

/** Quanto si aspetta, al massimo, un meteo (o il Lupo) prima di proseguire: tempo della scena. */
export const ATTESA_METEO_MS = 5000;
/** Quanto si aspetta, al massimo, un fumetto o un annuncio: tempo della scena. */
const ATTESA_FUMETTO_MS = 1200;

const FINE: Attesa = { tipo: 'fine' };
const BREVE: Attesa = { tipo: 'massimo', ms: ATTESA_FUMETTO_MS };

/** Il Guaio ha un effetto in scena (i 7 meteo e il Lupo vegetariano)? */
const haEffettoInScena = (carta: IdCarta): boolean => Object.hasOwn(EFFETTI_GUAIO, tipoDi(carta));

/** Chi ha fatto la dichiarazione di quella voce, e con quale carta (null per il dado): prima negli eventi in esame, poi nella vista. */
function voceDi(eventi: Evento[], v: Vista, voce: number): { autore: IdGiocatore; carta: IdCarta | null } | null {
  for (const lista of [eventi, v.eventi]) {
    for (const e of lista) {
      if (e.tipo === 'dichiarazione' && e.voce === voce) {
        return { autore: e.autore, carta: e.dettagli.tipo === 'dado' ? null : e.dettagli.carta };
      }
    }
  }
  const x = v.pila.find((p) => p.id === voce);
  return x ? { autore: x.autore, carta: x.dettagli.tipo === 'dado' ? null : x.dettagli.carta } : null;
}

/**
 * Chi ha deviato il Guaio su `chi`: il guaio_deviato più recente verso di lui, dopo l'ultimo Guaio rivelato o preso.
 * La deviazione e la presa del Guaio avvengono in azioni diverse (il nuovo destinatario deve prima passare):
 * si cerca quindi nello storico della vista oltre che negli eventi in esame.
 */
function chiHaDeviato(eventi: Evento[], v: Vista, seq: number, chi: IdGiocatore): IdGiocatore | null {
  const storia = new Map<number, Evento>();
  for (const e of [...v.eventi, ...eventi]) if (e.seq < seq) storia.set(e.seq, e);
  const ordinata = [...storia.values()].sort((a, b) => b.seq - a.seq);
  for (const e of ordinata) {
    if (e.tipo === 'guaio_preso' || e.tipo === 'guaio_rivelato') return null;
    if (e.tipo === 'guaio_deviato' && e.a === chi) return e.da;
  }
  return null;
}

/**
 * Gli agnellini che il furto dichiarato in `eventi[i]` sposta davvero (con i posti pieni sono meno di quelli dichiarati):
 * gli eventi `agnellini` di causa furto verso il ladro, nello stesso lotto, prima della dichiarazione successiva.
 * `null` se non ce ne sono (la dichiarazione è ancora in pila, o è stata annullata): vale allora ciò che dichiara il dado.
 * Di solito è così: il furto si dichiara e si risolve in azioni diverse (in mezzo c'è la finestra delle reazioni), quindi
 * in lotti diversi, e il fumetto (che va detto alla dichiarazione, prima che si sappia com'è finita) dice il dichiarato;
 * se poi ne arrivano meno, lo dice un secondo fumetto dopo la corsa (`furtoDichiaratoPrima`).
 * Il conto vero vale qui solo quando dichiarazione e spostamenti arrivano insieme: un telefono che recupera più mosse in una
 * volta, o la scena che riprende dopo essere rimasta indietro. Allora il primo fumetto è già giusto e il secondo non c'è.
 */
function furtoEffettivo(eventi: Evento[], i: number): number | null {
  const ladro = (eventi[i] as Extract<Evento, { tipo: 'dichiarazione' }>).autore;
  let spostati: number | null = null;
  for (let j = i + 1; j < eventi.length && eventi[j]!.tipo !== 'dichiarazione'; j++) {
    const f = eventi[j]!;
    if (f.tipo === 'agnellini' && f.causa === 'furto' && f.a === ladro) spostati = (spostati ?? 0) + f.quanti;
  }
  return spostati;
}

/**
 * Quanti agnellini aveva annunciato il furto che si risolve con gli spostamenti in `eventi[i]`, se la dichiarazione è
 * arrivata in un lotto precedente (sta solo nello storico della vista); `null` altrimenti. Il motore emette `risolta`
 * della voce subito prima degli spostamenti: si prende l'ultima `risolta` prima di `i` e la sua dichiarazione,
 * che dev'essere un furto del dado di questo ladro. Un furto annullato non sposta niente, quindi qui non arriva.
 */
function furtoDichiaratoPrima(eventi: Evento[], v: Vista, i: number): number | null {
  const ladro = (eventi[i] as Extract<Evento, { tipo: 'agnellini' }>).a;
  let voce: number | null = null;
  for (let j = i - 1; j >= 0 && voce === null; j--) {
    const e = eventi[j]!;
    if (e.tipo === 'risolta') voce = e.voce;
  }
  if (voce === null) return null;
  // Dichiarata in questo lotto: il primo fumetto ha già contato gli spostamenti veri
  if (eventi.some((e) => e.tipo === 'dichiarazione' && e.voce === voce)) return null;
  const dich = v.eventi.find((e): e is Extract<Evento, { tipo: 'dichiarazione' }> => e.tipo === 'dichiarazione' && e.voce === voce);
  if (!dich || dich.autore !== ladro || dich.dettagli.tipo !== 'dado' || dich.dettagli.dichiarazione.effetto !== 'furto') return null;
  const d = dich.dettagli.dichiarazione;
  return Object.values(d.daAvversari).reduce((t, q) => t + q, 0) + d.dalGregge;
}

export function copione(eventi: Evento[], vista: Vista): Battuta[] {
  const battute: Battuta[] = [];

  for (let i = 0; i < eventi.length; i++) {
    const e = eventi[i]!;
    switch (e.tipo) {
      // "Ultimo round!" quando comincia davvero (una volta sola per partita). ultimo_round_annunciato non dà una
      // battuta: arriva quando il mazzo finisce, e una Trovata che pesca può svuotarlo a metà di un round normale
      case 'round_iniziato':
        if (e.ultimo) battute.push({ tipo: 'annuncio', testo: T.scena.annunci.ultimoRound, attesa: BREVE });
        break;
      case 'guaio_rivelato':
        if (e.carta) battute.push({ tipo: 'guaioRivelato', carta: e.carta, attesa: FINE });
        break;
      case 'rivelazione': {
        const carte: Partial<Record<IdGiocatore, IdCarta[]>> = {};
        for (const [id, c] of Object.entries(e.giocate)) carte[id] = [...c];
        battute.push({ tipo: 'giraCarte', carte, attesa: FINE });
        // Le righe di base che seguono subito: un solo fumetto con il totale di ciascuno
        const testi: Partial<Record<IdGiocatore, string>> = {};
        let j = i + 1;
        for (; eventi[j]?.tipo === 'punteggio'; j++) {
          const p = eventi[j] as Extract<Evento, { tipo: 'punteggio' }>;
          testi[p.giocatore] = T.scena.fumetti.punteggio(p.totale);
        }
        if (j > i + 1) battute.push({ tipo: 'fumetti', testi, attesa: BREVE });
        i = j - 1;
        break;
      }
      case 'punteggio': {
        // Fuori dalla rivelazione (Belati, effetti): la variazione sopra chi la riceve
        const delta: Record<IdGiocatore, number> = {};
        let j = i;
        for (; eventi[j]?.tipo === 'punteggio'; j++) {
          const p = eventi[j] as Extract<Evento, { tipo: 'punteggio' }>;
          delta[p.giocatore] = (delta[p.giocatore] ?? 0) + p.riga.delta;
        }
        const testi: Partial<Record<IdGiocatore, string>> = {};
        for (const [id, d] of Object.entries(delta)) if (d !== 0) testi[id] = T.scena.fumetti.delta(d);
        if (Object.keys(testi).length > 0) battute.push({ tipo: 'fumetti', testi, attesa: BREVE });
        i = j - 1;
        break;
      }
      case 'dichiarazione': {
        const d = e.dettagli;
        if (d.tipo === 'dado') {
          const dich = d.dichiarazione;
          const testo =
            dich.effetto === 'pascolo'
              ? T.scena.fumetti.pascolo(dich.quantita)
              : dich.effetto === 'furto'
                ? T.scena.fumetti.furto(furtoEffettivo(eventi, i) ?? Object.values(dich.daAvversari).reduce((t, q) => t + q, 0) + dich.dalGregge)
                : T.scena.fumetti.testata;
          battute.push({ tipo: 'fumetti', testi: { [e.autore]: testo }, attesa: BREVE });
        } else {
          battute.push({ tipo: 'volaCarta', daChi: e.autore, carta: d.carta, testo: nomeCarta(d.carta), attesa: FINE });
        }
        break;
      }
      case 'annullata': {
        // Il Beee-NO! è già volato quando è stato giocato: qui esplode, e la carta annullata si scuote
        const beeeNo = voceDi(eventi, vista, e.da);
        const annullata = voceDi(eventi, vista, e.voce);
        if (beeeNo !== null) {
          battute.push({ tipo: 'beeeNo', chi: beeeNo.autore, annullato: annullata?.autore ?? null, carta: annullata?.carta ?? null, attesa: FINE });
        }
        break;
      }
      case 'dado_lanciato':
        battute.push({ tipo: 'dado', faccia: e.faccia, attesa: FINE });
        break;
      case 'agnellini': {
        if (e.quanti <= 0) break;
        if (e.causa === 'furto') {
          // I furti di una stessa dichiarazione (avversari e Gregge) sono un solo colpo del ladro
          const spostamenti: Array<{ da: Luogo; a: Luogo; quanti: number }> = [];
          let j = i;
          for (; j < eventi.length; j++) {
            const f = eventi[j]!;
            if (f.tipo !== 'agnellini' || f.causa !== 'furto' || f.a !== e.a) break;
            if (f.quanti > 0) spostamenti.push({ da: f.da, a: f.a, quanti: f.quanti });
          }
          battute.push({ tipo: 'agnellini', spostamenti, ladro: e.a, modo: 'corre', attesa: FINE });
          // Ne sono arrivati meno di quanti ne diceva il fumetto della dichiarazione: il ladro lo ammette
          const annunciati = furtoDichiaratoPrima(eventi, vista, i);
          const arrivati = spostamenti.reduce((t, s) => t + s.quanti, 0);
          if (annunciati !== null && arrivati < annunciati) {
            battute.push({ tipo: 'fumetti', testi: { [e.a]: T.scena.fumetti.furtoSolo(arrivati) }, attesa: BREVE });
          }
          i = j - 1;
        } else if (e.causa === 'testata') {
          // Di norma lo racconta la battuta della Testata, che segue subito
          if (eventi[i + 1]?.tipo !== 'testata') {
            battute.push({
              tipo: 'agnellini',
              spostamenti: [{ da: e.da, a: e.a, quanti: e.quanti }],
              ladro: null,
              modo: 'vola',
              attesa: FINE,
            });
          }
        } else {
          // La consolazione dopo un Guaio col meteo arriva mentre si gioca: la partita aspetta solo i primi 5 s
          const prima = battute[battute.length - 1];
          const dopoMeteo = e.causa === 'consolazione' && prima?.tipo === 'guaio' && prima.attesa.tipo === 'massimo';
          battute.push({
            tipo: 'agnellini',
            spostamenti: [{ da: e.da, a: e.a, quanti: e.quanti }],
            ladro: null,
            modo: 'corre',
            attesa: dopoMeteo ? { tipo: 'niente' } : FINE,
          });
        }
        break;
      }
      case 'testata':
        battute.push({ tipo: 'testata', chi: e.giocatore, bersaglio: e.bersaglio, quanti: e.esito, seq: e.seq, attesa: FINE });
        break;
      case 'belato_finale': {
        const carte: Partial<Record<IdGiocatore, IdCarta[]>> = {};
        for (const [id, c] of Object.entries(e.rivelate)) carte[id] = [c];
        battute.push({ tipo: 'giraCarte', carte, attesa: FINE });
        break;
      }
      case 'guaio_preso': {
        const deviatoDa = chiHaDeviato(eventi, vista, e.seq, e.giocatore);
        battute.push({
          tipo: 'guaio',
          carta: e.carta,
          chi: e.giocatore,
          deviatoDa,
          attesa: haEffettoInScena(e.carta) ? { tipo: 'massimo', ms: ATTESA_METEO_MS } : FINE,
        });
        break;
      }
      case 'guaio_curato':
        battute.push({ tipo: 'fumetti', testi: { [e.giocatore]: T.scena.fumetti.curato }, attesa: BREVE });
        break;
      case 'eliminato':
        battute.push({ tipo: 'eliminata', chi: e.giocatore, attesa: FINE });
        break;
      case 'fine_partita':
        battute.push({ tipo: 'festa', vincitori: [...e.esito.vincitori], attesa: FINE });
        break;
      // guaio_deviato: lo racconta il guaio_preso che segue (anche in un'azione successiva); il resto serve solo a rimettere in pari la scena
      default:
        break;
    }
  }
  return battute;
}
