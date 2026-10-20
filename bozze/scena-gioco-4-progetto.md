# Scena nel gioco, pezzo 4: le stanze — progetto (20 ottobre 2026)

Progetto approvato a voce, parte per parte, nella chat del 20 ottobre. Questo file lo mette per iscritto. È l'ultimo dei quattro pezzi del punto 3 (vedi `bozze/scena-gioco-1-progetto.md`, `-2-` e `-3-`). Dopo questo pezzo si pubblica tutto insieme.

## Lo scopo

Nelle partite con un telefono per giocatore (le "stanze", `client/src/remoto/`) si gioca dentro la scena 2,5D, come nella partita su un dispositivo: la scena recita le mosse uguali su tutti i telefoni (pezzo 2) e le scelte si fanno toccando la scena (pezzo 3). Anche la vista "proiettore" passa alla scena.

**Criterio di riuscita:**
- una partita intera a 3 telefoni (pagina di sviluppo `client/prova.html` e prove automatiche) si gioca solo toccando la scena, senza pannelli;
- su ogni telefono la scena recita tutte le mosse con le stesse animazioni;
- il conto alla rovescia del Beee-NO! resta pieno per la durata normale dell'animazione e poi scorre, uguale su tutti i telefoni;
- i momenti senza scelta e i bot sostituti aspettano la durata normale delle animazioni;
- la mano di un giocatore non compare mai su un altro telefono;
- le regole di Firebase (`database.rules.json`) non cambiano.

**Fuori dal pezzo 4:**
- cambi alle regole di Firebase o nuovi percorsi nel database;
- la Testata a fionda, la vista orizzontale, 5–6 giocatori.

## Decisioni dell'utente (20 ottobre)

- **Conto alla rovescia del Beee-NO!: durata normale fissa.** Chi ospita calcola la scadenza = momento della mossa + durata normale dell'animazione + i secondi della finestra scelti in sala d'attesa. È uguale per tutti: chi salta l'animazione ha qualche secondo in più per pensare, nessuno aspetta il telefono più lento. Le durate normali stanno in un file di dati.
- **Momenti senza scelta:** vanno avanti da soli, ma dopo la durata normale dell'animazione più la pausa per guardare di oggi.
- **Bot sostituti:** aspettano la durata normale dell'animazione prima di muovere.
- **Lo "Spettacolo"** (riquadro con dado e Testata degli altri) si toglie: lo fa la scena.
- **Vista proiettore:** passa alla scena nel pezzo 4.
- Valgono le decisioni dei pezzi 2 e 3 (salto e animazioni veloci solo sul proprio telefono; scelte con i gesti; "Cura" con conferma; striscia in alto con la X).

---

## 1. Cosa vede chi gioca

