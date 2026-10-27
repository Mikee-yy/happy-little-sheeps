// Tutti i testi visibili ai giocatori (brief §1: un unico file di stringhe).
// Nomi e testi delle carte stanno invece nei file dati del motore (engine/data/cards.json).
import { CATALOGO, SETUP, defCarta } from '../../engine/src';
import type { FacciaDado, IdPecora, IdTipoCarta, NomeFase, RegolaEliminazione, TipoGuaioCarta } from '../../engine/src';

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
      testata:
        'Tira indietro il Montone e lascialo andare. A metà tiro arrivi al centro del recinto: lì cadono più agnellini, sulla staccionata solo uno. Chi è colpito li perde e tornano nel Gregge.',
      guaioTuo:
        `Il Guaio finisce nel tuo Angolo. In cambio prendi un agnellino e puoi scartare una carta. Attenzione: con ${regolaDellaProva()} sei fuori.`,
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
    nessunEffetto: 'Nessun effetto',
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
    fionda: {
      /** Con "Passa il telefono" (`chi`) nomina anche chi tira: il telefono può essere in mano a un altro. */
      scritta: (bersaglio: string, chi?: string) =>
        `${chi ? `${chi}, tira` : 'Tira'} indietro il Montone e lascialo andare verso l'Ovile di ${bersaglio}`,
      etichetta: 'Montone: trascina indietro e lascia andare. Frecce per mirare, Invio per lanciare.',
    },
    titolo: 'Testata del Montone',
    sottotitolo: (nome: string) => `Scegli dove colpire l'Ovile di ${nome}`,
    aiuto: 'Trascina dal montone verso l\'Ovile e rilascia: più tiri, più forte colpisci.',
    potenza: (p: number, cadono: number) => `Potenza · ${p} / 10 · fa cadere ${cadono} ${cadono === 1 ? 'agnellino' : 'agnellini'}`,
    risultato: (n: number) => (n === 0 ? 'Mancato! Nessun agnellino cade.' : n === 1 ? 'Cade 1 agnellino!' : `Cadono ${n} agnellini!`),
  },

  guai: {
    prende: (nome: string) => `${nome} prende il Guaio`,
    spareggio: (nomi: string) => `Pari merito in fondo: ${nomi}. Si va al Belato Finale.`,
    inFondo: 'Il Guaio torna in fondo al mazzo dei Guai.',
    tuttiPari: 'Tutti pari: il Guaio torna in fondo al mazzo dei Guai e nessuno lancia il dado.',
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
      /** Sopra il ladro, a furto risolto, quando ne arrivano meno di quanti ne aveva annunciati (posti pieni, vittime senza agnellini). */
      furtoSolo: (q: number) => (q === 1 ? 'Solo 1 agnellino!' : `Solo ${q} agnellini!`),
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
      nessunEffetto: 'NESSUN EFFETTO',
    },
    lettura: { lascia: 'Lascia per chiudere', tocca: 'Tocca per chiudere' },
    etichette: { mazzo: 'Mazzo', dado: 'Dado' },
  },

  /** La schermata delle Regole. Le sezioni stanno in `regole()`, in fondo a questo file. */
  regole: {
    titolo: 'Regole',
    indietro: 'Indietro',
    /** In cima alle Regole aperte da una stanza in corso: la partita non si ferma per tutti. */
    stanzaVaAvanti: 'Nella stanza la partita va avanti: torna presto.',
    /** Al posto della riga di sopra, quando la stanza è in pausa (qualcuno scollegato, chi ospita assente). */
    stanzaInPausa: 'La partita è in pausa.',
    /** Al posto della riga di sopra, a partita finita. */
    stanzaFinita: 'La partita è finita.',
    /** Richiamo in cima alle Regole aperte da una stanza, quando tocca a te fare una scelta. */
    richiamo: 'Tocca a te: la partita ti aspetta.',
    /** Richiamo per chi ospita: la stanza è in pausa e aspetta lui (sostituire chi si è scollegato con un bot). */
    richiamoScollegato: 'Un giocatore si è scollegato: decidi tu.',
    tornaAllaPartita: 'Torna alla partita',
    /** Nomi degli esempi fuori da una partita, e per completare quelli della partita. */
    nomiEsempio: ['Ada', 'Bea', 'Cleo', 'Dario'],
    valore: (n: number): string => `valore ${n}`,
    guaioDi: (tipo: TipoGuaioCarta): string => `Guaio ${T.tipiGuaio[tipo]}`,
    /** Testo alternativo di una carta: "Cannocchiale, valore 7. Guarda le prime 2 carte…". */
    carta: (nome: string, dettaglio: string | null, testo: string): string => {
      const testa = dettaglio ? `${nome}, ${dettaglio}` : nome;
      return `${testa}${/[.!?]$/.test(testa) ? ' ' : '. '}${testo}`;
    },
    /** Nome di un titolo di sezione per i lettori di schermo (a vista numero e titolo sono separati dallo stile). */
    nomeTitolo: (n: number, titolo: string): string => `${n}. ${titolo}`,
    /** Nome della fila scorrevole delle figure. */
    figure: (n: number): string => `${n} figure, scorri di lato`,
    /** Didascalia di una pecora: "Ricciolo · +1 Meteo · −1 Predatori"; segno e tipo non si separano andando a capo. */
    tratto: (nome: string, bonus: TipoGuaioCarta, malus: TipoGuaioCarta): string =>
      `${nome} · +1 ${T.tipiGuaio[bonus]} · −1 ${T.tipiGuaio[malus]}`,
    /** Didascalie delle facce del dado. */
    faccia: {
      pascolo: (q: number): string => `Pascolo ${q}`,
      furto: (q: number): string => `Furto ${q}`,
      testata: 'Testata',
    },
    /** Testi alternativi delle figure (regole/alternativi.ts); le carte usano `carta`, le facce `faccia`, i Guai `guaioDi`. */
    alternativi: {
      belato: 'Belato',
      agnellino: 'Agnellino',
      montone: 'Montone',
      dado: 'Dado del Pastore',
      /** Il disegno del recinto con le zone della Testata: i numeri sono quelli dei cerchi della mira. */
      recinto: (centro: number, interno: number, bordo: number): string =>
        `Il recinto visto dall'alto: al centro ${centro} ${centro === 1 ? 'agnellino' : 'agnellini'}, dentro il recinto ${interno}, sulla staccionata o appena fuori ${bordo}, più in là nessuno.`,
      /** Testo di una Trovata senza effetto (non Gemella): lo dice prima della battuta, come il piede della carta. */
      senzaEffetto: (testo: string): string => `${T.carte.nessunEffetto}. ${testo}`,
    },
    titoli: {
      scopo: 'Lo scopo',
      round: 'Un round in 5 passi',
      carte: 'Le carte',
      dado: 'Il dado',
      guai: 'Guai ed eliminazione',
      beeeno: 'Il Beee-NO!',
      fine: 'Come finisce la partita',
      esempi: 'Tre esempi',
    } satisfies Record<IdSezioneRegole, string>,
    /** Numeri in lettere, per "Sei facce: quattro numeri e due Testate". Oltre l'ultimo si scrive la cifra. */
    lettere: ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'],
  },

  e: ' e ',
} as const;

