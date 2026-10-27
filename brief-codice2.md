# Happy Little Sheeps — Brief di sviluppo per Claude Code

Costruisci **Happy Little Sheeps**, un gioco di carte digitale per 2–4 giocatori che gira nel browser, con le regole della sezione 3 e un tema originale a base di pecore.

Il gioco unisce due idee: le **giocate segrete con Guai ed eliminazioni** (tutti scelgono una carta di nascosto, il peggiore si prende un Guaio) e la **raccolta di agnellini con dado, furti e blocchi** (chi vince il round lancia un dado per riempire il proprio Ovile).

Lavora **una fase alla volta** (sezione 8) e fermati alla fine di ciascuna per la verifica.

## 1. Obiettivo e vincoli

- **Giocatori:** da 2 a 4. Il caso d'uso principale è 3 giocatori.
- **Durata:** una partita dura 10–20 minuti.
- **Due modalità obbligatorie:** un solo dispositivo passato di mano in mano, oppure un dispositivo per giocatore, collegati aprendo lo stesso link.
- **Piattaforma:** web app responsive, usabile su telefono, tablet e computer.
- **Nessuna installazione:** i computer dei giocatori sono aziendali. Nessun passaggio, né per giocare né per pubblicare, può richiedere di installare programmi in locale. Tutto avviene dal browser.
- **Lingua:** italiano. Tutti i testi stanno in un unico file di stringhe.
- **Uso:** privato, tra amici. Nessun account per i giocatori.
- **Costo zero:** usa solo piani gratuiti che non chiedono un metodo di pagamento: GitHub Free con repository pubblico, GitHub Pages, Firebase piano Spark. Non proporre mai il passaggio a piani a consumo (per esempio Firebase Blaze) né funzioni che li richiedono, come Cloud Functions.
- **Regola d'oro:** le regole vivono in un motore separato dall'interfaccia, coperto da test automatici.

## 2. Identità e grafica

Ogni elemento visibile è originale: nomi, testi, illustrazioni, logo, colori, impaginazione delle carte. Non copiare né ricalcare grafica, titoli delle carte o testi di giochi esistenti.

**Riferimento di stile.** Nella cartella `design/` del repository trovi il pacchetto prodotto nella fase di design: `design-tokens.css`, gli SVG di pecore, agnellino, montone, dado, icone e retri, i modelli di carta, sette carte d'esempio e `guida-stile.md`. Usa quei file così come sono e disegna le illustrazioni mancanti seguendo la guida. Se la cartella non c'è ancora, usa una grafica provvisoria (forme e colori semplici) fino alla fase 5 e segnalalo.

**Tono.** Tenero fuori, umorismo nero dentro; caotico e festoso nei momenti del dado. Testi di colore di una riga, scritti da zero.

### Glossario del tema

| Concetto di gioco | Nome in Happy Little Sheeps |
| --- | --- |
| Segnalini da collezionare | Agnellini |
| Riserva comune al centro | Gregge |
| Plancia personale da riempire | Ovile |
| Area dei Guai del giocatore | Angolo dei Guai |
| Carte negative | carte Guaio |
| Tipi di Guaio | Meteo, Predatori, Drammi |
| Guaio jolly | Tosatura a Sorpresa |
| Carte con valore 0–9 | carte Trovata |
| Trovate giocabili in coppia | Trovate Gemelle |
| Carte giocabili fuori turno | carte Belato |
| Belato che annulla | Beee-NO! |
| Dado di chi vince il round | Dado del Pastore |
| Faccia che fa cadere agnellini altrui | Testata del Montone |
| Spareggio tra gli ultimi | Belato Finale |

### Le quattro pecore

| Pecora | Bonus (+1) | Malus (−1) |
| --- | --- | --- |
| Ricciolo, il meteorologo | Meteo | Predatori |
| Brontolana, l'attaccabrighe | Predatori | Drammi |
| Sospirella, la filosofa | Drammi | Meteo |
| Nerina, la pecora nera | Predatori | Meteo |

Bonus e malus si applicano al punteggio del round solo quando il Guaio scoperto è del tipo indicato. La Tosatura a Sorpresa non attiva alcun tratto.

## 3. Regole di gioco

### Come si vince

La partita finisce in uno di questi tre modi:

