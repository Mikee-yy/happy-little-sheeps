# Partita di prova: progetto (14 ottobre 2026)

Progetto approvato a voce, parte per parte, nella chat del 14 ottobre. Questo file lo mette per iscritto. È il punto 2 dell'ordine di lavoro in `bozze/da-fare.md`.

## Lo scopo

Chi non conosce il gioco impara giocando: una partita vera contro due bot, preparata in modo che nei primi tre round succedano le cose importanti, con una guida che spiega ogni momento la prima volta che capita.

**Criterio di riuscita:**
- dalla schermata principale si avvia la prova con un tocco;
- nei primi tre round compaiono i momenti principali (Guaio, scelta della Trovata, punteggio, Belato di punteggio, Pascolo, Furto, Beee-NO!, Testata, consolazione, fine round), ciascuno spiegato una volta;
- alla fine si può continuare contro i bot o tornare alla schermata principale;
- una partita vera salvata non viene toccata.

**Fuori da questo progetto:** la scena 2,5D (punto 3: qui si usano i pannelli di oggi), le stanze a più telefoni, la scelta della pecora nella prova.

---

## 1. Com'è fatta

**Inizio**
- Nella schermata principale c'è un pulsante nuovo, **"Partita di prova"**, sotto "Gioca su questo dispositivo". Parte subito, senza preparazione.
- **Tu** sei **Nerina** (nome mostrato: "Tu"): +1 con i Predatori, −1 con il Meteo. I bot sono **Bea** (Ricciolo) e **Leo** (Sospirella).

**Durante la partita**
- I bot giocano da soli, con una pausa di circa un secondo per mossa. Le loro mosse compaiono nella cronaca; le loro carte non si vedono mai.
- Niente schermate "Passa il dispositivo": le tue scelte compaiono direttamente. Mentre tocca a un bot compare "Bea sta pensando…" (o Leo).
- Nelle domande a tutti (Beee-NO!, Belati di punteggio) i bot rispondono da soli: a te viene chiesto solo per la tua mano, senza elenco di nomi.
- Le fasi automatiche restano con "Continua", come nel gioco su un dispositivo: così hai il tempo di leggere.

**I tre round preparati** (in `engine/data/prova.json`, modificabile senza toccare il codice)

| Round | Guaio | La tua mano aiuta a… | Tiro del dado preparato |
|---|---|---|---|
| 1 | Lupo vegetariano (Predatori: per te +1) | fare il punteggio più alto | Pascolo piccolo: 3 agnellini dal Gregge |
| 2 | Grandine a sorpresa (Meteo: per te −1) | non essere il più alto: tira un bot | Furto piccolo: il bot ruba 2 agnellini; tu hai un Beee-NO! per annullarlo |
| 3 | un Guaio dei Drammi | essere di nuovo il più alto | Testata del Montone, con il minigioco su un bot |

- Nella tua mano iniziale ci sono anche un **Belato di Gruppo** (+2) e **due Gemelle**.
- Le carte esatte di mani e cima del mazzo si fissano nel piano, e una prova del motore verifica che, giocando le carte "ovvie", i tre round vadano come in tabella.
- Le carte le scegli tu: se giochi diversamente, alcune cose possono andare in altro modo, ma la guida spiega comunque quello che succede davvero.
- Finiti i tiri preparati, il dado torna casuale. Il resto del mazzo è mescolato come in ogni partita.

**Dopo il terzo round** compare il riquadro **"Ora sai come si gioca!"** (testo 16) con due scelte:
- **"Continua la partita":** si prosegue contro i bot fino alla fine;
- **"Torna alla schermata principale".**

**Salvataggi:** la partita di prova non si salva. Una partita vera già salvata resta com'è, e "Riprendi la partita" continua a funzionare.

## 2. I suggerimenti

**Come compaiono**
- In un riquadro **"Consiglio"** in cima al pannello, uno alla volta, con il pulsante **"Ho capito"**.
- Ciascuno compare **solo la prima volta** che capita il suo momento. Se due momenti arrivano insieme, il secondo aspetta.
- Con la scena 2,5D (punto 3) diventeranno i pensieri della tua pecora; i testi restano gli stessi.

**Testi** (approvati il 14 ottobre; vanno in `client/src/testi.ts`)