/** "Ada", "Ada e Bea", "Ada, Bea e Cleo". */
export function elenco(nomi: string[]): string {
  if (nomi.length <= 1) return nomi[0] ?? '';
  return `${nomi.slice(0, -1).join(', ')}${T.e}${nomi[nomi.length - 1]}`;
}

// ─── Regole ──────────────────────────────────────────────────────────────────
// Le otto sezioni della schermata Regole. I numeri del gioco vengono da setup.json (`setup`)
// e dal catalogo delle carte: qui stanno solo le frasi. Fa eccezione la riga delle zone
// della Testata, fissata così com'è.

/** Cosa disegnare accanto a un blocco di testo. */
export type DisegnoRegole =
  | { tipo: 'carta'; id: IdTipoCarta }
  | { tipo: 'pecora'; pecora: IdPecora }
  | { tipo: 'agnellino' }
  | { tipo: 'montone' }
  | { tipo: 'dado' }
  /** Id della faccia in setup.json (pascolo_piccolo, …, testata). */
  | { tipo: 'faccia'; faccia: string }
  /** Icona del tipo di Guaio. */
  | { tipo: 'guaio'; guaio: TipoGuaioCarta }
  /** Il recinto visto dall'alto con le tre zone della Testata. */
  | { tipo: 'recinto' };
