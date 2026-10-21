// Tutti i testi visibili ai giocatori (brief §1: un unico file di stringhe).
// Nomi e testi delle carte stanno invece nei file dati del motore (engine/data/cards.json).
import type { NomeFase, TipoGuaioCarta } from '../../engine/src';

export const T = {
  titolo: 'Happy Little Sheeps',

  home: {
    giocaQui: 'Gioca su questo dispositivo',
    aiutoQui: 'Come funziona il gioco su un solo dispositivo',
    spiegaQui:
      'Si gioca tutti insieme su questo dispositivo, che si passa a chi tocca a ogni turno. Ognuno vede le proprie carte solo nel suo turno.',
    riprendi: 'Riprendi la partita',
    creaStanza: 'Crea stanza',
    entraStanza: 'Entra in una stanza',
    dimentica: 'Non rientrare più in quella stanza',
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

  /** Partita di prova contro due bot: pulsante, attesa dei bot, consigli della guida (bozze/partita-prova-progetto.md). */
  prova: {
    pulsante: 'Partita di prova',
    pensa: (nome: string) => `${nome} sta pensando…`,
    consiglioTitolo: 'Consiglio',
    hoCapito: 'Ho capito',
    consigli: {
      inizio: 'Questa è una partita di prova contro Bea e Leo. Lo scopo è riempire per primo il tuo Ovile di agnellini. Ti spiego le cose man mano che succedono.',
      guaio: 'Ogni round si scopre un Guaio. Chi farà il punteggio più basso se lo prende.',
      tratto: 'Nerina se la cava con i Predatori: con loro ha +1. Con il Meteo invece ha −1.',
      scelta:
        'Scegli in segreto una Trovata: il numero grande è il suo valore. Chi fa di più tira il dado, chi fa di meno prende il Guaio. Tieni premuta una carta per leggerla tutta.',
      gemelle: 'Le carte con il quadrifoglio sono Gemelle: due insieme si giocano come una sola e i valori si sommano.',
      rivelazione: 'Le Trovate si scoprono tutte insieme. Il punteggio è valore + tratto della pecora + effetti + Belati.',
      belatoPunteggio: 'Ora si possono giocare i Belati "durante il calcolo del punteggio". Belato di Gruppo dà +2 a chi vuoi tu.',
      tuoDado: 'Hai il punteggio più alto: tira il Dado del Pastore!',
      pascolo: 'Pascolo: chi ha tirato prende agnellini dal Gregge e li porta nel suo Ovile.',
      furto: 'Furto: chi ha tirato ruba agnellini agli altri giocatori.',
      beeeNo: 'Hai un Beee-NO!: si gioca in qualsiasi momento e annulla il dado, l\'effetto di una Trovata o un altro Belato. Usalo adesso!',
      testata: 'Testata del Montone: trascina il montone verso l\'Ovile e lascia andare. Più tiri, più agnellini tornano nel Gregge.',
      guaioTuo:
        'Il Guaio finisce nel tuo Angolo. In cambio prendi un agnellino e puoi scartare una carta. Attenzione: con 3 Guai uguali o 3 diversi sei fuori.',
      guaioBot: 'Il più basso prende il Guaio, ma riceve un agnellino di consolazione.',
      fineRound: 'A fine round tutti ripescano fino ad avere 5 carte.',
    },
    fine: {
      titolo: 'Ora sai come si gioca!',
      testo: 'Se il mazzo finisce, si gioca un ultimo round e vince chi ha più agnellini.',
      continua: 'Continua la partita',
      home: 'Torna alla schermata principale',
    },
  },

  /** Riassunto in fondo alla scelta dei giocatori: la parte "forte" va in grassetto. */
  riassunto: {
    titolo: 'Come si gioca, in breve',
    righe: [
      { forte: 'Lo scopo:', resto: ' riempi per primo il tuo Ovile di agnellini.' },
      { forte: 'Ogni round', resto: ' si scopre un Guaio, e tutti scelgono in segreto una Trovata dalla mano.' },
      { forte: 'Le Trovate si scoprono insieme.', resto: ' Al valore si aggiunge il tratto della tua pecora: +1 o −1 se il Guaio è del suo tipo.' },
      { forte: 'Chi ha il punteggio più alto', resto: ' lancia il Dado del Pastore: pascoli, furti e testate fanno guadagnare agnellini o li tolgono agli altri.' },
      { forte: 'Chi ha il punteggio più basso', resto: ' prende il Guaio, ma riceve un agnellino di consolazione. Con troppi Guai la tua pecora è fuori.' },
      { forte: 'I Belati', resto: ' si giocano fuori turno. Beee-NO! annulla un effetto, un Belato o il dado, in qualsiasi momento.' },
      { forte: 'Se il mazzo finisce,', resto: ' si gioca un ultimo round e vince chi ha più agnellini.' },
    ],
    tutte: 'Leggi tutte le regole ›',
    vaiGiu: 'Puoi leggere le regole in fondo ↓',
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
    agnellini: (n: number) => (n === 1 ? '1 agnellino' : `${n} agnellini`),
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

  stanza: {
    nonConfigurato: 'Il gioco a più dispositivi non è ancora configurato.',
    creaTitolo: 'Crea una stanza',
    entraTitolo: 'Entra in una stanza',
    tuoNome: 'Il tuo nome',
    codice: 'Codice della stanza',
    codiceSegnaposto: 'ABCD',
    codiceNonValido: 'Il codice è di 4 lettere.',
    crea: 'Crea la stanza',
    entra: 'Entra',
    collegamento: 'Collegamento in corso…',
    erroreRete: (msg: string) => `Collegamento non riuscito: ${msg}`,
    inesistente: 'Questa stanza non esiste. Controlla il codice.',
    rientra: (codice: string) => `Rientra nella stanza ${codice}`,
    nonDisponibile: 'La stanza non è più disponibile.',
    salaTitolo: 'Sala d\'attesa',
    codiceStanza: 'Codice stanza',
    inquadra: 'Inquadra il QR code o apri il link e inserisci il codice.',
    copiaLink: 'Copia il link',
    copiato: 'Link copiato!',
    condividi: 'Condividi',
    giocatori: (n: number) => `Giocatori · ${n}/4`,
    host: 'host',
    tu: 'tu',
    offline: 'scollegato',
    bot: 'bot',
    laTuaPecora: 'La tua pecora',
    timer: 'Tempo per reagire (Beee-NO! e Belati)',
    secondi: (n: number) => `${n} s`,
    inizia: 'Inizia la partita',
    servonoDue: 'Servono almeno 2 giocatori.',
    aspettaHost: 'Aspettiamo che l\'host inizi la partita.',
    aspettaIngresso: 'L\'host ti sta facendo entrare…',
    vistaTavolo: 'Apri la vista tavolo (da proiettare)',
    esci: 'Esci',
    togli: 'Togli',
    giaIniziata: 'La partita è già iniziata: non puoi più entrare in questa stanza.',
    altraScheda: 'Questa stanza è stata aperta in un\'altra scheda o su un altro dispositivo: qui la partita si è fermata.',
    connessionePersa: 'Connessione persa: riprovo…',
    seiHost: 'Questa stanza l\'hai creata tu: la riprendo come host.',
    hostAltrove: 'Questa stanza l\'hai creata tu, ma la partita è salvata in un altro browser: riaprila da lì.',
    attesaDi: (nome: string) => `Tocca a ${nome}…`,
    attesaReazioni: 'In attesa delle reazioni…',
    attesaScelte: 'Gli altri stanno scegliendo…',
    prosegue: 'Si prosegue tra poco…',
    tempo: (s: number) => `${s} s`,
    pausaTitolo: 'Partita in pausa',
    pausaManca: (nomi: string) => `Manca ${nomi}: aspettiamo che riapra la pagina.`,
    sostituisci: (nome: string) => `Sostituisci ${nome} con un bot`,
    hostAssente: (nome: string) => `${nome} (host) si è scollegato: la partita riprende quando riapre la pagina.`,
    passaDaSolo: 'Passa da solo quando non ho niente da giocare',
    rivincita: 'Nuova partita con gli stessi giocatori',
    aspettaRivincita: 'L\'host può avviare una nuova partita con gli stessi giocatori.',
    lancioDi: (nome: string) => `${nome} lancia il dado…`,
    testataDi: (nome: string, bersaglio: string) => `${nome} prende la mira sull'Ovile di ${bersaglio}…`,
  },

  scena: {
    riassunto: {
      posto: (nome: string, agnellini: number, posti: number, guai: number) =>
        `${nome}: ${agnellini === 1 ? '1 agnellino' : `${agnellini} agnellini`} su ${posti}, ${guai === 1 ? '1 Guaio' : `${guai} Guai`}`,
      eliminata: (nome: string) => `${nome}: eliminata`,
      gregge: (n: number) => `Gregge: ${n === 1 ? '1 agnellino' : `${n} agnellini`}`,
    },
    /** Le scelte dentro la scena: scritta in alto e pulsanti (gli altri pulsanti riusano `T.azioni`). */
    scelte: {
      /** La scritta in alto con un dettaglio di seguito (la carta in gioco, il Guaio scelto…). */
      conDettaglio: (principale: string, dettaglio: string) => `${principale} · ${dettaglio}`,
      chiRisponde: 'Qualcuno risponde? Tocca la tua pecora',
      chiPunteggio: 'Qualcuno gioca un Belato? Tocca la tua pecora',
      rubaAncora: (n: number) => (n > 0 ? `Ruba ancora ${n}` : 'Tocca Conferma'),
      gioca: (totale: number) => `Gioca · ${totale}`,
      /** Il pulsante sotto un Belato (il suo nome, quando c'è una carta sollevata). */
      giocaCarta: 'Gioca',
      scarta: (n: number) => `Scarta (${n})`,
      passo: 'Passo',
      /** Il pulsante di conferma sotto un Guaio scelto con una sola cura (il nome del Guaio). */
      cura: (guaio: string) => `Cura ${guaio}`,
      /** La X nella striscia in alto: nasconde il suggerimento della domanda di adesso. */
      chiudiScritta: 'Nascondi il suggerimento',
      /** Il controllo di un agnellino alzato nel furto (per chi legge lo schermo): toccarlo lo rimette giù. */
      agnellinoAlzato: (nome: string) => `Rimetti giù un agnellino di ${nome}`,
    },
    consigli: {
      solleva: 'Tocca una carta per sollevarla',
      leggi: 'Tieni premuta una carta per leggerla',
      trascina: 'Trascina una carta sulla tovaglia per giocarla',
    },
    /** La scena si scarica a parte: se non arriva (rete assente, sito appena aggiornato). */
    caricamento: {
      fallito: 'Il prato non si è caricato. Controlla la connessione e riprova.',
      riprova: 'Riprova',
      /** Con la connessione presente: di solito è uscito un nuovo rilascio e i nomi dei file sono cambiati. */
      aggiornato: 'Il gioco è stato aggiornato. Ricarica la pagina per continuare: la partita è salvata.',
      /** Lo stesso, nella partita di prova (che non si salva). */
      aggiornatoProva: 'Il gioco è stato aggiornato. Ricarica la pagina per continuare: la partita di prova riparte da capo.',
      ricarica: 'Ricarica la pagina',
    },
    /** Il cassetto dei pannelli sopra la scena: la maniglia lo abbassa (si guarda il prato) e lo rialza. */
    cassetto: {
      abbassa: 'Guarda il prato',
      alza: 'Torna alle scelte',
    },
    opzioni: {
      /** Titolo della parte Opzioni nel menu della partita. */
      titolo: 'Opzioni',
      suoni: 'Suoni',
      vibrazione: 'Vibrazione',
      veloci: 'Animazioni veloci',
      rivedi: 'Rivedi i suggerimenti',
      si: 'sì',
      no: 'no',
    },
    scoppio: 'BEEE-NO!',
    /** I fumetti degli agnellini che giocano (bozza, righe 1458 e 1478). */
    belini: { coro: 'Beee!', risposta: 'beee', scappa: 'beee!', sorpreso: 'beee?!', fulminato: 'bzz!', plop: 'plop?' },
    /** I fumetti degli ordini della scena: Guai, meteo, Beee-NO! e facce del dado (bozza, righe 1986–1991, 2072, 2091 e 2336–2525). */
    fumetti: {
      guaio: (nome: string) => `${nome}!`,
      beeeNo: 'Beee-NO!',
      grandine: 'Ahia, grandine!',
      vento: 'Mi spettina!',
      nebbia: "Dov'è finito il gregge?",
      fulmine: 'Che ricci!',
      gelata: 'Brrr… ad agosto?',
      pozzanghera: 'Quanto sarà profonda?',
      pascolo: (q: number) => `Pascolo ${q}!`,
      furto: (q: number) => `Furto ${q}!`,
      testata: 'Testata!',
      /** Il totale del round sopra ogni pecora, alla rivelazione. */
      punteggio: (n: number) => `${n}`,
      /** La variazione dei Belati di punteggio. */
      delta: (n: number) => (n > 0 ? `+${n}` : `${n}`),
      curato: 'Che sollievo!',
    },
    /** Gli annunci a tutto prato della regia. */
    annunci: { ultimoRound: 'Ultimo round!' },
    diciture: { mazzo: 'Mazzo', scarti: 'Scarti', guai: 'Guai' },
    /** Cartello del gregge e diciture della coperta con i conti (bozza, righe 1184 e 1790). */
    gregge: (n: number) => `Gregge ${n}`,
    mazzo: (n: number) => `Mazzo ${n}`,
    guai: (n: number) => `Guai ${n}`,
    scarti: 'Scarti',
    /** Sulla targa di ogni giocatore. */
    segnalini: {
      unGuaio: "1 Guaio all'eliminazione",
      quasiPieno: (n: number) => (n === 1 ? 'Manca 1' : `Mancano ${n}`),
    },
    fuoriDalRound: 'Fuori dal round',
    /** Le carte disegnate (bozza, righe 581–582 e 637): nomi dei tipi di Guaio, momento dei Belati, piedi, fumetto di ripiego. */
    carte: {
      tipi: { meteo: 'METEO', predatori: 'PREDATORI', drammi: 'DRAMMI', tosatura: 'TOSATURA' },
      quando: {
        punteggio: 'CALCOLO DEL PUNTEGGIO',
        salvataggio: 'PRENDI UN GUAIO',
        sempre: 'IN QUALSIASI MOMENTO',
        dopo_guaio: 'DOPO UN GUAIO',
      },
      piede: { trovata: 'TROVATA', belato: 'BELATO', guaio: 'GUAIO' },
      beee: 'Beee!',
    },
    lettura: { lascia: 'Lascia per chiudere', tocca: 'Tocca per chiudere' },
    etichette: { mazzo: 'Mazzo', dado: 'Dado' },
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
