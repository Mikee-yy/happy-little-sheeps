// Tutti i testi visibili ai giocatori (brief §1: un unico file di stringhe).
// Nomi e testi delle carte stanno invece nei file dati del motore (engine/data/cards.json).
import type { NomeFase, TipoGuaioCarta } from '../../engine/src';

export const T = {
  titolo: 'Happy Little Sheeps',
  sottotitolo: 'Tenere pecore, guai seri.',

  home: {
    giocaQui: 'Gioca su questo dispositivo',
    riprendi: 'Riprendi la partita',
    creaStanza: 'Crea stanza',
    entraStanza: 'Entra in una stanza',
    prossimamente: 'In arrivo con la prossima versione',
    regole: 'Regole',
    nuovaConfermata: 'C\'è una partita salvata: iniziarne una nuova la cancella.',
  },

  preparazione: {
    titolo: 'Nuova partita',
    quantiGiocatori: 'Quanti giocatori?',
    nomeSegnaposto: (n: number) => `Giocatore ${n}`,
    nome: 'Nome',
    pecora: 'Pecora',
    bonus: 'Bonus',
    malus: 'Malus',
    inizia: 'Inizia la partita',
    indietro: 'Indietro',
    nomiDoppi: 'Ogni giocatore deve avere un nome diverso.',
    nomeVuoto: 'Scrivi un nome per ogni giocatore.',
    pecoreDoppie: 'Ogni giocatore deve avere una pecora diversa.',
  },

  passaggio: {
    passaA: (nome: string) => `Passa il dispositivo a ${nome}`,
    nascosto: 'Le carte restano nascoste finché non tocchi il pulsante.',
    sonoIo: (nome: string) => `Sono ${nome}`,
  },

  tavolo: {
    round: (n: number) => `Round ${n}`,
    mazzo: (n: number) => `Mazzo · ${n}`,
    ultimoRound: 'Ultimo round',
    guaio: 'Guaio',
    nessunGuaio: 'Nessun Guaio',
    gregge: 'Gregge',
    carteGiocate: 'Carte giocate',
    staScegliendo: 'sta scegliendo',
    haScelto: 'ha scelto',
    fuori: 'fuori dal round',
    eliminata: 'eliminata',
    tu: 'tu',
    unoAllaVittoria: (n: number) => (n === 1 ? '1 alla vittoria!' : `${n} alla vittoria!`),
    cronaca: 'Cosa è successo',
    menu: 'Menu',
  },

  avvisi: {
    pericoloTitolo: 'Un Guaio all\'eliminazione',
    pericolo: (tipi: string) => `Ancora un Guaio di tipo ${tipi} e torni a casa.`,
    vittoriaTitolo: (n: number) => (n === 1 ? 'Un agnellino alla vittoria' : `${n} agnellini alla vittoria`),
    vittoria: 'L\'Ovile è quasi pieno.',
  },

  tipiGuaio: {
    meteo: 'Meteo',
    predatori: 'Predatori',
    drammi: 'Drammi',
    tosatura: 'Tosatura a Sorpresa',
  } satisfies Record<TipoGuaioCarta, string>,

  carte: {
    trovata: 'Trovata',
    belato: 'Belato',
    guaio: 'Guaio',
    gemella: 'Gemella',
    quando: {
      punteggio: 'Calcolo del punteggio',
      salvataggio: 'Prendi un Guaio',
      sempre: 'In qualsiasi momento',
      dopo_guaio: 'Dopo un Guaio',
    } as Record<string, string>,
  },

  fasi: {
    guaio: 'Ecco il Guaio del round',
    scelta: 'Scelta segreta',
    rivelazione: 'Tutte le Trovate si scoprono',
    effetti: 'Effetti delle Trovate',
    belati_punteggio: 'Belati di punteggio',
    dado: 'Dado del Pastore',
    risoluzione_dado: 'Dado del Pastore',
    guaio_al_peggiore: 'Chi prende il Guaio?',
    belato_finale: 'Belato Finale',
    belati_salvataggio: 'Salvataggio',
    consolazione: 'Consolazione',
    fine_round: 'Fine del round',
    ultimo_round: 'Ultimo round!',
    fine_partita: 'Fine partita',
  } satisfies Record<NomeFase, string>,

  azioni: {
    continua: 'Continua',
    conferma: 'Conferma',
    annulla: 'Annulla',
    passa: 'Lascia passare',
    nessuno: 'Nessuno',
    gioca: (nome: string, valore: number) => `Gioca ${nome} · ${valore}`,
    giocaCoppia: (totale: number) => `Gioca le Gemelle · ${totale}`,
    scegliCarta: 'Scegli una Trovata',
    attiva: 'Usa l\'effetto',
    rinuncia: 'Non usarlo',
    lancia: 'Lancia il dado',
    beeeNo: 'BEEE-NO!',
    prendiGuaio: 'Prendo il Guaio',
    nonScartare: 'Non scarto nulla',
    scarta: 'Scarta',
    tieni: 'Tieni',
    fatto: 'Fatto',
  },

  scelta: {
    titolo: (nome: string) => `${nome}, scegli in segreto`,
    aiuto: 'Una Trovata, oppure due Gemelle insieme: i valori si sommano.',
    gemelleInsieme: 'Tocca due Gemelle per giocarle insieme.',
  },

  rivelazione: {
    titolo: 'Punteggi del round',
    valore: 'Valore',
    tratto: 'Tratto',
    effetto: 'Effetti',
    belato: 'Belati',
    scambio: 'Scambio',
    totale: 'Totale',
    nonGioca: 'non gioca',
  },

  effetti: {
    titolo: (nome: string, carta: string) => `${nome}: effetto di ${carta}`,
    facoltativo: 'L\'effetto è facoltativo.',
    bersaglio: 'Da chi prendi l\'agnellino?',
    scartaESomma: 'Scegli la Trovata da scartare: il suo valore si aggiunge al tuo punteggio.',
    scartaFinoATre: 'Scegli fino a 3 carte da scartare.',
    guardaDue: 'Tieni una carta: l\'altra va negli scarti.',
  },

  reazione: {
    domanda: 'Qualcuno gioca Beee-NO!?',
    aiuto: 'Chi vuole giocarlo tocca il proprio nome.',
    privato: (nome: string) => `${nome}, vuoi annullarlo?`,
    nonHai: 'Non hai un Beee-NO! in mano.',
  },

  punteggio: {
    domanda: 'Qualcuno gioca un Belato di punteggio?',
    aiuto: 'Chi vuole giocarlo tocca il proprio nome. Si può giocarne più d\'uno.',
    privato: (nome: string) => `${nome}, quale Belato giochi?`,
    nonHai: 'Non hai Belati da giocare adesso.',
    suChi: 'Su quale pecora?',
  },

  dado: {
    tocca: (nome: string) => `${nome} lancia il Dado del Pastore`,
    pari: 'Pari merito al primo posto: lanciano tutti, a turno.',
    furtoTitolo: (quanti: number) => `Ruba ${quanti} agnellini`,
    furtoAiuto: (quanti: number, gregge: number) =>
      gregge > 0 ? `Dividili come vuoi: ${quanti} dagli avversari, ${gregge} dal Gregge.` : `Dividili come vuoi tra gli avversari.`,
    testataTitolo: 'Chi colpisce il Montone?',
    facce: {
      pascolo_piccolo: 'Pascolo piccolo: +3 dal Gregge',
      pascolo_grande: 'Pascolo grande: +5 dal Gregge',
      furto_piccolo: 'Furto piccolo: ruba 2',
      furto_grande: 'Furto grande: ruba 4',
      testata: 'Testata del Montone!',
    } as Record<string, string>,
  },

  testata: {
    titolo: 'Testata del Montone',
    sottotitolo: (nome: string) => `Scegli dove colpire l'Ovile di ${nome}`,
    aiuto: 'Trascina dal montone verso l\'Ovile e rilascia: più tiri, più forte colpisci.',
    potenza: (p: number, cadono: number) => `Potenza · ${p} / 10 · fa cadere ${cadono} ${cadono === 1 ? 'agnellino' : 'agnellini'}`,
    risultato: (n: number) => (n === 0 ? 'Mancato! Nessun agnellino cade.' : n === 1 ? 'Cade 1 agnellino!' : `Cadono ${n} agnellini!`),
  },

  guai: {
    prende: (nome: string) => `${nome} prende il Guaio`,
    spareggio: (nomi: string) => `Pari merito in fondo: ${nomi}. Si va al Belato Finale.`,
    inFondo: 'Il Guaio torna in fondo al mazzo.',
    tuttiPari: 'Tutti pari: il Guaio torna in fondo al mazzo e nessuno lancia il dado.',
  },

  belatoFinale: {
    titolo: (nome: string) => `${nome}, Belato Finale`,
    aiuto: 'Gioca coperta un\'altra Trovata: conta solo il valore stampato. Il più basso prende il Guaio.',
  },

  salvataggio: {
    titolo: (nome: string) => `${nome}, stai per prendere il Guaio`,
    aiuto: 'Puoi giocare un Belato che lo evita o lo devia.',
    aChi: 'A chi lo passi?',
  },

  consolazione: {
    titolo: (nome: string) => `${nome}, consolazione`,
    aiuto: 'Hai preso un agnellino dal Gregge. Puoi scartare una carta dalla mano.',
    cura: 'Visita di Garzina: quale Guaio togli?',
  },

  fineRound: {
    titolo: 'Fine del round',
    aiuto: 'Tutti ripescano fino a 5 carte.',
  },

  ultimoRound: {
    titolo: 'Ultimo round!',
    aiuto: 'Il mazzo è finito: dopo questo round vince chi ha più agnellini.',
  },

  finePartita: {
    titolo: 'Fine partita',
    vince: (nomi: string) => `Vince ${nomi}!`,
    vincono: (nomi: string) => `Vincono ${nomi}!`,
    modi: {
      ovile_pieno: 'Ovile pieno',
      ultima_pecora: 'Ultima pecora rimasta',
      mazzo_finito: 'Mazzo finito: più agnellini',
    } as Record<string, string>,
    classifica: 'Classifica',
    agnellini: (n: number) => `${n} agnellini`,
    guai: (n: number) => `${n} Guai`,
    rigioca: 'Rigioca',
    home: 'Torna alla home',
  },

  menu: {
    titolo: 'Menu',
    regole: 'Regole',
    esci: 'Esci (la partita resta salvata)',
    chiudi: 'Chiudi',
  },

  errori: {
    azione: (msg: string) => `Mossa non valida: ${msg}`,
  },

  e: ' e ',
} as const;