export interface FiguraRegole {
  disegno: DisegnoRegole;
  didascalia?: string;
}
export interface BloccoRegole {
  /** Le parole d'apertura, in grassetto prima del testo (solo in "Come finisce la partita"). */
  forte?: string;
  testo: string;
  figure: FiguraRegole[];
}
export type IdSezioneRegole = 'scopo' | 'round' | 'carte' | 'dado' | 'guai' | 'beeeno' | 'fine' | 'esempi';
export interface SezioneRegole {
  id: IdSezioneRegole;
  titolo: string;
  blocchi: BloccoRegole[];
}

/**
 * La riga delle zone della Testata, uguale a quella delle regole di prima (decisione del piano), con chi perde gli
 * agnellini e dove vanno. I numeri sono quelli dei cerchi della mira: 3, 2 e 1, mai più di `esitoMassimo`, come
 * `valoriCerchi` di scena/fionda/tiro.ts (una prova li confronta). Non lo si importa: un import da testi.ts verso la scena
 * cambia la divisione in pezzi della pagina iniziale (un pezzo solo oltre i 500 kB).
 */
function rigaTestata(setup: typeof SETUP): string {
  const [centro, interno, bordo] = [3, 2, 1].map((n) => Math.min(n, setup.testata.esitoMassimo)) as [number, number, number];
  return (
    `Centro del recinto ${centro} ${centro === 1 ? 'agnellino' : 'agnellini'}, dentro il recinto ${interno}, sulla staccionata o appena fuori ${bordo}, ` +
    'più in là nessuno (mai più di quanti ne ha): li perde e tornano nel Gregge.'
  );
}

/** Un Guaio per tipo, usato nelle Carte e nei "diversi". */
const GUAI_DIVERSI: readonly IdTipoCarta[] = ['grandine-a-sorpresa', 'volpe-gentile', 'crisi-esistenziale', 'tosatura-a-sorpresa'];
const TIPI_GUAIO_CARTA: readonly TipoGuaioCarta[] = ['meteo', 'predatori', 'drammi', 'tosatura'];

/** I tre nomi degli esempi: quelli della partita nell'ordine dei posti, completati con i nomi di esempio che non ci sono già (senza badare alle maiuscole). */
export function nomiPerEsempi(nomi: readonly string[] | null): [string, string, string] {
  const scelti: string[] = [];
  const presente = (n: string) => scelti.some((s) => s.trim().toLowerCase() === n.trim().toLowerCase());
  // Un nome ripetuto o vuoto non conta: gli esempi hanno sempre tre persone diverse.
  for (const n of nomi ?? []) if (scelti.length < 3 && n.trim() !== '' && !presente(n)) scelti.push(n.trim());
  for (const n of T.regole.nomiEsempio) if (scelti.length < 3 && !presente(n)) scelti.push(n);
  return [scelti[0]!, scelti[1]!, scelti[2]!];
}

/**
 * Le otto sezioni. `nomi` null: fuori da una partita. In una partita a 2 (`nomi.length` 2) l'esempio di eliminazione
 * usa la regola dei 2 giocatori, l'esempio del round è a due e il Belato Finale non si nomina (D36: è "Tutti pari").
 */
export function regole(nomi: readonly string[] | null, setup: typeof SETUP = SETUP): SezioneRegole[] {
  const [a, b, c] = nomiPerEsempi(nomi);
  const inDue = nomi?.length === 2;
  const sezioni: Record<IdSezioneRegole, BloccoRegole[]> = {
    scopo: sezioneScopo(setup),
    round: sezioneRound(setup),
    carte: sezioneCarte(setup),
    dado: sezioneDado(setup),
    guai: sezioneGuai(setup),
    beeeno: sezioneBeeeNo(setup, a, b),
    fine: sezioneFine(inDue),
    esempi: sezioneEsempi(setup, inDue ? setup.eliminazione.dueGiocatori : setup.eliminazione.normale, inDue, a, b, c),
  };
  return (Object.keys(T.regole.titoli) as IdSezioneRegole[]).map((id) => ({ id, titolo: T.regole.titoli[id], blocchi: sezioni[id] }));
}

// ─── Aiuti per le frasi ──────────────────────────────────────────────────────

