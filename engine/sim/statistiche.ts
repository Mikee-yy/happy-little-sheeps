// Statistiche sulle partite simulate e rapporto in markdown con i criteri di accettazione della fase 2.
import type { IdPecora, ModoVittoria } from '../src';
import type { RisultatoPartita } from './simulatore';

/** Criteri del brief §8, fase 2. */
export const CRITERI = { roundMin: 6, roundMax: 12, quotaMassimaModo: 0.7 };
/** Ipotesi per stimare la durata: minuti per round. */
export const MINUTI_PER_ROUND = 1.5;

const MODI: ModoVittoria[] = ['ovile_pieno', 'ultima_pecora', 'mazzo_finito'];

export interface Riassunto {
  politica: string;
  numeroGiocatori: number;
  partite: number;
  errori: number;
  stalli: number;
  esempiErrori: string[];
  round: { media: number; mediana: number; min: number; max: number; p10: number; p90: number; quotaNeiLimiti: number };
  minutiStimati: number;
  modi: Record<ModoVittoria, number>;
  condivise: number;
  eliminazioniMedie: number;
  quotaConEliminazioni: number;
  belatiFinaliMedi: number;
  beeeNoMedi: number;
  annullateMedie: number;
  guaiPresiMedi: number;
  roundSenzaGuaio: number;
  facce: Record<string, number>;
  vittoriePerPecora: Record<string, { partite: number; vittorie: number }>;
  vittoriePrimoGiocatore: number;
  ripieghi: number;
  criteri: { senzaErrori: boolean; durata: boolean; equilibrio: boolean };
}

const media = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : 0);
function percentile(ordinati: number[], p: number): number {
  if (ordinati.length === 0) return 0;
  return ordinati[Math.min(ordinati.length - 1, Math.floor(p * ordinati.length))] as number;
}

export function riassumi(risultati: RisultatoPartita[]): Riassunto {
  const primo = risultati[0];
  const ok = risultati.filter((r) => r.stato === 'ok');
  const round = ok.map((r) => r.round).sort((a, b) => a - b);
  const modi = Object.fromEntries(MODI.map((m) => [m, ok.filter((r) => r.modo === m).length / Math.max(1, ok.length)])) as Record<ModoVittoria, number>;
  const facce: Record<string, number> = {};
  for (const r of ok) for (const [f, n] of Object.entries(r.facce)) facce[f] = (facce[f] ?? 0) + n;
  const vittoriePerPecora: Record<string, { partite: number; vittorie: number }> = {};
  for (const r of ok) {
    for (const p of r.pecore) {
      const v = (vittoriePerPecora[p] ??= { partite: 0, vittorie: 0 });
      v.partite++;
      // Le vittorie condivise contano come frazione.
      if (r.vincitori.includes(p as IdPecora)) v.vittorie += 1 / r.vincitori.length;
    }
  }
  const mediaRound = media(round);
  const riassunto: Riassunto = {
    politica: primo?.politica ?? '',
    numeroGiocatori: primo?.numeroGiocatori ?? 0,
    partite: risultati.length,
    errori: risultati.filter((r) => r.stato === 'errore').length,
    stalli: risultati.filter((r) => r.stato === 'stallo').length,
    esempiErrori: [...new Set(risultati.filter((r) => r.stato !== 'ok').map((r) => `seme ${r.seme}: ${r.errore}`))].slice(0, 5),
    round: {
      media: mediaRound,
      mediana: percentile(round, 0.5),
      min: round[0] ?? 0,
      max: round[round.length - 1] ?? 0,
      p10: percentile(round, 0.1),
      p90: percentile(round, 0.9),
      quotaNeiLimiti: round.filter((x) => x >= CRITERI.roundMin && x <= CRITERI.roundMax).length / Math.max(1, round.length),
    },
    minutiStimati: mediaRound * MINUTI_PER_ROUND,
    modi,
    condivise: ok.filter((r) => r.vincitori.length > 1).length / Math.max(1, ok.length),
    eliminazioniMedie: media(ok.map((r) => r.eliminati)),
    quotaConEliminazioni: ok.filter((r) => r.eliminati > 0).length / Math.max(1, ok.length),
    belatiFinaliMedi: media(ok.map((r) => r.belatiFinali)),
    beeeNoMedi: media(ok.map((r) => r.beeeNo)),
    annullateMedie: media(ok.map((r) => r.annullate)),
    guaiPresiMedi: media(ok.map((r) => r.guaiPresi)),
    roundSenzaGuaio: ok.reduce((t, r) => t + r.roundSenzaGuaio, 0),
    facce,
    vittoriePerPecora,
    vittoriePrimoGiocatore:
      ok.reduce((t, r) => t + (r.vincitoriPosti.includes(r.postoPrimo) ? 1 / r.vincitoriPosti.length : 0), 0) / Math.max(1, ok.length),
    ripieghi: ok.reduce((t, r) => t + r.ripieghi, 0),
    criteri: { senzaErrori: false, durata: false, equilibrio: false },
  };
  riassunto.criteri = {
    senzaErrori: riassunto.errori === 0 && riassunto.stalli === 0,
    durata: mediaRound >= CRITERI.roundMin && mediaRound <= CRITERI.roundMax,
    equilibrio: MODI.every((m) => modi[m] <= CRITERI.quotaMassimaModo),
  };
  return riassunto;
}