| # | Momento | Testo |
|---|---|---|
| 1 | Inizio | Questa è una partita di prova contro Bea e Leo. Lo scopo è riempire per primo il tuo Ovile di agnellini. Ti spiego le cose man mano che succedono. |
| 2 | Primo Guaio scoperto | Ogni round si scopre un Guaio. Chi farà il punteggio più basso se lo prende. |
| 3 | Il Guaio del round tocca il tratto della tua pecora (prima volta) | Nerina se la cava con i Predatori: con loro ha +1. Con il Meteo invece ha −1. *(cambiato il 14 ottobre: prima diceva "questo round hai +1", falso se il consiglio restava aperto fino a un round col Meteo)* |
| 4 | Prima scelta della Trovata | Scegli in segreto una Trovata: il numero grande è il suo valore. Chi fa di più tira il dado, chi fa di meno prende il Guaio. Tieni premuta una carta per leggerla tutta. |
| 5 | Alla scelta hai due Gemelle in mano (prima volta) | Le carte con il quadrifoglio sono Gemelle: due insieme si giocano come una sola e i valori si sommano. |
| 6 | Prime Trovate scoperte | Le Trovate si scoprono tutte insieme. Il punteggio è valore + tratto della pecora + effetti + Belati. |
| 7 | Puoi giocare un Belato di punteggio (prima volta) | Ora si possono giocare i Belati "durante il calcolo del punteggio". Belato di Gruppo dà +2 a chi vuoi tu. |
| 8 | Tocca a te tirare il dado (prima volta) | Hai il punteggio più alto: tira il Dado del Pastore! |
| 9 | Primo Pascolo | Pascolo: chi ha tirato prende agnellini dal Gregge e li porta nel suo Ovile. |
| 10 | Primo Furto | Furto: chi ha tirato ruba agnellini agli altri giocatori. |
| 11 | Puoi rispondere con un Beee-NO! (prima volta) | Hai un Beee-NO!: si gioca in qualsiasi momento e annulla il dado, l'effetto di una Trovata o un altro Belato. Usalo adesso! |
| 12 | Prima Testata | Testata del Montone: trascina il montone verso l'Ovile e lascia andare. Più tiri, più agnellini tornano nel Gregge. |
| 13 | Prendi un Guaio (prima volta) | Il Guaio finisce nel tuo Angolo. In cambio prendi un agnellino e puoi scartare una carta. Attenzione: con 3 Guai uguali o 4 diversi sei fuori. |
| 14 | Un bot prende un Guaio (prima volta) | Il più basso prende il Guaio, ma riceve un agnellino di consolazione. |
| 15 | Prima fine round | A fine round tutti ripescano fino ad avere 5 carte. |
| 16 | Finito il terzo round | **Ora sai come si gioca!** Se il mazzo finisce, si gioca un ultimo round e vince chi ha più agnellini. Pulsanti: *Continua la partita* · *Torna alla schermata principale* |

I testi 3, 5, 7, 8, 11, 12, 13 e 14 compaiono solo se il loro momento capita davvero.

## 3. Come si costruisce

**Motore** (`engine/`, resta una funzione pura)
- `engine/data/prova.json`: giocatori (id, nome, pecora), mani iniziali, carte in cima al mazzo, ordine dei primi Guai, primi tiri del dado.
- `nuovaPartita` accetta una **preparazione** facoltativa: dopo la mescolata normale mette in cima mazzo e Guai le carte indicate e distribuisce le mani indicate. I tiri preparati stanno nello stato e vengono usati per primi, poi il dado torna casuale. La vista dei giocatori non li mostra.
- Senza preparazione il comportamento è identico a oggi: le prove esistenti lo garantiscono.

**Sessione di prova** (`sync/prova.ts`)
- Come la sessione su un dispositivo, ma i bot muovono da soli con la strategia "semplice" delle stanze, dopo una pausa (circa 1 s). Esito della Testata dei bot come nelle stanze.
- Il caso dei bot passa da un generatore che si può fissare, e la pausa da un temporizzatore sostituibile: le prove automatiche sono ripetibili.
- Nessun salvataggio.

**Gioco** (`client/`)
- Pulsante "Partita di prova" nella Home e una nuova schermata che usa la schermata di gioco di oggi, con queste differenze: niente "Passa il dispositivo" per te, "… sta pensando" per i bot, domande a tutti solo per la tua mano.
- `client/src/prova/guida.ts`: funzione pura che, dalla vista della partita e dai suggerimenti già visti, decide quale suggerimento mostrare.
- Componente "Consiglio" (riquadro con "Ho capito") e riquadro finale con le due scelte.
- Tutti i testi in `testi.ts`.

## 4. Prove

Prima la prova che fallisce, poi il codice.
- **Motore:**
  - con la preparazione, mani, Guai e primi tre tiri sono quelli del file, poi il dado torna casuale;
  - giocando le carte "ovvie" i tre round vanno come nella tabella;
  - senza preparazione non cambia niente.
- **Sessione:**
  - i bot muovono da soli e non toccano le tue scelte;
  - quando tocca a te aspettano;
  - la prova non scrive nel salvataggio.
- **Guida:** ogni momento fa comparire il suo testo una volta sola; i testi condizionati compaiono solo quando serve; due momenti insieme si mettono in fila.
- **Prova completa dalla Home:**
  - si arriva a "Ora sai come si gioca!" con i suggerimenti principali comparsi;
  - "Continua la partita" porta alla fine;
  - "Torna alla schermata principale" esce;
  - una partita vera salvata prima resta riprendibile.
- **Controllo finale:** tutti i test esistenti verdi, controllo dei tipi pulito, prova a vista a 360×640.

## Rischi

- **Strategia dei bot.** "Semplice" potrebbe giocare in modo che il round 2 non vada come previsto (per esempio un bot gioca troppo basso e tiri tu). La prova del motore sui tre round usa le stesse scelte dei bot; se servisse, si aggiusta la cima del mazzo nel file di dati.
- **La guida dipende da come la vista racconta la partita** (eventi e fasi). Se in futuro il motore cambia il nome di un evento, le prove della guida se ne accorgono.