const blocco = (testo: string, ...figure: FiguraRegole[]): BloccoRegole => ({ testo, figure });
/** Un blocco senza figure che comincia con parole in grassetto ("Ovile pieno."). */
const conApertura = (forte: string, testo: string): BloccoRegole => ({ forte, testo, figure: [] });
const carta = (id: IdTipoCarta, didascalia?: string): FiguraRegole =>
  didascalia === undefined ? { disegno: { tipo: 'carta', id } } : { disegno: { tipo: 'carta', id }, didascalia };
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** "3 o 5", "2, 3 o 4". */
const oppure = (v: readonly (string | number)[]) =>
  v.length <= 1 ? String(v[0] ?? '') : `${v.slice(0, -1).join(', ')} o ${v[v.length - 1]}`;
/** "un numero", "quattro numeri", "una Testata", "due Testate". */
function quantiInLettere(n: number, singolare: string, plurale: string, femminile: boolean): string {
  if (n === 1) return `${femminile ? 'una' : 'un'} ${singolare}`;
  return `${T.regole.lettere[n] ?? String(n)} ${plurale}`;
}
const nome = (id: IdTipoCarta) => defCarta(id).nome;
function valore(id: IdTipoCarta): number {
  const def = defCarta(id);
  return def.famiglia === 'guaio' ? 0 : (def.valore ?? 0);
}
/** +2, −2 (con il segno meno tipografico, come sulle carte). */
const conSegno = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
/** "4 uguali o 4 diversi". */
const frasiEliminazione = (r: readonly RegolaEliminazione[]) => oppure(r.map((x) => `${x.quanti} ${x.regola}`));
/** Mette il punto in fondo a una frase, se non finisce già con . ! o ? (es. "Beee-NO!"). */
const chiudi = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
/** La frase del tratto, uguale nello scopo e nei Guai: conta il Guaio scoperto nel round, mai quelli dell'Angolo. */
const FRASE_TRATTO =
  'Ogni pecora ha un tratto. Quando il Guaio del round è del tipo che ama prende +1 al punteggio, quando è del tipo che teme −1. ' +
  `Con la ${T.tipiGuaio.tosatura} il tratto non conta.`;
/** Ultimo spareggio del mazzo finito (motore §9.3). */
const VITTORIA_CONDIVISA = 'Se sono ancora pari vincono insieme.';
const quantiUguali = (r: readonly RegolaEliminazione[]) => (r.find((x) => x.regola === 'uguali') ?? r[0])?.quanti ?? 0;
/** I Guai Meteo del catalogo, nell'ordine di cards.json. */
const guaiMeteo = () =>
  Object.values(CATALOGO.carte).flatMap((d) => (d.famiglia === 'guaio' && d.tipo === 'meteo' ? [d.id] : []));
const nomiTipi = () => elenco(TIPI_GUAIO_CARTA.map((t) => T.tipiGuaio[t]));

// ─── Le sezioni ──────────────────────────────────────────────────────────────

function sezioneScopo(setup: typeof SETUP): BloccoRegole[] {
  const posti = Object.entries(setup.perNumeroGiocatori)
    .map(([n, d]) => ({ n: Number(n), posti: d.postiOvile }))
    .sort((x, y) => x.n - y.n)
    .map((x, i) => (i === 0 ? `${x.posti} posti in ${x.n} giocatori` : `${x.posti} in ${x.n}`));
  return [
    blocco(
      'Ognuno guida una pecora e raccoglie agnellini nel suo Ovile. Il Montone, con le sue testate, li fa cadere dagli Ovili degli altri.',
      { disegno: { tipo: 'agnellino' } },
      { disegno: { tipo: 'montone' } },
    ),
    blocco(
      `Vince chi riempie per primo il proprio Ovile (${posti.join(', ')}). Vince anche l'ultima pecora rimasta in gioco. ` +
        `Se il mazzo finisce si gioca un ultimo round, poi vince chi ha più agnellini e, a parità, chi ha meno Guai. ${VITTORIA_CONDIVISA}`,
    ),
    blocco(
      FRASE_TRATTO,
      ...setup.pecore.map((p): FiguraRegole => ({ disegno: { tipo: 'pecora', pecora: p.id }, didascalia: T.regole.tratto(p.nome, p.bonus, p.malus) })),
    ),
  ];
}

function sezioneRound(setup: typeof SETUP): BloccoRegole[] {
  return [
    blocco('Si scopre il Guaio del round.', carta('fulmine-curioso')),
    blocco('Ognuno sceglie in segreto una Trovata dalla sua mano e la gioca coperta.', carta('carriola')),
    blocco('Le Trovate si scoprono insieme. Punteggio = valore della carta + tratto della pecora + effetti + Belati.'),
    blocco('Chi ha il punteggio più alto lancia il Dado del Pastore.', { disegno: { tipo: 'dado' } }),
    blocco(
      `Chi ha il punteggio più basso prende il Guaio e lo mette nel suo Angolo dei Guai, riceve 1 agnellino di consolazione e può scartare una carta. Poi tutti ripescano fino a ${setup.manoIniziale} carte.`,
      { disegno: { tipo: 'agnellino' } },
    ),
  ];
}

