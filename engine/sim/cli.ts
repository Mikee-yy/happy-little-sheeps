// Uso: npm run simula -- [--variante proposta] [--partite 1000] [--giocatori 2,3,4] [--politiche casuale,semplice] [--seme 1] [--uscita docs/rapporto-simulatore.md]
// Tavoli misti (D47): npm run simula -- --miste normale,semplice [--partite 1000] [--giocatori 2,3,4] [--uscita docs/rapporto-bot.md]
//   per ogni numero di giocatori, tutti i tavoli con k posti della prima politica e gli altri della seconda,
//   più le partite con tutti i posti della prima politica (criteri di accettazione).
import { writeFileSync } from 'node:fs';
import { POLITICHE } from './politiche';
import type { Politica } from './politiche';
import { simula, simulaMiste } from './simulatore';
import { rapportoMarkdown, rapportoMisteMarkdown, riassumi, riassumiMiste } from './statistiche';
import { VARIANTI } from './varianti';
import type { Riassunto, RiassuntoMisto } from './statistiche';

function opzione(nome: string, predefinito: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : predefinito;
}
function politica(nome: string): Politica {
  const p = POLITICHE[nome];
  if (!p) throw new Error(`Politica sconosciuta: ${nome}`);
  return p;
}

const partite = Number(opzione('partite', '1000'));
const giocatori = opzione('giocatori', '2,3,4').split(',').map(Number);
const miste = opzione('miste', '').split(',').filter(Boolean);
const politiche = miste.length > 0 ? [miste[0] as string] : opzione('politiche', 'casuale,semplice').split(',');
const seme = Number(opzione('seme', '1'));
const uscita = opzione('uscita', miste.length > 0 ? 'docs/rapporto-bot.md' : 'docs/rapporto-simulatore.md');
const nomeVariante = opzione('variante', '');
const variante = nomeVariante ? VARIANTI[nomeVariante] : undefined;
if (nomeVariante && !variante) throw new Error(`Variante sconosciuta: ${nomeVariante}`);
if (miste.length !== 0 && miste.length !== 2) throw new Error('--miste vuole due politiche, per esempio normale,semplice');

const inizio = performance.now();
const riassuntiMisti: RiassuntoMisto[] = [];
if (miste.length === 2) {
  const [a, b] = miste.map(politica) as [Politica, Politica];
  for (const n of giocatori) {
    for (let k = n - 1; k >= 1; k--) {
      const t0 = performance.now();
      const tavolo = [...Array<Politica>(k).fill(a), ...Array<Politica>(n - k).fill(b)];
      const m = riassumiMiste(tavolo.map((p) => p.nome), simulaMiste({ tavolo, partite, semeIniziale: seme, variante }));
      riassuntiMisti.push(m);
      const quote = Object.entries(m.perPolitica)
        .map(([nome, p]) => `${p.posti} ${nome} ${(p.vittorie * 100).toFixed(1)}% (atteso ${(p.atteso * 100).toFixed(1)}%, eliminati ${p.eliminatiPerPosto.toFixed(2)})`)
        .join(', ');
      console.log(`${n} giocatori: ${quote}, errori ${m.errori}, stalli ${m.stalli} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    }
  }
}
const riassunti: Riassunto[] = [];
for (const nome of politiche) {
  const p = politica(nome);
  for (const n of giocatori) {
    const t0 = performance.now();
    const r = riassumi(simula({ numeroGiocatori: n, partite, semeIniziale: seme, politica: p, variante }));
    riassunti.push(r);
    const modi = Object.entries(r.modi).map(([m, q]) => `${m} ${(q * 100).toFixed(0)}%`).join(', ');
    console.log(
      `${nome.padEnd(8)} ${n} giocatori: round medi ${r.round.media.toFixed(1)}, ${modi}, errori ${r.errori}, stalli ${r.stalli} (${((performance.now() - t0) / 1000).toFixed(1)} s)`,
    );
  }
}
const durataSecondi = (performance.now() - inizio) / 1000;
writeFileSync(
  uscita,
  miste.length > 0
    ? rapportoMisteMarkdown(riassuntiMisti, riassunti, { seme, durataSecondi })
    : rapportoMarkdown(riassunti, {
        titolo: variante ? `Rapporto del simulatore — ${variante.nome}` : 'Rapporto del simulatore',
        seme,
        durataSecondi,
      }),
);
writeFileSync(uscita.replace(/\.md$/, '.json'), JSON.stringify(miste.length > 0 ? { miste: riassuntiMisti, pure: riassunti } : riassunti, null, 2) + '\n');
console.log(`Rapporto scritto in ${uscita}`);
const tuttiOk =
  riassunti.every((r) => r.criteri.senzaErrori && r.criteri.durata && r.criteri.equilibrio) &&
  riassuntiMisti.every((m) => m.errori === 0 && m.stalli === 0);
console.log(tuttiOk ? 'Tutti i criteri rispettati.' : 'Alcuni criteri NON sono rispettati: vedi il rapporto.');
