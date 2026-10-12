// Eliminazione per Guai nell'Angolo (sezione 8).
import { emetti, giocatore, spostaAgnellini } from './comune';
import { defGuaio, TIPI_GUAIO } from './dati';
import { controllaUltimaPecora } from './fine';
import type { IdGiocatore, RegolaEliminazione, Stato, TipoGuaio, TipoGuaioCarta } from './tipi';

const TIPI_CARTA: TipoGuaioCarta[] = ['meteo', 'predatori', 'drammi', 'tosatura'];

function soddisfa(r: RegolaEliminazione, conta: Record<TipoGuaio, number>, jolly: number): boolean {
  switch (r.regola) {
    case 'uguali':
      return TIPI_GUAIO.some((t) => conta[t] + jolly >= r.quanti);
    case 'diversi':
      return TIPI_GUAIO.filter((t) => conta[t] >= 1).length + jolly >= r.quanti;
    case 'perTipo':
      return TIPI_GUAIO.reduce((somma, t) => somma + Math.max(0, r.quanti - conta[t]), 0) <= jolly;
    default:
      return false;
  }
}

/** Ogni Tosatura vale come un solo Guaio del tipo che serve. */
export function angoloElimina(tipi: TipoGuaioCarta[], regole: RegolaEliminazione[]): boolean {
  const conta: Record<TipoGuaio, number> = { meteo: 0, predatori: 0, drammi: 0 };
  let jolly = 0;
  for (const t of tipi) {
    if (t === 'tosatura') jolly += 1;
    else conta[t] += 1;
  }
  return regole.some((r) => soddisfa(r, conta, jolly));
}

export function tipiAngolo(s: Stato, id: IdGiocatore): TipoGuaioCarta[] {
  return giocatore(s, id).angolo.map((c) => defGuaio(c).tipo);
}

export function tipiCheEliminano(s: Stato, id: IdGiocatore): TipoGuaioCarta[] {
  const g = s.giocatori.find((x) => x.id === id);
  if (!g) return [];
  const tipi = g.angolo.map((c) => defGuaio(c).tipo);
  return TIPI_CARTA.filter((t) => angoloElimina([...tipi, t], s.config.regoleEliminazione));
}

/** Controlla chi ha appena preso un Guaio; se è eliminato può finire la partita (ultima pecora). */
export function controllaEliminazione(s: Stato, id: IdGiocatore): boolean {
  const g = giocatore(s, id);
  if (g.eliminato || !angoloElimina(tipiAngolo(s, id), s.config.regoleEliminazione)) return false;
  emetti(s, { tipo: 'eliminato', giocatore: id });
  if (g.mano.length > 0) {
    const mano = g.mano.splice(0);
    s.scarti.push(...mano);
    emetti(s, { tipo: 'scartate', giocatore: id, carte: [...mano], causa: 'eliminazione' });
  }
  spostaAgnellini(s, id, 'gregge', g.agnellini, 'eliminazione');
  s.guaiFuoriGioco.push(...g.angolo.splice(0));
  g.eliminato = true;
  controllaUltimaPecora(s);
  return true;
}