/** "Ada", "Ada e Bea", "Ada, Bea e Cleo". */
export function elenco(nomi: string[]): string {
  if (nomi.length <= 1) return nomi[0] ?? '';
  return `${nomi.slice(0, -1).join(', ')}${T.e}${nomi[nomi.length - 1]}`;
}

/** Sintesi delle regole per la schermata Regole. */
export const REGOLE: Array<{ titolo: string; righe: string[] }> = [
  {
    titolo: 'Lo scopo',
    righe: [
      'Riempi per primo il tuo Ovile di agnellini.',
      'Oppure resta l\'ultima pecora in gioco.',
      'Oppure, quando il mazzo finisce, abbi più agnellini di tutti (a parità: meno Guai).',
    ],
  },
  {
    titolo: 'Ogni round',
    righe: [
      'Si scopre un Guaio: Meteo, Predatori, Drammi o Tosatura a Sorpresa.',
      'Tutti scelgono in segreto una Trovata (valore da 0 a 9). Due Gemelle si giocano insieme e si sommano.',
      'Le Trovate si scoprono e i loro effetti si risolvono.',
      'Punteggio = valore + tratto della pecora (+1 o −1 se il Guaio è del suo tipo) + effetti + Belati.',
      'Chi ha il punteggio più alto lancia il Dado del Pastore.',
      'Chi ha il punteggio più basso prende il Guaio, ma riceve 1 agnellino di consolazione e può scartare una carta.',
      'A fine round tutti ripescano fino a 5 carte.',
    ],
  },
  {
    titolo: 'Il Dado del Pastore',
    righe: [
      'Pascolo: prendi 3 o 5 agnellini dal Gregge.',
      'Furto: ruba 2 o 4 agnellini agli altri, divisi come vuoi.',
      'Testata del Montone (2 facce): colpisci l\'Ovile di un avversario, da 0 a 3 agnellini tornano nel Gregge.',
      'Gli agnellini oltre l\'ultimo posto libero non si prendono: riempire l\'Ovile basta per vincere.',
    ],
  },
  {
    titolo: 'I Belati',
    righe: [
      'Si giocano fuori turno, nel momento scritto sulla carta.',
      'Beee-NO! annulla l\'effetto di una Trovata, un altro Belato o il risultato del dado appena dichiarato. Anche un altro Beee-NO!',
      'Visita di Garzina: dopo aver preso un Guaio ne togli uno dal tuo Angolo.',
    ],
  },
  {
    titolo: 'Eliminazione',
    righe: [
      'Sei eliminata con 3 Guai dello stesso tipo o 3 Guai di tipi diversi.',
      'La Tosatura a Sorpresa vale come qualsiasi tipo.',
      'In due giocatori servono 4 Guai uguali, oppure 2 per ciascun tipo.',
    ],
  },
  {
    titolo: 'Parità',
    righe: [
      'Pari al primo posto: lanciano tutti il dado, prima chi ha meno agnellini.',
      'Pari all\'ultimo posto: Belato Finale. Si gioca coperta un\'altra Trovata e conta solo il valore stampato.',
      'Tutti pari: il Guaio torna in fondo al mazzo e nessuno lancia.',
    ],
  },
];
