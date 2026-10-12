// Uso: npm run simula -- [--variante proposta] [--partite 1000] [--giocatori 2,3,4] [--politiche casuale,semplice] [--seme 1] [--uscita docs/rapporto-simulatore.md]
import { writeFileSync } from 'node:fs';
import { POLITICHE } from './politiche';
import { simula } from './simulatore';
import { rapportoMarkdown, riassumi } from './statistiche';
import { VARIANTI } from './varianti';
import type { Riassunto } from './statistiche';

function opzione(nome: string, predefinito: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : predefinito;
}

const partite = Number(opzione('partite', '1000'));
const giocatori = opzione('giocatori', '2,3,4').split(',').map(Number);
const politiche = opzione('politiche', 'casuale,semplice').split(',');
const seme = Number(opzione('seme', '1'));
const uscita = opzione('uscita', 'docs/rapporto-simulatore.md');
const nomeVariante = opzione('variante', '');
const variante = nomeVariante ? VARIANTI[nomeVariante] : undefined;
if (nomeVariante && !variante) throw new Error(`Variante sconosciuta: ${nomeVariante}`);

const inizio = performance.now();
const riassunti: Riassunto[] = [];
for (const nome of politiche) {
  const politica = POLITICHE[nome];
  if (!politica) throw new Error(`Politica sconosciuta: ${nome}`);
  for (const n of giocatori) {
    const t0 = performance.now();
    const r = riassumi(simula({ numeroGiocatori: n, partite, semeIniziale: seme, politica, variante }));
    riassunti.push(r);
    const modi = Object.entries(r.modi).map(([m, q]) => `${m} ${(q * 100).toFixed(0)}%`).join(', ');
    console.log(
      `${nome.padEnd(8)} ${n} giocatori: round medi ${r.round.media.toFixed(1)}, ${modi}, errori ${r.errori}, stalli ${r.stalli} (${((performance.now() - t0) / 1000).toFixed(1)} s)`,
    );
  }
}
const durataSecondi = (performance.now() - inizio) / 1000;
writeFileSync(uscita, rapportoMarkdown(riassunti, {
    titolo: variante ? `Rapporto del simulatore — ${variante.nome}` : 'Rapporto del simulatore',
    seme,
    durataSecondi,
  }));
writeFileSync(uscita.replace(/\.md$/, '.json'), JSON.stringify(riassunti, null, 2) + '\n');
console.log(`Rapporto scritto in ${uscita}`);
const tuttiOk = riassunti.every((r) => r.criteri.senzaErrori && r.criteri.durata && r.criteri.equilibrio);
console.log(tuttiOk ? 'Tutti i criteri rispettati.' : 'Alcuni criteri NON sono rispettati: vedi il rapporto.');