1. **Ovile pieno.** Appena un giocatore riempie tutti i posti del proprio Ovile, la partita finisce subito e quel giocatore vince.
2. **Ultima pecora.** Se resta un solo giocatore non eliminato, vince lui.
3. **Mazzo finito.** Quando viene pescata l'ultima carta del mazzo principale, si gioca ancora un round completo; poi vince chi ha più agnellini. A parità vince chi ha meno Guai; a ulteriore parità la vittoria è condivisa.

### Preparazione

| Giocatori | Posti nell'Ovile | Agnellini totali | Agnellini iniziali a testa |
| --- | --- | --- | --- |
| 2 | 15 | 30 | 3 |
| 3 | 12 | 36 | 3 |
| 4 | 12 | 44 | 3 |

1. Ogni giocatore sceglie una pecora e mette 3 agnellini nel proprio Ovile. Gli altri formano il Gregge.
2. Mescola il mazzo principale (Trovate e Belati) e dai 5 carte a testa.
3. Mescola il mazzo Guai a parte. La pila degli scarti parte vuota.

### Svolgimento di un round

1. **Guaio.** Scopri la prima carta del mazzo Guai: è il Guaio attivo.
2. **Scelta.** Ogni giocatore sceglie in segreto una Trovata dalla mano. Chi ha due Trovate Gemelle può giocarle insieme: i valori si sommano. Chi non ha Trovate scarta tutta la mano e pesca 5 carte, ripetendo finché ne ha una.
3. **Rivelazione.** Tutte le Trovate si scoprono insieme.
4. **Effetti delle Trovate.** Si risolvono in tre gruppi, ciascuno dal valore più basso al più alto:
   1. effetti che valgono "per tutto il round";
   2. effetti normali;
   3. effetti "durante il calcolo del punteggio".
5. **Punteggio.** Punteggio del round = valore della Trovata (o delle due Gemelle) + tratto della pecora + effetti delle Trovate + Belati giocati.
6. **Finestra dei Belati di punteggio.** Chiunque può giocare Belati "durante il calcolo del punteggio", senza limite di numero.
7. **Dado del Pastore.** Chi ha il punteggio più alto lancia il dado e ne applica il risultato (vedi sotto). Gli altri hanno una finestra per annullarlo con Beee-NO!.
8. **Guaio al peggiore.** Chi ha il punteggio più basso prende il Guaio attivo nel proprio Angolo dei Guai.
9. **Finestra dei Belati di salvataggio.** Chi sta per prendere un Guaio può giocare un Belato che lo evita o lo devia.
10. **Consolazione.** Chi aggiunge un Guaio al proprio Angolo prende 1 agnellino dal Gregge e può scartare una carta dalla mano.
11. **Eliminazioni.** Controlla l'Angolo dei Guai di chi ha appena preso un Guaio.
12. **Fine round.** Tutti ripescano fino a 5 carte. Trovate e Belati giocati vanno negli scarti. Gli scarti **non** si rimescolano.

La vittoria per Ovile pieno si controlla dopo ogni spostamento di agnellini, non a fine round.

Gli effetti delle Trovate sono facoltativi e valgono una volta per carta per round. A parità di valore, l'ordine si estrae a caso. *(Cambiata il 21 ottobre 2026, prima risolveva prima chi aveva meno agnellini: decisione D10 in `docs/motore.md`.)*

### Il Dado del Pastore

| Faccia | Copie | Effetto |
| --- | --- | --- |
| Pascolo piccolo | 2 | Prendi 3 agnellini dal Gregge |
| Pascolo grande | 1 | Prendi 5 agnellini dal Gregge |
| Furto piccolo | 1 | Ruba in totale 2 agnellini agli altri giocatori, divisi come vuoi |
| Furto grande | 1 | Ruba in totale 4 agnellini agli altri giocatori, divisi come vuoi |
| Testata del Montone | 1 | Scegli un avversario e gioca il minigioco della Testata: da 0 a 3 dei suoi agnellini tornano nel Gregge |

- Se gli altri giocatori non hanno abbastanza agnellini da rubare, prendi i mancanti dal Gregge.
- Se il Gregge non ha abbastanza agnellini, prendi quelli che ci sono.
- Gli agnellini oltre l'ultimo posto libero dell'Ovile non si prendono: riempire l'Ovile basta per vincere.