const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
const n1 = (x: number) => x.toFixed(1);
const segno = (b: boolean) => (b ? '✅' : '❌');

/** Descrizione di ogni politica nei rapporti (solo quelle presenti). */
const DESCRIZIONI: Record<string, string> = {
  casuale: 'ogni giocatore sceglie a caso tra le azioni valide (richiesta del brief).',
  semplice:
    "buon senso, come il bot del brief: Trovate pesate sul valore, furti e Testate a chi ha più agnellini, Belati di salvataggio solo a rischio di eliminazione, Beee-NO! quando un avversario sta per riempire l'Ovile o quando si è colpiti.",
  normale:
    "il bot del gioco (D47): come semplice, ma Trovate pesate sul quadrato del valore e, con un Guaio che lo eliminerebbe, la più alta; Belati +2/−2 per non restare in fondo quando c'è un Guaio e per lanciare il dado da solo; Finta svenuta verso chi ha più agnellini prima di Faccio finta di niente; Garzina anche quando l'Angolo è molto esposto; Beee-NO! tenuto per l'Ovile pieno, i furti e le Testate che costano almeno 2 agnellini, i Guai deviati che lo eliminerebbero, i −2 che lo mandano in fondo e, a 2 giocatori, i dadi da 3 o più agnellini che portano l'avversario davanti.",
};