function sezioneCarte(setup: typeof SETUP): BloccoRegole[] {
  const valoriTrovate = Object.values(CATALOGO.carte).flatMap((d) => (d.famiglia === 'trovata' ? [d.valore] : []));
  const vale = (id: IdTipoCarta) => `${nome(id)} vale ${valore(id)}`;
  const [g1, g2] = ['calzino-gemello', 'pantofola-gemella'] as const;
  // In due giocatori il mazzo perde alcune Trovate (setup.json): lo si dice, così gli esempi qui sopra restano veri.
  const tolti = setup.varianteDueGiocatori.valoriTrovateTolti;
  const gemelleRimaste = [
    ...new Set(Object.values(CATALOGO.carte).flatMap((d) => (d.famiglia === 'trovata' && d.gemella && !tolti.includes(d.valore) ? [d.nome] : []))),
  ];
  const dueGiocatori =
    tolti.length === 0
      ? []
      : [
          blocco(
            `In due giocatori si tolgono dal mazzo le Trovate di valore ${elenco(tolti.map(String))}` +
              (gemelleRimaste.length === 0 ? '.' : `, e tra le Gemelle ${gemelleRimaste.length === 1 ? 'resta' : 'restano'} solo ${elenco(gemelleRimaste)}.`),
          ),
        ];
  return [
    blocco(
      `Le Trovate hanno un valore da ${Math.min(...valoriTrovate)} a ${Math.max(...valoriTrovate)} e a volte un effetto, scritto sulla carta. ` +
        `${vale('fischietto-da-richiamo')}, ${vale('cannocchiale')}.`,
      carta('fischietto-da-richiamo'),
      carta('cannocchiale'),
    ),
    blocco(`Altre non hanno effetto e contano solo per il valore. ${vale('carriola')}, ${vale('balla-di-fieno')}.`, carta('carriola'), carta('balla-di-fieno')),
    blocco(
      `Due Gemelle si possono giocare insieme e i loro valori si sommano. ${nome(g1)} (${valore(g1)}) e ${nome(g2)} (${valore(g2)}) insieme valgono ${valore(g1) + valore(g2)}.`,
      carta(g1),
      carta(g2),
    ),
    ...dueGiocatori,
    blocco(
      `I Belati si giocano fuori turno, nel momento scritto sulla carta. ${nome('belato-di-gruppo')} dà ${conSegno(valore('belato-di-gruppo'))} al punteggio di una pecora, ` +
        `${nome('pernacchia')} ${conSegno(valore('pernacchia'))}. ${nome('visita-di-garzina')} ti toglie un Guaio dall'Angolo dopo che ne hai preso uno. ` +
        `Il più famoso, ${nome('beee-no')}, ha una sezione tutta sua.`,
      carta('belato-di-gruppo'),
      carta('pernacchia'),
      carta('visita-di-garzina'),
    ),
    blocco(
      `I Guai sono le carte che nessuno vuole. Ce ne sono di ${T.regole.lettere[TIPI_GUAIO_CARTA.length] ?? TIPI_GUAIO_CARTA.length} tipi, ognuno con la sua icona.`,
      ...GUAI_DIVERSI.map((id) => {
        const def = defCarta(id);
        return carta(id, def.famiglia === 'guaio' ? T.tipiGuaio[def.tipo] : undefined);
      }),
    ),
  ];
}

