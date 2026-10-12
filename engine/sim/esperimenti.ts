// Banco di prova del bilanciamento: griglia di varianti (posti dell'Ovile × dado) per un numero di giocatori.
// Uso: npm run esperimenti -- --giocatori 3 [--partite 300] [--posti 12,14,16]
import { SETUP } from '../src';
import type { FacciaDado } from '../src';
import { POLITICHE } from './politiche';
import { simula } from './simulatore';
import type { Variante } from './simulatore';
import { CRITERI, riassumi } from './statistiche';

function opzione(nome: string, predefinito: string): string {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? (process.argv[i + 1] as string) : predefinito;
}

const n = Number(opzione('giocatori', '3'));
const partite = Number(opzione('partite', '300'));
const base = SETUP.perNumeroGiocatori[String(n)]!;
const posti = opzione('posti', `${base.postiOvile},${base.postiOvile + 2},${base.postiOvile + 4}`).split(',').map(Number);

const dadoBase = SETUP.dado.map((f) => ({ ...f }));
const DADI: Record<string, FacciaDado[]> = {
  base: dadoBase,
  'pascolo grande 4': dadoBase.map((f) => (f.id === 'pascolo_grande' ? { ...f, quantita: 4 } : f)),
  'testata x2': dadoBase.map((f) =>
    f.id === 'pascolo_piccolo' ? { ...f, copie: 1 } : f.id === 'testata' ? { ...f, copie: 2 } : f,
  ),
};

console.log(`| Giocatori | Posti | Agnellini | Dado | Politica | Round medi | Tra 6 e 12 | Ovile pieno | Ultima pecora | Mazzo finito | Criteri |`);
console.log(`| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |`);
for (const p of posti) {
  // Gli agnellini totali crescono in proporzione ai posti, come nella tabella del brief.
  const totali = Math.round((base.agnelliniTotali * p) / base.postiOvile);
  for (const [nomeDado, dado] of Object.entries(DADI)) {
    const variante: Variante = { nome: `${p} posti, dado ${nomeDado}`, postiOvile: { [n]: p }, agnelliniTotali: { [n]: totali }, dado };
    for (const politica of Object.values(POLITICHE)) {
      const r = riassumi(simula({ numeroGiocatori: n, partite, semeIniziale: 1, politica, variante }));
      const ok = r.criteri.senzaErrori && r.criteri.durata && r.criteri.equilibrio;
      const q = (x: number) => `${(x * 100).toFixed(0)}%`;
      console.log(
        `| ${n} | ${p} | ${totali} | ${nomeDado} | ${politica.nome} | ${r.round.media.toFixed(1)} | ${q(r.round.quotaNeiLimiti)} | ${q(r.modi.ovile_pieno)} | ${q(r.modi.ultima_pecora)} | ${q(r.modi.mazzo_finito)} | ${ok ? '✅' : '❌'}${r.errori + r.stalli ? ` ${r.errori + r.stalli} errori` : ''} |`,
      );
    }
  }
}
void CRITERI;