**Minigioco della Testata.** Sostituisce il colpo fisico al dado. Chi ha lanciato vede l'Ovile del bersaglio e un montone: sceglie direzione e potenza con un solo gesto (trascina e rilascia). Il risultato è un numero da 0 a 3 di agnellini caduti, mai più di quanti il bersaglio ne possiede. Per il motore la Testata è un'azione con bersaglio ed esito; il motore convalida solo che l'esito sia nell'intervallo ammesso. Nel simulatore e per i bot l'esito è casuale (0: 20%, 1: 40%, 2: 30%, 3: 10%).

### Beee-NO!

È l'unico Belato giocabile **in qualsiasi momento**, anche fuori dalle finestre. Annulla una sola di queste cose, appena dichiarata e prima che venga applicata:

- l'effetto di una Trovata;
- un altro Belato (anche un altro Beee-NO!);
- il risultato del Dado del Pastore, compresa la Testata.

Nell'interfaccia ogni azione annullabile apre una breve finestra di reazione (sezione 5).

### Eliminazione

Una pecora è eliminata quando nell'Angolo dei Guai ha **3 Guai dello stesso tipo** oppure **4 Guai di tipi diversi** (un Meteo, un Predatore, un Dramma e una Tosatura). La Tosatura a Sorpresa fa da jolly: vale come un Guaio del tipo che manca, quindi può completare l'una o l'altra combinazione (ogni Tosatura ne completa una sola, D29). *(Regola cambiata il 21 ottobre 2026, prima erano 3 Guai di tre tipi diversi: decisione D46 in `docs/motore.md`.)* Chi è eliminato scarta la mano e i suoi agnellini tornano nel Gregge.

### Parità

- **Parità per il più alto:** ogni pari merito lancia il Dado del Pastore, partendo da chi ha meno agnellini.
- **Parità per il più basso: Belato Finale.** Ogni pari merito gioca coperta un'altra Trovata; si scoprono insieme. Conta solo il valore stampato: niente tratti, effetti, Gemelle o Belati. Il valore più basso prende il Guaio. In caso di nuova parità si ripete.
- Chi partecipa al Belato Finale non può vincere il round né lanciare il dado.
- Chi non ha Trovate da giocare nel Belato Finale prende il Guaio. Se restano senza in due o più, il Guaio va in fondo al mazzo e il round finisce.
- **Tutti pari:** il Guaio va in fondo al mazzo, nessuno lancia il dado.

### Scambio dei punteggi

Alcune carte scambiano il punteggio più alto con il più basso. Sono coinvolti solo i giocatori agli estremi; se più giocatori sono pari a un estremo, lo scambio vale per tutti loro. Lo scambio non si applica nel Belato Finale.

### Variante a 2 giocatori

- Togli dal mazzo tutte le Trovate di valore 1, 2 e 3.
- Ovile da 15 posti (vedi tabella di preparazione).
- L'eliminazione scatta con **4 Guai dello stesso tipo** oppure **4 Guai di tipi diversi**, come sopra. *(Prima: 2 Guai per ciascuno dei tre tipi; cambiata il 21 ottobre 2026, D46.)*

### Casi limite (decisioni prese)

| Caso | Decisione |
| --- | --- |
| Punteggi negativi | Ammessi; servono solo a stabilire chi è ultimo |
| Guaio deviato su un altro giocatore | Chi lo riceve può giocare a sua volta un Belato di salvataggio; se lo prende, ha diritto alla consolazione |
| Due Ovili pieni con la stessa azione | Vince chi ha lanciato il dado o giocato la carta |
| Mazzo Guai finito | Rimescola i Guai finiti in fondo o evitati; se non ce ne sono, i round proseguono senza Guaio |
| Mazzo principale finito durante la pescata | Chi non riesce a pescare resta con meno carte; scatta l'ultimo round |
| Giocatore senza Trovate nell'ultimo round | Non gioca: non può vincere il round né prendere il Guaio |

## 4. Carte

Il mazzo principale ha 60 carte (44 Trovate, 16 Belati) e il mazzo Guai ne ha 24. Tutte le carte, le facce del dado e i numeri della preparazione sono definiti in file dati (`cards.json`, `setup.json`), non nel codice.

**Carte Guaio (24).** 7 Meteo, 7 Predatori, 7 Drammi, 3 Tosature a Sorpresa. Ogni carta ha nome, tipo e una riga di testo di colore originale.

