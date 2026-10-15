// API pubblica del motore. Firme vincolanti: vedi docs/motore.md, sezione 2.
export * from './tipi';

export { CATALOGO, PROVA, SETUP, configPer, creaMazzoGuai, creaMazzoPrincipale, defCarta, tipoDi } from './dati';
export type { DatiSetup } from './dati';
export { nuovaPartita } from './partita';
export { applica, tentaApplica } from './applica';
export { vistaPer } from './vista';
export { azioniPossibili, eFaseAutomatica, inAttesaDi } from './attesa';
export { postiLiberi, punteggioTotale } from './comune';
export { angoloElimina, tipiCheEliminano } from './eliminazione';