/** Senza `durataSecondi` la riga d'apertura non dà la durata (la sezione dei posti uguali nel rapporto dei bot: il tempo è di tutte le partite). */
export function rapportoMarkdown(riassunti: Riassunto[], o: { titolo: string; seme: number; durataSecondi?: number }): string {
  const righe: string[] = [];
  righe.push(`# ${o.titolo}`, '');
  righe.push(
    `Seme iniziale ${o.seme}; ${riassunti.reduce((t, r) => t + r.partite, 0)} partite${o.durataSecondi === undefined ? '' : ` in ${o.durataSecondi.toFixed(0)} s`}.`,
    `Durata in minuti stimata con l'ipotesi di ${MINUTI_PER_ROUND} minuti per round.`,
    '',
    ...Object.entries(DESCRIZIONI)
      .filter(([nome]) => riassunti.some((r) => r.politica === nome))
      .map(([nome, testo]) => `- **${nome}**: ${testo}`),
    '',
    '## Criteri di accettazione',
    '',
    '| Politica | Giocatori | Nessun errore o stallo | Media round 6–12 | Nessun modo > 70% |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const r of riassunti) {
    const modoMax = Math.max(...Object.values(r.modi));
    righe.push(
      `| ${r.politica} | ${r.numeroGiocatori} | ${segno(r.criteri.senzaErrori)} ${r.errori + r.stalli} | ${segno(r.criteri.durata)} ${n1(r.round.media)} | ${segno(r.criteri.equilibrio)} ${pc(modoMax)} |`,
    );
  }
  righe.push('', '## Durata e modi di vittoria', '');
  righe.push(
    '| Politica | Giocatori | Round medi (mediana, p10–p90, min–max) | Partite tra 6 e 12 round | Minuti stimati | Ovile pieno | Ultima pecora | Mazzo finito | Vittorie condivise |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const r of riassunti) {
    righe.push(
      `| ${r.politica} | ${r.numeroGiocatori} | ${n1(r.round.media)} (${r.round.mediana}, ${r.round.p10}–${r.round.p90}, ${r.round.min}–${r.round.max}) | ${pc(r.round.quotaNeiLimiti)} | ${n1(r.minutiStimati)} | ${pc(r.modi.ovile_pieno)} | ${pc(r.modi.ultima_pecora)} | ${pc(r.modi.mazzo_finito)} | ${pc(r.condivise)} |`,
    );
  }
  righe.push('', '## Dinamiche', '');
  righe.push(
    '| Politica | Giocatori | Eliminazioni / partita | Partite con eliminazioni | Guai presi / partita | Belati Finali / partita | Beee-NO! / partita | Annullamenti / partita | Vittorie del primo giocatore |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const r of riassunti) {
    righe.push(
      `| ${r.politica} | ${r.numeroGiocatori} | ${n1(r.eliminazioniMedie)} | ${pc(r.quotaConEliminazioni)} | ${n1(r.guaiPresiMedi)} | ${r.belatiFinaliMedi.toFixed(2)} | ${n1(r.beeeNoMedi)} | ${n1(r.annullateMedie)} | ${pc(r.vittoriePrimoGiocatore)} (atteso ${pc(1 / r.numeroGiocatori)}) |`,
    );
  }
  righe.push('', '## Vittorie per pecora', '', 'Quota di vittorie sulle partite in cui la pecora era in gioco (atteso: 1 / giocatori).', '');
  const pecore = [...new Set(riassunti.flatMap((r) => Object.keys(r.vittoriePerPecora)))].sort();
  righe.push(`| Politica | Giocatori | ${pecore.join(' | ')} |`, `| --- | --- | ${pecore.map(() => '---').join(' | ')} |`);
  for (const r of riassunti) {
    const celle = pecore.map((p) => {
      const v = r.vittoriePerPecora[p];
      return v && v.partite > 0 ? pc(v.vittorie / v.partite) : '—';
    });
    righe.push(`| ${r.politica} | ${r.numeroGiocatori} | ${celle.join(' | ')} |`);
  }
  righe.push('', '## Facce del dado uscite', '');
  const facce = [...new Set(riassunti.flatMap((r) => Object.keys(r.facce)))].sort();
  righe.push(`| Politica | Giocatori | ${facce.join(' | ')} |`, `| --- | --- | ${facce.map(() => '---').join(' | ')} |`);
  for (const r of riassunti) {
    const totale = Object.values(r.facce).reduce((a, b) => a + b, 0);
    righe.push(`| ${r.politica} | ${r.numeroGiocatori} | ${facce.map((f) => pc((r.facce[f] ?? 0) / Math.max(1, totale))).join(' | ')} |`);
  }
  const problemi = riassunti.filter((r) => r.esempiErrori.length > 0 || r.ripieghi > 0 || r.roundSenzaGuaio > 0);
  if (problemi.length > 0) {
    righe.push('', '## Note', '');
    for (const r of problemi) {
      if (r.esempiErrori.length) righe.push(`- ${r.politica}, ${r.numeroGiocatori} giocatori: ${r.esempiErrori.join('; ')}`);
      if (r.ripieghi) righe.push(`- ${r.politica}, ${r.numeroGiocatori} giocatori: ${r.ripieghi} azioni della politica rifiutate dal motore e sostituite a caso.`);
      if (r.roundSenzaGuaio) righe.push(`- ${r.politica}, ${r.numeroGiocatori} giocatori: ${r.roundSenzaGuaio} round senza Guaio (mazzo Guai esaurito).`);
    }
  }
  return righe.join('\n') + '\n';
}