**Carte Trovata (44).** Valori da 0 a 9, 4 carte per valore più 4 copie extra distribuite sui valori 4, 5 e 6. Otto Trovate di valore basso (da 1 a 4) sono **Gemelle**. Circa metà delle carte non ha effetto. Le altre usano questi effetti, con nomi a tema pecore inventati da te:

| Effetto | Gruppo di risoluzione | Valore suggerito |
| --- | --- | --- |
| Scarta 1 Trovata dalla mano e somma il suo valore al tuo punteggio | Normale | 0 |
| Prendi 1 agnellino dal Gregge | Normale | 1–2 |
| Scarta fino a 3 carte dalla mano | Normale | 3 |
| Sposta 1 agnellino da un Ovile avversario al Gregge | Normale | 4 |
| Guarda le prime 2 carte del mazzo, tienine 1, scarta l'altra | Normale | 7 |
| Scambia il punteggio più alto con il più basso | Durante il punteggio | 5 |
| Raddoppia l'effetto dei Belati +2 e −2 in questo round | Durante il punteggio | 6 |
| Ignora gli effetti di tutte le altre Trovate in questo round | Per tutto il round | 9 |

**Carte Belato (16).**

| Effetto | Quando si gioca | Copie |
| --- | --- | --- |
| +2 al punteggio di un giocatore a scelta | Finestra di punteggio | 3 |
| −2 al punteggio di un giocatore a scelta | Finestra di punteggio | 3 |
| Scambia il punteggio più alto con il più basso | Finestra di punteggio | 2 |
| Il Guaio che stai per prendere va in fondo al mazzo | Finestra di salvataggio | 2 |
| Il Guaio che stai per prendere va a un altro giocatore | Finestra di salvataggio | 2 |
| Beee-NO!: annulla un effetto, un Belato o un risultato del dado | Sempre | 4 |

Quantità, valori, facce del dado, posti dell'Ovile e tratti delle pecore sono una proposta di partenza: verificali con il simulatore della fase 2 e proponi correzioni se le partite escono dai 10–20 minuti o se un modo di vincere domina sugli altri.

## 5. Modalità di gioco

Entrambe le modalità usano lo stesso motore; cambia solo chi vede cosa e da dove arrivano le azioni.

### Finestre di reazione

Belati e Beee-NO! richiedono che gli altri possano reagire. Ogni azione annullabile apre una finestra:

- **Più dispositivi:** conto alla rovescia di 6 secondi (configurabile) con i pulsanti "Beee-NO!" (solo per chi lo ha in mano) e "Lascia passare". Si chiude appena tutti hanno risposto.
- **Un dispositivo:** nessun timer. Compare la domanda "Qualcuno gioca Beee-NO!?"; chi vuole tocca il proprio nome e conferma dopo la schermata di passaggio.
- Un'opzione "Passa sempre se non ho Beee-NO!" evita attese inutili.

### Un solo dispositivo ("Passa il telefono")

- Nessun servizio esterno: tutto gira nel browser, anche offline.
- Prima di ogni azione segreta compare una schermata "Passa il dispositivo a [nome]" che nasconde tutto finché il giocatore non tocca "Sono io".
- La scelta della Trovata avviene a turno, una mano alla volta; la rivelazione è comune.
- Dado e Testata si giocano sul dispositivo comune, davanti a tutti.
- La partita si salva in automatico nel browser e si può riprendere.

### Più dispositivi tramite link

- Il gioco è un sito pubblico: chi crea la stanza apre il link, sceglie "Crea stanza" e vede codice stanza e QR code.
- Gli altri aprono lo stesso link dal browser, inseriscono codice e nome e scelgono la pecora.
- Serve internet su ogni dispositivo. I dispositivi possono stare su reti diverse.
- Ogni dispositivo mostra solo la propria mano. Tavolo, Gregge, Ovili e Angoli dei Guai sono visibili a tutti.
- Le scelte sono simultanee: un indicatore mostra chi ha già scelto, senza rivelare la carta.
- Il lancio del dado e la Testata si vedono in diretta su tutti i dispositivi.
- Se un ospite si disconnette, rientra nella stessa partita riaprendo la pagina. La partita va in pausa finché manca un giocatore, con opzione per sostituirlo con un bot.
- Se si chiude il browser di chi ha creato la stanza, la partita va in pausa e riprende quando riapre la pagina.
- Facoltativo: una vista "tavolo" senza mani, da proiettare su uno schermo comune.