- **Il telefono è suo:** la sua pecora sta in basso, la sua mano è sempre scoperta. Niente "Passa il dispositivo", niente "Chi risponde?".
- **Le scelte** sono quelle del pezzo 3 (tabella del § 1 di `bozze/scena-gioco-3-progetto.md`), con tre differenze:
  - **risposte (Beee-NO!, Belati di punteggio):** su ogni telefono che può rispondere si illuminano le carte giocabili, con "Passo"; niente "Annulla" (non c'è un elenco di nomi a cui tornare);
  - **momenti senza scelta:** niente "Continua": la scritta dice cosa succede e si va avanti da soli;
  - **quando tocca agli altri:** la scritta dice chi si aspetta (i testi di oggi delle stanze, per esempio "Aspettiamo Bea…"); la mano resta scoperta e si può leggere tenendo premuto, ma niente è toccabile.
- **Conto alla rovescia:** sta nella striscia in alto, sotto la scritta. Resta pieno e fermo finché dura l'animazione normale della mossa, poi scorre fino alla scadenza. Vale per chi può rispondere e per chi aspetta.
- **"Passa sempre se non ho niente da giocare"** resta, nel menu, come oggi.
- **Rimane com'è oggi:** sala d'attesa, velo di pausa (qualcuno è uscito, chi ospita è assente, sostituisci con un bot), messaggio quando chi ospita rifiuta una mossa, schermo che resta acceso, rivincita a fine partita (dopo la festa nella scena).
- **Si toglie:** lo "Spettacolo".
- **Riserva:** se la scena non si carica, il tavolo e i pannelli di oggi.

**Vista proiettore:** la scena intera senza mano, senza domande e senza conto alla rovescia, che recita tutte le mosse; in basso la pecora del primo giocatore (o di chi ha creato la stanza). In alto la cronaca come oggi.

---

## 2. Come è costruito

### 2.1 Un pezzo comune tra telefono singolo e stanze

Il collegamento del pezzo 3 in `client/src/partita/Partita.tsx` (scena pronta, momento, scelta a metà, gesti, blocco dopo una mossa, scritta nella striscia, riquadro della Testata, pannelli di riserva, festa prima della classifica) diventa un componente o un hook condiviso. `Partita` (un dispositivo e prova) e la partita delle stanze lo usano; a ciascuna resta il suo:
- `Partita`: "Passa il dispositivo", "Chi risponde?", consigli della prova;
- stanze: conto alla rovescia, velo di pausa, rifiuti di chi ospita, rivincita, "passa da solo".

### 2.2 Lo schermo della stanza diventa un momento

`client/src/remoto/regiaRemota.ts` (`scenaRemota`) dice oggi a ogni telefono quale pannello mostrare a partire dalle sue mosse permesse. Un adattatore lo traduce nella forma che usano le domande del pezzo 3 (`privata` / `pubblica` / `automatica` per il giocatore del telefono, `condiviso: false`, mano sempre scoperta), più uno schermo d'attesa ("Aspettiamo…") senza elementi toccabili. Le regole delle domande (`client/src/scena/scelte/`) non cambiano.

### 2.3 Le durate normali e chi ospita

- **File di dati** con la durata normale di ogni animazione della scena (le battute del copione del pezzo 2: dado, fumetti, carta in volo, Beee-NO!, agnellini, Testata, Guaio con meteo o Lupo fino ai 5 s, rivelazione, eliminazione, festa…).
- **Una funzione pura** calcola, dagli eventi di una mossa, quanto dura la sua recita normale. Una prova controlla che ogni tipo di battuta del copione abbia la sua durata nel file, e che la funzione dia lo stesso numero di battute del copione.
- **Chi ospita** (`sync/host.ts`) la usa:
  - **scadenza della finestra** = momento della mossa + durata normale della sua recita + secondi della finestra;
  - **momenti senza scelta**: avanzano dopo la durata normale della recita dell'ultima mossa + la pausa di oggi (`TEMPI.prosegui`);
  - **bot sostituti**: muovono non prima della fine della recita normale dell'ultima mossa (e non prima del ritardo di oggi).
- Le pause di oggi (giocatore in pausa, chi ospita scollegato) restano come sono: la finestra riparte a tempo pieno.
- **Nessun nuovo messaggio tra telefoni:** gli altri telefoni non mandano niente in più. Le regole di Firebase non cambiano.

### 2.4 Il conto alla rovescia sui telefoni

Ogni telefono conosce la scadenza (pubblicata come oggi) e i secondi della finestra: la barra resta piena fino a "scadenza − secondi della finestra" e poi scorre. Si usa l'ora del server di oggi (`sessione.ora()`).

### 2.5 Altre cose

- **Pre-caricamento della scena** entrando o rientrando in una stanza (oggi solo per la partita su un dispositivo e la prova).
- **Mossa rifiutata da chi ospita:** il blocco dopo la mossa si toglie e la scelta riparte vuota; il messaggio di oggi resta.
- **Ospite che torna da un'altra scheda o dopo uno scollegamento:** la scena si mette in pari subito, come nel pezzo 2.
- Gli ospiti ricevono gli ultimi 40 eventi: bastano (oltre 8 battute in coda la scena si mette in pari subito).

---

## 3. Casi particolari

- **Due eventi nella stessa scadenza:** la scadenza si calcola dalla mossa che apre la finestra; una mossa successiva nella stessa finestra (un altro Beee-NO!) apre una finestra nuova con il suo calcolo, come oggi.
- **Animazioni veloci o salto** su un telefono: non cambiano niente per gli altri.
- **Telefono lento:** se la scena non ha finito quando la barra comincia a scorrere, la domanda compare appena la scena è libera (regola del pezzo 2); la scadenza non cambia.
- **Chi ospita è anche un giocatore:** il suo telefono è come gli altri; il conto lo calcola la sua sessione, non la sua scena.
- **Vista proiettore aperta a partita in corso:** si mette in pari subito, poi recita le mosse nuove.

---

## 4. Prove

- **Durate:** il file copre ogni tipo di battuta; la funzione su partite vere dà durate positive e coerenti col copione.
- **Chi ospita** (orologio finto, `sync/remoto.test.ts`): scadenza = mossa + durata normale + finestra; fasi automatiche e bot che aspettano la durata normale; pause e scollegamenti come oggi.
- **Adattatore** (`regiaRemota`): ogni schermo della stanza dà il momento giusto; schermo d'attesa senza elementi toccabili.
- **Stanze** (`Stanza.test.tsx`, con il teatro finto delle prove di `App`): partita intera a 3 telefoni giocata solo con i gesti; la mano di un giocatore mai su un altro telefono; conto alla rovescia pieno e poi in discesa; rifiuto che sblocca; riserva con i pannelli; vista proiettore con la scena.
- **Alla fine di tutto** (decisione dell'utente: le prove lunghe una volta sola, prima di pubblicare): suite intera, 72 casi del meteo, nel browser `client/prova.html` con tre telefoni affiancati, più partita su un telefono e prova.

---

## Rischi

- **Durate normali sbagliate:** se il file sottostima un'animazione, il conto parte mentre la scena recita ancora. La prova di coerenza col copione e il giro finale nel browser lo controllano; il numero si corregge nel file.
- **Ritardi della rete:** la scadenza è in ora del server, come oggi; un telefono in ritardo vede la barra già un po' scesa.
- **Pezzo comune:** estrarre il collegamento da `Partita` tocca il codice del pezzo 3; le prove del pezzo 3 devono restare verdi.