// ─── Tavoli misti (D47) ──────────────────────────────────────────────────────

export interface RiassuntoMisto {
  /** Politiche del tavolo, una per posto (prima della rotazione). */
  tavolo: string[];
  numeroGiocatori: number;
  partite: number;
  errori: number;
  stalli: number;
  roundMedi: number;
  /** Per politica: posti al tavolo, quota di vittorie (le condivise in frazione) e attesa, eliminazioni per posto. */
  perPolitica: Record<string, { posti: number; vittorie: number; atteso: number; eliminatiPerPosto: number }>;
}

export function riassumiMiste(tavolo: string[], risultati: RisultatoPartita[]): RiassuntoMisto {
  const ok = risultati.filter((r) => r.stato === 'ok');
  const n = tavolo.length;
  const perPolitica: RiassuntoMisto['perPolitica'] = {};
  for (const nome of tavolo) {
    const p = (perPolitica[nome] ??= { posti: 0, vittorie: 0, atteso: 0, eliminatiPerPosto: 0 });
    p.posti++;
    p.atteso = p.posti / n;
  }
  for (const r of ok) {
    for (const posto of r.vincitoriPosti) perPolitica[r.politichePosti[posto] as string]!.vittorie += 1 / r.vincitoriPosti.length;
    for (const posto of r.eliminatiPosti) perPolitica[r.politichePosti[posto] as string]!.eliminatiPerPosto += 1;
  }
  for (const p of Object.values(perPolitica)) {
    p.vittorie /= Math.max(1, ok.length);
    p.eliminatiPerPosto /= Math.max(1, ok.length * p.posti);
  }
  return {
    tavolo,
    numeroGiocatori: n,
    partite: risultati.length,
    errori: risultati.filter((r) => r.stato === 'errore').length,
    stalli: risultati.filter((r) => r.stato === 'stallo').length,
    roundMedi: media(ok.map((r) => r.round)),
    perPolitica,
  };
}

export function rapportoMisteMarkdown(miste: RiassuntoMisto[], pure: Riassunto[], o: { seme: number; durataSecondi: number }): string {
  const righe: string[] = ['# Rapporto dei bot', ''];
  righe.push(
    `Seme iniziale ${o.seme}; ${miste.reduce((t, r) => t + r.partite, 0) + pure.reduce((t, r) => t + r.partite, 0)} partite in ${o.durataSecondi.toFixed(0)} s.`,
    'Generato con `npm run simula -- --miste normale,semplice`. Decisione D47 in `docs/motore.md`.',
    '',
    '## Tavoli misti',
    '',
    'A ogni partita i posti ruotano di uno, così ogni politica siede ovunque lo stesso numero di volte. Vittorie: quota delle partite vinte da chi usa quella politica (le vittorie condivise contano in frazione); "atteso" è la quota dei posti. Eliminazioni: per giocatore e per partita.',
    '',
    '| Giocatori | Tavolo | Partite | Round medi | Politica | Posti | Vittorie | Atteso | Vittorie per posto | Eliminazioni per posto |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const m of miste) {
    const conti = Object.entries(m.perPolitica).map(([nome, p]) => `${p.posti} ${nome}`).join(' + ');
    for (const [nome, p] of Object.entries(m.perPolitica)) {
      righe.push(
        `| ${m.numeroGiocatori} | ${conti} | ${m.partite}${m.errori + m.stalli ? ` (${m.errori + m.stalli} errori o stalli)` : ''} | ${n1(m.roundMedi)} | ${nome} | ${p.posti} | ${pc(p.vittorie)} | ${pc(p.atteso)} | ${pc(p.vittorie / p.posti)} (atteso ${pc(1 / m.numeroGiocatori)}) | ${p.eliminatiPerPosto.toFixed(2)} |`,
      );
    }
  }
  righe.push('');
  const accettazione = rapportoMarkdown(pure, { titolo: 'Tutti i posti con la stessa politica', seme: o.seme })
    .replace(/^# /, '## ')
    .replace(/\n## /g, '\n### ');
  return righe.join('\n') + '\n' + accettazione;
}