### Bot (facoltativo, ultima fase)

Un avversario semplice: gioca una Trovata a caso pesata sul valore, ruba a chi ha più agnellini, usa i Belati di salvataggio quando rischia l'eliminazione e Beee-NO! quando un avversario sta per riempire l'Ovile.

## 6. Architettura tecnica

Un solo repository TypeScript, senza server proprio: un sito statico più un servizio realtime gratuito. Nelle partite a più dispositivi il browser di chi crea la stanza è l'unica fonte di verità.

| Modulo | Contenuto | Tecnologie |
| --- | --- | --- |
| `engine` | Stato di gioco, azioni, regole, dati di carte e dado, simulatore | TypeScript puro, Vitest |
| `client` | Interfaccia, illustrazioni SVG, animazioni, minigioco della Testata, modalità a un dispositivo | React, Vite |
| `sync` | Stanze, invio delle azioni, distribuzione delle viste per giocatore | Firebase Realtime Database, piano gratuito Spark |

**Motore.** Una funzione pura `applica(stato, azione) → nuovo stato`, senza accesso a rete, tempo o interfaccia. Il round è una macchina a stati con fasi esplicite: `guaio`, `scelta`, `rivelazione`, `effetti`, `belati_punteggio`, `dado`, `risoluzione_dado`, `guaio_al_peggiore`, `belati_salvataggio`, `belato_finale`, `fine_round`, `ultimo_round`, `fine_partita`. Sopra le fasi c'è una **pila di reazione**: ogni azione annullabile resta in sospeso finché la finestra non si chiude, e un Beee-NO! può a sua volta essere annullato. La casualità (mescolate, dado) passa da un generatore con seme, così ogni partita è riproducibile nei test.

**Informazioni nascoste.** Una funzione `vistaPer(stato, giocatore)` restituisce lo stato senza le mani altrui, l'ordine dei mazzi e le carte coperte. Il browser host pubblica una vista separata per ogni giocatore; nessun client riceve lo stato completo. La protezione è a livello di interfaccia, non crittografica: è un limite accettato.

**Sincronizzazione.** Gli ospiti non decidono nulla: scrivono le proprie azioni nella stanza, il browser host le convalida con il motore e pubblica le nuove viste. Il timer delle finestre di reazione lo gestisce l'host. Il modulo `sync` espone un'unica interfaccia con due implementazioni, locale (un dispositivo) e realtime. Usa solo connessioni HTTPS e WebSocket sicure, non WebRTC, perché passano più facilmente dai firewall aziendali.

**Persistenza.** L'host salva lo stato completo nel proprio browser a ogni azione. Ogni giocatore ha un gettone salvato nel browser per rientrare nella stanza. Le stanze inattive da 24 ore vengono cancellate.

**Pubblicazione.** Sito statico su GitHub Pages, da un repository pubblico, con compilazione automatica tramite GitHub Actions a ogni modifica. Nel repository non devono finire dati personali; le chiavi di configurazione di Firebase per il web sono pubbliche per natura, quindi proteggi il database con regole di accesso limitate alle stanze. Creazione del progetto Firebase e pubblicazione si fanno interamente dal browser; il file LEGGIMI li descrive passo per passo.

## 7. Schermate e interfaccia

Interfaccia pensata prima per il telefono in verticale, poi adattata a tablet e computer.

| Schermata | Cosa mostra |
| --- | --- |
| Home | Logo, "Gioca su questo dispositivo", "Crea stanza", "Entra in una stanza", "Regole" |
| Sala d'attesa | Giocatori collegati, scelta della pecora, codice stanza e QR code, pulsante "Inizia" per l'host |
| Tavolo | Guaio attivo e Gregge al centro, Trovate giocate, mazzi con carte rimaste, Ovili e Angoli dei Guai di tutti |
| Mano | Le proprie carte in basso, toccabili; ingrandimento al tocco prolungato; le Gemelle giocabili insieme sono evidenziate |
| Passaggio dispositivo | Schermo neutro con il nome del prossimo giocatore |
| Riepilogo punteggio | Calcolo riga per riga, chi lancia il dado, chi prende il Guaio |
| Dado | Animazione del lancio, risultato, scelta di chi derubare e quanti agnellini a testa |
| Testata | Ovile del bersaglio, montone, gesto di mira e potenza, agnellini che cadono |
| Finestra di reazione | Cosa sta per succedere, "Beee-NO!" e "Lascia passare", timer |
| Belato Finale | Solo i giocatori coinvolti scelgono; gli altri guardano |
| Fine partita | Vincitore, modo di vittoria, classifica per agnellini, "Rigioca" |
| Regole | Sintesi delle regole consultabile in ogni momento |