function sezioneDado(setup: typeof SETUP): BloccoRegole[] {
  const totale = setup.dado.reduce((s, f) => s + f.copie, 0);
  const testate = setup.dado.filter((f) => f.effetto === 'testata').reduce((s, f) => s + f.copie, 0);
  const quantita = (effetto: 'pascolo' | 'furto') => setup.dado.filter((f) => f.effetto === effetto).map((f) => f.quantita);
  const didascalia = (f: FacciaDado) =>
    f.effetto === 'testata' ? T.regole.faccia.testata : T.regole.faccia[f.effetto](f.quantita);
  const facce =
    `${maiuscola(quantiInLettere(totale, 'faccia', 'facce', true))}: ${quantiInLettere(totale - testate, 'numero', 'numeri', false)}` +
    (testate > 0 ? ` e ${quantiInLettere(testate, 'Testata', 'Testate', true)}.` : '.');
  const blocchi = [blocco(facce, ...setup.dado.map((f): FiguraRegole => ({ disegno: { tipo: 'faccia', faccia: f.id }, didascalia: didascalia(f) })))];
  if (quantita('pascolo').length > 0) blocchi.push(blocco(`Pascolo: prendi ${oppure(quantita('pascolo'))} agnellini dal Gregge.`));
  if (quantita('furto').length > 0) blocchi.push(blocco(`Furto: ruba ${oppure(quantita('furto'))} agnellini agli altri, divisi come vuoi. Se gli altri non ne hanno abbastanza, il resto viene dal Gregge.`));
  if (testate > 0) {
    blocchi.push(
      blocco(
        `Testata del Montone (${testate} ${testate === 1 ? 'faccia' : 'facce'} su ${totale}): scegli un avversario, tira indietro il Montone come una fionda e lascialo andare verso il suo Ovile.`,
      ),
      blocco(rigaTestata(setup), { disegno: { tipo: 'recinto' } }),
    );
  }
  blocchi.push(blocco('Gli agnellini oltre l\'ultimo posto libero non si prendono. Riempire l\'Ovile basta per vincere.'));
  return blocchi;
}

function sezioneGuai(setup: typeof SETUP): BloccoRegole[] {
  const ricciolo = setup.pecore.find((p) => p.id === 'ricciolo') ?? setup.pecore[0];
  const uguali = guaiMeteo().slice(0, quantiUguali(setup.eliminazione.normale));
  const blocchi = [
    blocco(
      `I Guai sono di ${T.regole.lettere[TIPI_GUAIO_CARTA.length] ?? TIPI_GUAIO_CARTA.length} tipi: ${nomiTipi()}.`,
      ...TIPI_GUAIO_CARTA.map((t): FiguraRegole => ({ disegno: { tipo: 'guaio', guaio: t }, didascalia: T.tipiGuaio[t] })),
    ),
  ];
  if (ricciolo) {
    blocchi.push(
      blocco(
        `${FRASE_TRATTO} ${ricciolo.nome} prende +1 al punteggio quando il Guaio del round è di tipo ${T.tipiGuaio[ricciolo.bonus]}, ` +
          `−1 quando è di tipo ${T.tipiGuaio[ricciolo.malus]}.`,
        { disegno: { tipo: 'pecora', pecora: ricciolo.id }, didascalia: T.regole.tratto(ricciolo.nome, ricciolo.bonus, ricciolo.malus) },
      ),
    );
  }
  // Una regola per blocco, ognuna con il suo gruppo di figure: tre Meteo per "uguali", un Guaio per tipo per "diversi".
  setup.eliminazione.normale.forEach((r, i) => {
    const inizio = i === 0 ? 'Sei eliminata con' : 'Oppure con';
    blocchi.push(
      r.regola === 'uguali'
        ? blocco(`${inizio} ${r.quanti} Guai uguali, cioè dello stesso tipo.`, ...uguali.map((id) => carta(id)))
        : blocco(`${inizio} ${r.quanti} Guai diversi, uno per tipo.`, ...GUAI_DIVERSI.slice(0, r.quanti).map((id) => carta(id))),
    );
  });
  blocchi.push(
    blocco(`In due giocatori servono ${frasiEliminazione(setup.eliminazione.dueGiocatori)}.`),
    blocco(
      `La ${T.tipiGuaio.tosatura} è un jolly e vale come un Guaio del tipo che ti serve. Ogni Tosatura vale come un solo Guaio, e nei Guai diversi conta come un tipo in più.`,
    ),
    blocco('La pecora eliminata lascia la sua mano e restituisce i suoi agnellini al Gregge.'),
  );
  return blocchi;
}

/** L'esempio del Beee-NO! contro Beee-NO!, uguale nella sezione 6 e negli esempi. */
function esempioBeeeNo(setup: typeof SETUP, a: string, b: string): BloccoRegole {
  const bn = nome('beee-no');
  const testata = setup.dado.find((f) => f.effetto === 'testata');
  return blocco(
    `${b} lancia il dado ed esce la Testata. ${a} gioca ${bn} e la annulla. ${b} risponde con un altro ${bn}, che annulla quello di ${a}, e la Testata torna valida.`,
    ...(testata ? [{ disegno: { tipo: 'faccia', faccia: testata.id }, didascalia: b } satisfies FiguraRegole] : []),
    carta('beee-no', a),
    carta('beee-no', b),
  );
}

