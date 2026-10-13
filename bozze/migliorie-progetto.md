# Migliorie A e B: progetto (13 ottobre 2026)

Progetto approvato a voce, parte per parte, nella chat del 13 ottobre. Questo file lo mette per iscritto. Resta in `bozze/` (nel repository dal 13 ottobre, su richiesta dell'utente).

## Lo scopo

Sei migliorie proposte nel punto della situazione, divise per dove vivono:

| Parte | Cosa | Dove |
|---|---|---|
| A | Saltare le animazioni e "animazioni veloci", mano a misura di dito, vibrazione, menu Opzioni, telefoni modesti | Bozza della scena (`bozze/scena/scena.src.html`) |
| B | Riassunto del gioco e collegamento alle Regole nella scelta dei giocatori | Gioco vero (`client/`) |
| C | Partita di prova dalla schermata principale | Gioco vero. **Ha un progetto a parte**, da scrivere dopo A e B. |

Restano fuori da questo progetto, ma vanno rispettate quando la scena entra nel gioco: il pannello "Prova eventi" solo in sviluppo e il conto alla rovescia del Beee-NO! che parte a fine animazione (vedi la sezione "Regole per il passaggio nel gioco").

**Criterio di riuscita:**
- su uno schermo basso le carte in mano si leggono;
- ogni animazione si può saltare o accelerare, senza lasciare la scena in disordine;
- la scena pesa meno su un telefono lento;
- chi sceglie i giocatori capisce in un minuto come si gioca.

---

## A1. Orologio unico della scena: saltare e "animazioni veloci"

**Scelta:** un solo orologio della scena, che può andare più veloce. Scartate la versione corta di ogni animazione (troppo lavoro, doppie cose da tenere allineate) e il salto diretto alla fine (fragile, come il vecchio agnellino incastrato).

**Come funziona**
- **L'orologio.** Il tempo della scena avanza nel ciclo principale (`ciclo`), moltiplicato per una velocità: 1 normale, 2 con le animazioni veloci, 6 mentre si salta.
- **Timer e attese.** Tutti i timer degli eventi passano dall'orologio della scena invece che da quello del browser: oggi sono 25 `setTimeout`, 5 `setInterval` e 32 `attesa`.
- **Animazioni una tantum.** Le 30 `.animate(` ricevono la stessa velocità, anche quelle create mentre si salta. Fanno eccezione le animazioni della mano e dei pulsanti, che restano sempre alla velocità normale.
- **Passi brevi.** Il ciclo continua a fare passi di al massimo 50 ms. Quando l'orologio va 6 volte più veloce, fa più passi per fotogramma, così agnellini, recinti e meteo restano stabili.

**Evento in corso**
- **La regia sa sempre quando un evento è in corso.** Ogni evento lo dice quando comincia e quando finisce: meteo, Lupo e gli altri Guai, furto, Beee-NO!, consolazione, pascolo, testata, distribuzione iniziale, vittoria.
- **Accelerazione solo durante gli eventi.** Fuori dagli eventi la velocità è sempre 1: gli agnellini passeggiano tranquilli.
- **Fine del salto.** Il salto finisce da solo quando non resta nessun evento in corso.
- **Un segnale per dopo.** Lo stesso segnale servirà nel gioco vero per far partire il conto alla rovescia del Beee-NO! (vedi sotto).

**Gesti e suoni**
- **Tocco sul prato.** Mentre c'è un evento in corso, un tocco sul prato salta. Toccare la mano, i pulsanti o la tovaglia fa quello che fa sempre.
- **Suoni.** Mentre si salta, i suoni degli eventi tacciono. Con le animazioni veloci i suoni si sentono normalmente.

**"Animazioni veloci":** è un'impostazione del singolo telefono, nel menu Opzioni.

**Prova**
- La prova completa dei 72 casi (8 meteo × ogni bersaglio × 2, 3 e 4 giocatori) si fa tre volte:
  - a velocità normale;
  - con le animazioni veloci;
  - saltando a metà di ogni evento.
- Ogni volta controllo:
  - nessun errore;
  - tutti gli agnellini presenti e nel recinto giusto;
  - nessun agnellino intrappolato alla fine;
  - zoom e postazioni tornati come prima.
- Misuro le durate: con le animazioni veloci devono essere circa la metà di quelle in tabella nel passaggio di consegne.
- Lo script dell'orologio finto, usato per provare con la finestra in sottofondo, lo salvo in `bozze/scena/prove.js`, così non va riscritto ogni volta.

## A2. Mano a misura di dito

- **Due misure.** Il prato si adatta come oggi: S = la più piccola tra larghezza/390 e altezza/844. Le parti da toccare e da leggere usano invece una seconda misura D:
  - D = il più grande tra S e (il più piccolo tra larghezza/390 e 1,25 × S);
  - quindi D non è mai più piccola del prato, non supera la larghezza dello schermo e non è più di un quarto più grande del prato (per lo schermo girato).
- **Parti a misura di dito:**
  - mano;
  - pulsanti sopra la carta sollevata;
  - pulsanti in alto e menu Opzioni;
  - suggerimenti e fumetti;
  - lettura della carta;
  - schermata finale;
  - pannello "Prova eventi".
- **Come si allargano.** Ognuna si allarga dal suo punto d'appoggio: la mano dal centro in basso, i pulsanti dall'alto.
- **Numeri attesi:**
  - 360×640: prato 76%, mano 92%;
  - iPhone in Safari (390×660): prato 78%, mano 98%;
  - 390×844: nessun cambiamento.
- **Contatore del recinto.** Se la mano più grande copre il contatore del mio recinto ("5/15"), lo sposto più in alto.
- **Attenzione:** toccare, sollevare e trascinare le carte usano oggi la misura del prato. Vanno ricalcolati con la misura della mano, se no la carta trascinata non segue il dito.
- **Prova** su 360×640, 390×660, 390×844 e una finestra da PC:
  - foto di ogni misura;
  - una carta sollevata, letta e trascinata sulla tovaglia;
  - i fumetti dentro lo schermo;
  - nessuno scorrimento orizzontale.

## A3. Vibrazione

- **Tre momenti:**
  - Guaio preso da me: due colpetti;
  - Beee-NO! giocato da chiunque: un colpo deciso;
  - mia vittoria: un ritmo di festa.
- **Ritmi** (in millisecondi, vibrazione e pausa alternate):
  - Guaio: 60, 50, 60;
  - Beee-NO!: 140;
  - vittoria: 80, 60, 80, 60, 220.
- **Solo dove il telefono lo permette.** In pratica Android: su iPhone la voce Vibrazione non compare nel menu.
- **Accesa all'inizio**, si spegne dalle Opzioni.
- **Salto.** La vibrazione parte all'inizio dell'evento, quindi saltare non la ripete.
- **Nella bozza** la provocano gli eventi del pannello "Prova eventi". Prova: controllo che i ritmi giusti vengano richiesti al telefono, sostituendo la funzione di vibrazione nella prova.

## A4. Menu Opzioni

- **Il pulsante.** "Suoni" in alto a sinistra diventa **"Opzioni"** e apre un piccolo riquadro con:
  - Suoni: sì/no;
  - Vibrazione: sì/no (solo se il telefono la permette);
  - Animazioni veloci: sì/no;
  - Rivedi i suggerimenti.
- **Salvataggio.** Le scelte si salvano sul telefono. Se il salvataggio non funziona (navigazione privata), valgono quelle predefinite.
- **Suoni.** Anche se erano salvati come accesi, partono solo al primo tocco: i browser non permettono di farli partire da soli.
- **Suggerimenti sui gesti.** Nelle partite normali compaiono solo la prima volta su quel telefono. "Rivedi i suggerimenti" li fa ricomparire.

## A5. Telefoni modesti

- **Riposo.**
  - Quando scatta: dopo 20 secondi senza tocchi e senza eventi in corso.
  - Cosa fa: la scena si aggiorna 20 volte al secondo invece di 60.
  - Quando finisce: al primo tocco o al primo evento.
- **Modo leggero automatico.**
  - Quando scatta: la scena misura quanto scorre fluida, fuori dal riposo e con la pagina in vista. Se per 5 secondi di fila resta sotto i 30 fotogrammi al secondo, passa al modo leggero.
  - Cosa cambia:
    - al massimo 60 particelle invece di 140;
    - circa la metà di quelle di sfondo (petali, semi, foglie);
    - meno anche negli effetti meteo;
    - erba e nuvole aggiornate 15 volte al secondo invece di 30;
    - sotto le carte in mano un'ombra semplice al posto dell'ombra disegnata sulla forma della carta, che oggi è la cosa più pesante.
  - Non torna indietro durante la partita.
  - Il ritorno da un'altra scheda, cioè un fotogramma molto lungo, non conta nella misura.
- **"Riduci movimento":** resta com'è (sfondo fermo, restano le animazioni che spiegano la partita). Lo controllo con le cose nuove: salto, velocità, riposo.
- **Prova:**
  - con l'orologio finto simulo 25 fotogrammi al secondo per 6 secondi e controllo che scatti il modo leggero;
  - a 35 fotogrammi al secondo non deve scattare;
  - poi la prova dei meteo in modo leggero;
  - il riposo deve partire dopo 20 secondi e finire al primo tocco.

---

## B. Riassunto e collegamento alle Regole

- **Dove:**
  - in fondo a "Nuova partita", la preparazione su un telefono (`Preparazione` in `client/src/schermate.tsx`), sotto i pulsanti;
  - in fondo alla sala d'attesa della stanza (`SalaAttesa` in `client/src/remoto/Stanza.tsx`).
- **Testo:** in `client/src/testi.ts`, come tutti gli altri. Titolo "Come si gioca, in breve":
  - **Lo scopo:** riempi per primo il tuo Ovile di agnellini.
  - **Ogni round** si scopre un Guaio, e tutti scelgono in segreto una Trovata dalla mano.
  - **Le Trovate si scoprono insieme.** Al valore si aggiunge il tratto della tua pecora: +1 o −1 se il Guaio è del suo tipo.
  - **Chi ha il punteggio più alto** lancia il Dado del Pastore: pascoli, furti e testate fanno guadagnare agnellini o li tolgono agli altri.
  - **Chi ha il punteggio più basso** prende il Guaio, ma riceve un agnellino di consolazione. Con troppi Guai la tua pecora è fuori.
  - **I Belati** si giocano fuori turno. Beee-NO! annulla un effetto, un Belato o il dado, in qualsiasi momento.
  - **Se il mazzo finisce**, si gioca un ultimo round e vince chi ha più agnellini.
- **Collegamento:** "Leggi tutte le regole ›". Apre la schermata Regole che c'è già. "Indietro" riporta da dove si è venuti:
  - **Dalla preparazione:** nomi, pecore e numero di giocatori restano quelli scelti. Oggi andrebbero persi, perché la schermata ricomincia da capo: le scelte vanno tenute in `App.tsx`.
  - **Dalla sala d'attesa:** si torna nella stanza senza uscirne. Il meccanismo `dopoRegole` lo fa già durante la partita: va esteso.
- **Prove automatiche** (Vitest e Testing Library, accanto a quelle esistenti):
  - il riassunto c'è in tutte e due le schermate;
  - il collegamento apre le Regole;
  - tornando, nomi e pecore sono ancora quelli scelti;
  - dalla sala d'attesa si torna nella stessa stanza;
  - tutti i 789 test esistenti restano verdi;
  - `npm run typecheck` è pulito.
- **Pubblicazione:** fatta il 13 ottobre, su richiesta dell'utente.

---

## Regole per il passaggio nel gioco (da rispettare più avanti)

- **Pannello "Prova eventi".** Esiste solo nella versione di sviluppo, come oggi `client/prova.html`. Non entra nel sito pubblicato.
- **Conto alla rovescia del Beee-NO!**
  - Parte quando sono finite le animazioni in corso, calcolate alla velocità normale.
  - Le durate di ogni evento stanno in un file di dati. Si parte dalle misure della bozza.
  - L'host calcola la scadenza come: momento dell'evento + durata normale delle animazioni + secondi della finestra.
  - Per i tempi conta il momento in cui l'evento è chiaro, non la decorazione che resta. Per esempio, il bruciacchiato del fulmine può durare ancora qualche secondo, ma il conto non lo aspetta.
- **Reazioni:** si possono mandare da quando la finestra si apre, anche durante l'animazione.
- **Salto e animazioni veloci:** valgono solo sul proprio telefono e non cambiano la scadenza per gli altri.

## Rischi

- **Orologio finto e orologio della scena.** La prova con l'orologio finto deve tenere conto dell'orologio della scena: lo script salvato in `prove.js` lo fa una volta per tutte.
- **Animazioni CSS della mano.** Le animazioni CSS legate alla mano non devono accelerare. Le riconosco dal loro elemento: tutto ciò che sta in `#mano` e nei pulsanti resta a velocità 1.
- **Vibrazione su Android.** Chrome per Android vibra solo dopo almeno un tocco sulla pagina. Nel gioco c'è sempre, ma la prima vibrazione di una pagina appena aperta potrebbe non sentirsi.