**Requisiti**

- Avviso quando a un giocatore manca un solo Guaio all'eliminazione.
- Avviso quando a un giocatore mancano 3 agnellini o meno per riempire l'Ovile.
- Contatore delle carte rimaste nel mazzo principale, con annuncio dell'ultimo round.
- Il calcolo del punteggio è sempre spiegato: valore, tratto, effetti, Belati, totale.
- Gli agnellini si muovono a schermo tra Gregge e Ovili: ogni spostamento è animato e leggibile.
- Animazioni brevi (sotto 800 ms, lancio del dado escluso); disattivabili.
- Ogni tipo di Guaio ha colore **e** simbolo.
- Effetti sonori leggeri e facoltativi.

## 8. Fasi di sviluppo

Ogni fase è completa solo se il suo criterio di accettazione è soddisfatto. Alla fine di ogni fase fermati, riassumi cosa hai fatto e come provarlo, e aspetta il via libera.

| Fase | Cosa consegni | Criterio di accettazione |
| --- | --- | --- |
| 1. Motore | Stato, azioni, tutte le regole della sezione 3, dati di carte e dado, pila di reazione | Test automatici verdi su ogni regola |
| 2. Simulatore | Script che gioca 1.000 partite casuali a 2, 3 e 4 giocatori | Nessun errore o stallo; durata media tra 6 e 12 round; nessun modo di vittoria sopra il 70% delle partite; rapporto con le statistiche |
| 3. Un dispositivo | Interfaccia completa in modalità "Passa il telefono", minigioco della Testata, sito pubblicato | Una partita a 3 si gioca dall'inizio alla fine su un telefono, dal link pubblico, senza vedere le mani altrui |
| 4. Più dispositivi | Modulo sync, stanze con codice, viste filtrate, finestre di reazione con timer, riconnessione | Tre dispositivi aprono il link pubblico e completano una partita; un Beee-NO! giocato da un ospite annulla un lancio di dado; chi ricarica la pagina rientra |
| 5. Grafica | Integrazione del pacchetto `design/`, illustrazioni mancanti, animazioni, suoni | Tutte le carte, le pecore, il dado e gli agnellini seguono la guida di stile |
| 6. Rifinitura | Bot, schermata regole, salvataggio, LEGGIMI | Il LEGGIMI spiega come pubblicare il sito e giocare, senza installare nulla |

**Test da non saltare nella fase 1**

- Ognuno dei tre modi di vincere, compresa la vittoria a metà round per Ovile pieno.
- Ogni faccia del dado; furto con avversari senza abbastanza agnellini; Gregge vuoto o quasi.
- Testata con esito maggiore degli agnellini del bersaglio (va rifiutata).
- Beee-NO! su effetto di Trovata, su Belato, su dado; Beee-NO! annullato da un altro Beee-NO!.
- Trovate Gemelle giocate in coppia, e non ammesse nel Belato Finale.
- Tre Guai uguali, quattro diversi, e ogni combinazione con la Tosatura a Sorpresa; agnellini dell'eliminato che tornano nel Gregge.
- Parità per il più alto (più lanci di dado), per il più basso e totale.
- Belato Finale ripetuto, e con uno o più giocatori senza Trovate.
- Scambio dei punteggi con pari merito a un estremo.
- Trovata che annulla gli altri effetti giocata insieme a effetti di ogni gruppo.
- Guaio deviato che elimina chi lo riceve.
- Mazzo principale esaurito a metà pescata e ultimo round.
- Variante a 2 giocatori: mazzo ridotto, Ovile da 15, soglie di eliminazione diverse.

## 9. Cosa serve dall'utente

Chiedi queste cose quando ti servono, con istruzioni passo per passo da eseguire nel browser:

- attivare GitHub Pages sul repository (fase 3);
- creare il progetto Firebase sul piano Spark e incollare le chiavi di configurazione (fase 4);
- provare il link dalla rete aziendale: il firewall potrebbe bloccare GitHub Pages o Firebase. Se succede, segnala le alternative gratuite.