function sezioneBeeeNo(setup: typeof SETUP, a: string, b: string): BloccoRegole[] {
  const bn = nome('beee-no');
  return [
    blocco(
      `${bn} annulla l'effetto di una Trovata, di un Belato o del dado appena dichiarato. Può annullare anche un altro ${chiudi(bn)} ` +
        `Si gioca anche fuori turno, entro ${setup.finestraReazioneSecondi} secondi da quello che vuoi annullare.`,
    ),
    esempioBeeeNo(setup, a, b),
  ];
}

/** `inDue`: in due giocatori il Belato Finale non può capitare (D36: una parità al minimo è "Tutti pari"), quindi non lo si nomina. */
function sezioneFine(inDue: boolean): BloccoRegole[] {
  return [
    conApertura('Ovile pieno.', 'Chi riempie il proprio Ovile vince subito, anche se l\'ultimo agnellino è quello di consolazione.'),
    conApertura('Ultima pecora.', 'Se resta in gioco una sola pecora, vince lei.'),
    conApertura(
      'Mazzo finito.',
      `Si finisce il round e se ne gioca un altro, l'ultimo. Poi vince chi ha più agnellini e, a parità, chi ha meno Guai. ${VITTORIA_CONDIVISA}`,
    ),
    conApertura(
      'Pari al primo posto in un round?',
      'Lanciano il dado tutti quelli pari, prima chi ha meno agnellini e, a parità anche lì, a caso.',
    ),
    ...(inDue
      ? []
      : [
          conApertura(
            'Pari all\'ultimo posto?',
            'Si fa il Belato Finale. Chi è pari gioca coperta un\'altra Trovata e conta solo il valore stampato, senza tratti, effetti o Belati.',
          ),
        ]),
    conApertura('Tutti pari?', 'Il Guaio torna in fondo al mazzo dei Guai e nessuno lancia il dado.'),
  ];
}

/** `inDue`: in una partita a 2 il primo esempio è a due (nessuna parità possibile al primo posto senza essere "Tutti pari"). */
function sezioneEsempi(
  setup: typeof SETUP,
  eliminazione: readonly RegolaEliminazione[],
  inDue: boolean,
  a: string,
  b: string,
  c: string,
): BloccoRegole[] {
  const uguali = quantiUguali(eliminazione);
  const meteo = guaiMeteo().slice(0, Math.max(uguali - 1, 0));
  const tosatura = 'tosatura-a-sorpresa';
  const round = inDue
    ? `${a} e ${b} fanno 7 e 4. ${a} lancia il dado. ${b} prende il Guaio, riceve 1 agnellino e può scartare una carta.`
    : `${a}, ${b} e ${c} fanno 7, 7 e 4. ${a} e ${b} sono pari al primo posto e lanciano il dado tutti e due, prima chi ha meno agnellini. ` +
      `${c} prende il Guaio, riceve 1 agnellino e può scartare una carta.`;
  return [
    blocco(
      round,
      carta('fulmine-curioso'),
      { disegno: { tipo: 'dado' } },
      carta('cannocchiale'),
    ),
    blocco(
      `${a} ha già ${meteo.length} ${T.tipiGuaio.meteo} nel suo Angolo dei Guai e prende una ${T.tipiGuaio.tosatura}. ` +
        `La Tosatura vale come un ${T.tipiGuaio.meteo}, quindi sono ${uguali} Guai dello stesso tipo e ${a} è fuori.`,
      ...meteo.map((id) => carta(id)),
      carta(tosatura),
    ),
    esempioBeeeNo(setup, a, b),
  ];
}

/**
 * "3 Guai uguali o 4 diversi" per il consiglio della partita di prova (a 3 giocatori, quindi la regola normale),
 * letto da setup.json. È una dichiarazione di funzione perché `T` la usa mentre si costruisce.
 */
function regolaDellaProva(): string {
  return SETUP.eliminazione.normale
    .map((r, i) => `${r.quanti}${i === 0 ? ' Guai' : ''} ${r.regola}`)
    .join(' o ');
}
