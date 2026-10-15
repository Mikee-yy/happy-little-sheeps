# Scena nel gioco, pezzo 1: progetto (14 ottobre 2026)

Progetto approvato a voce, parte per parte, nella chat del 14 ottobre. Questo file lo mette per iscritto. È il primo dei quattro pezzi del punto 3 dell'ordine di lavoro in `bozze/da-fare.md`, "Portare la scena nel gioco vero".

## Il punto 3 in quattro pezzi (deciso il 14 ottobre)

Il punto 3 è troppo grande per un unico progetto. Si divide in quattro pezzi. Ognuno ha il suo progetto, il suo piano, il lavoro, la revisione e uno stop.

| Pezzo | Cosa fa |
|---|---|
| **1. La scena entra nel gioco** (questo file) | La bozza diventa parte del codice. Gli agnellini vengono riscritti con prove automatiche. La scena mostra lo stato vero della partita. |
| 2. La regia | Legge ciò che succede nella partita e lo recita in scena: meteo, Lupo, dado, furto, Testata, Beee-NO!, zoom. Comprende il salto, le animazioni veloci e la ripresa dopo un'altra scheda. |
| 3. Le scelte dentro la scena | Le decisioni che oggi sono pannelli diventano gesti o piccoli riquadri nella scena. I consigli della prova diventano pensieri della pecora. |
| 4. Le stanze | La scena arriva anche nelle partite con più telefoni: stesse animazioni su tutti e conto alla rovescia del Beee-NO! a fine animazione. |

**Decisioni dell'utente:**
- **Si pubblica dopo i pezzi 1–3**, con la partita su un dispositivo e la partita di prova nella scena. Le stanze tengono per un po' la grafica di oggi e passano alla scena col pezzo 4.
- **Strada:** la bozza si smonta e si rimonta a pezzi dentro il gioco. La scena diventa un "teatro" che esegue gli ordini e non decide niente: le regole restano tutte nel motore. Sono state scartate due strade: incollare la bozza così com'è, e rifarla con i componenti dell'interfaccia di oggi (lenta sui telefoni economici).
- **Chi sta in basso** (pecora grande, recinto grande, mano): **chi ha il telefono**. Quando il telefono passa, la scena si ridispone dietro la schermata "Passa a …". Nei momenti pubblici (dado, rivelazione) la scena resta com'è. Nella partita di prova in basso c'è sempre "Tu".
- **Carte senza disegno** (36 tipi su 51, fino al punto 4): cornice, valore, nome e testo come le altre. Al posto del disegno c'è il simbolo del loro tipo in grande.

---

## Lo scopo del pezzo 1

Nella partita su un dispositivo e nella partita di prova si gioca dentro la scena 2,5D invece che sul tavolo a righe di oggi. La scena mostra sempre lo stato vero della partita. Le scelte si fanno ancora con i pannelli di oggi.

**Criterio di riuscita:**
- una partita a 2, 3 e 4 giocatori e una partita di prova si giocano dall'inizio alla fine dentro la scena;
- in ogni momento gli agnellini in scena, recinto per recinto e nel gregge, sono esattamente quelli della partita;
- dopo ogni passaggio del telefono, in basso c'è chi ha il telefono;
- tutte le 51 carte si disegnano senza testo che esce dal suo spazio;
- le 72 prove del meteo della bozza passano anche nella pagina di sviluppo;
- le prove automatiche di oggi restano verdi, adattate dove leggevano il tavolo a righe.

**Fuori dal pezzo 1:**
- animazioni degli eventi: meteo, Lupo, dado che rotola, zoom, furto e Testata recitati (pezzo 2);
- vibrazione legata agli eventi (pezzo 2);
- gesti per giocare le carte e scelte fatte nella scena (pezzo 3);
- consigli della prova come pensieri della pecora (pezzo 3);
- schermata finale della scena (pezzi 2–3);
- stanze (pezzo 4);
- illustrazioni delle carte (punto 4);
- 5–6 giocatori e orizzontale.

---

## 1. Cosa si vede

**La scena al posto del tavolo.** Nella partita su un dispositivo e nella prova, `Tavolo` e le righe degli Ovili lasciano il posto alla scena. Ci sono:
- prato, cielo, sole, nuvole e vento;
- le pecore dei giocatori, ognuna con il suo recinto e un agnellino vero per ogni agnellino della partita;
- il gregge con il suo cartello;
- la tovaglia con mazzo, mazzo dei Guai, scarti, il Guaio del round e il dado (fermo sull'ultima faccia uscita nel round);
- per ogni giocatore, l'angolo dei Guai e lo sterrato con le sue carte (avversari);
- la mano a ventaglio di chi ha il telefono: tocchi per sollevare una carta, tieni premuto per leggerla. In questo pezzo trascinarla non gioca niente.

**Le carte giocate nel round.** Sullo sterrato di ogni avversario e davanti a te:
- una carta coperta quando quel giocatore ha scelto;
- le carte scoperte dopo la rivelazione.

**Cartelli e targhe:**
- ogni recinto ha il cartello "7/15" e il gregge ha "Gregge 32", come nella bozza;
- la targa di chi deve agire è evidenziata, come oggi;
- **due segnalini** sulla targa, come chiede il brief:
  - manca un solo Guaio all'eliminazione (stesso calcolo di oggi, `tipiPericolosi`);
  - mancano 3 agnellini o meno per riempire l'Ovile (`mancanti` ≤ 3). Il cartello "quasi pieno" della bozza segue la stessa soglia.
- Chi è eliminato resta al suo posto, con il recinto vuoto, la targa "Eliminata" e la pecora in posa svenuta. Chi è fuori dal round ha la targa "Fuori dal round".

**Ora del giorno:** come nella bozza, segue l'Ovile più pieno (giorno, pomeriggio dal 50%, tramonto dal 70%, sera dall'86%). Nell'ultimo round è almeno tramonto.

**In alto:**
- round, "ultimo round" e carte nel mazzo, come nell'intestazione di oggi;
- il pulsante del menu;
- sotto, piccola, la **riga di cronaca** di oggi (ultimi 2 eventi, letti anche dai lettori di schermo).

**Menu unico:** Regole, Opzioni e Torna alla schermata principale. Opzioni contiene suoni, vibrazione (solo se il telefono vibra), animazioni veloci e rivedi i suggerimenti, salvate come nella bozza in `hls-opzioni`. I suggerimenti sui gesti in questo pezzo sono solo "tocca" e "tieni premuto".

**Le scelte, per ora, coi pannelli di oggi**, in un **cassetto** in basso, sopra la mano:
- il cassetto si abbassa con una maniglia per guardare la scena;
- torna su da solo quando arriva una domanda nuova;
- gli avvisi scritti di oggi per chi ha il telefono restano nel cassetto;
- è provvisorio: il pezzo 3 lo sostituisce.

**Quando qualcosa cambia, la scena si mette in pari con calma:**
- gli agnellini camminano verso il nuovo recinto o il gregge;
- le carte compaiono o scompaiono con una breve dissolvenza nell'angolo, sullo sterrato, nella mano o negli scarti;
- i numeri si aggiornano.

Niente meteo, zoom o dado che rotola: arrivano col pezzo 2.

**Passaggio del telefono:**
- la schermata "Passa a Bea" di oggi resta;
- dietro di essa la scena si ridispone subito, senza animazioni: Bea scende in basso e gli altri diventano avversari, nell'ordine di gioco da sinistra a destra.

**Restano come oggi:**
- la schermata di fine partita;
- la partita di prova con il riquadro dei consigli, ora in cima alla scena;
- le stanze con più telefoni;
- "Riduci movimento" del sistema, rispettato come nella bozza.

**Recinti degli avversari con 3 e 4 giocatori:** oggi sono stretti e sembrano affollati verso il pieno (12–15 agnellini).
- Nella pagina di sviluppo si preparano **2–3 varianti** di proporzioni. L'utente sceglie guardandole: è una sosta dentro il lavoro.
- La variante scelta va nelle disposizioni.

---

## 2. Come è costruito

### 2.1 Il teatro (`client/src/scena/`)

La bozza viene smontata in moduli TypeScript, con la stessa logica e lo stesso aspetto. La scena non usa React a ogni fotogramma: è codice che lavora direttamente sulla pagina, con un solo ciclo di animazione come nella bozza. React la monta e le passa i dati.

| Parte | Contenuto (dalla bozza) |
|---|---|
| orologio | `OROLOGIO` con `dopo`, `ogni`, `annulla`, `attesa`, `attesaVera`; velocità della scena; tetto di 0,25 s per fotogramma |
| misure | scala della scena 390×844, `misuraDito`, `--kd`, conversioni mondo/interfaccia/mano |
| disposizioni | `DISPOSIZIONI.verticale[2/3/4]` in un **file di dati** (`disposizioni.json`). Contiene la geometria per posto (0 = in basso, poi gli avversari da sinistra a destra), senza nomi né pecore, più la prospettiva |
| ambiente | cielo, sole e luce, nuvole, erba, vento, particelle, ora del giorno |
| personaggi | pecore (con fumetti e reazioni), agnellini (vedi 2.5) e loro giochi |
| meteo | un file per ogni meteo e uno per il Lupo, con `avviaMeteo`/`fermaMeteo` e gli aiuti comuni (`rannicchia`…) |
| camera | `inquadra`, `sgancia`, tween dei recinti, linee dello zoom |
| tavolo | tovaglia, mazzi, scarti, dado 3D, angoli dei Guai, sterrati e ventagli degli avversari |
| carte | disegno delle carte (vedi 2.6) e lettura di una carta |
| mano | ventaglio, sollevare, leggere |
| servizi | suoni, vibrazione, opzioni, risparmio (`RISPARMIO`), regia del salto (`REGIA`, `eventoInCorso`, `conEvento`) |
| **teatro** | l'unico punto d'accesso: crea la scena, la mette in pari, riceve gli ordini, la distrugge |

Le regole finte della bozza non vengono portate: lo stato `st`, le code di carte, `tiraDado` con faccia a caso, `furto` "goloso", Testata automatica, fine partita da `dopoArrivo`. Le animazioni che usavano restano disponibili come ordini (2.9).

Colori e caratteri vengono da `design/design-tokens.css`, invece che dalla tavolozza copiata nella bozza. I simboli vengono dallo sprite che il gioco già carica (`grafica.tsx`).

### 2.2 La fotografia

È una funzione pura (`fotografia.ts`) che, dalla vista della partita e da chi sta in basso, dice cosa deve mostrare la scena.

- **Ingressi:**
  - la vista del tavolo;
  - la mano di chi sta in basso (la sua vista);
  - chi sta in basso.
- **Uscita:**
  - i posti in ordine (0 = chi sta in basso, poi gli altri nell'ordine di gioco); per ognuno: id, nome, pecora, agnellini, angolo, carte in mano, eliminato, fuori dal round, carta coperta o carte scoperte del round, deve agire, i due segnalini;
  - gregge e posti dell'Ovile;
  - la mano di chi sta in basso;
  - mazzo, mazzo dei Guai, scarti (cima);
  - Guaio del round e ultima faccia del dado nel round;
  - round e ultimo round;
  - ora del giorno.

Chi sta in basso:
- **nella partita su un dispositivo** è chi ha il telefono (il "detentore" che `Partita` già conosce). All'inizio è il primo giocatore che deve agire;
- **nella prova** è sempre `umano`.

### 2.3 Mettersi in pari

`teatro.allinea(foto, modo)` confronta ciò che la scena mostra con la fotografia e sistema le differenze.

- **`modo 'calmo'`** (ogni mossa): gli agnellini in più in un posto camminano verso i posti dove ne mancano. Se il gregge è coinvolto, è il primo da cui prendere e il primo a cui dare. Le carte cambiano con una breve dissolvenza, i numeri subito.
- **`modo 'subito'`** (inizio partita, cambio di chi sta in basso, ritorno da un'altra scheda): la scena si ricostruisce nella nuova disposizione, con gli agnellini già al loro posto.
- **Se arriva una nuova fotografia mentre gli agnellini camminano**, le destinazioni si aggiornano: nessun agnellino si perde o si duplica.
- **La verità è sempre il motore.** Il numero totale di agnellini in scena è fisso, quello della partita (36, 45 o 44). Dopo ogni `allinea`, a movimenti finiti, ogni posto ha esattamente il numero della fotografia. Nel pezzo 2 la regia richiama `allinea` dopo ogni animazione, così un intoppo grafico non diventa mai un errore di gioco.

### 2.4 Gli agnellini

Riscritti in tre parti, perché siano provabili senza browser:

- **Registro** (puro): ogni agnellino ha un'identità e un posto. Ricevuta una fotografia, il registro calcola gli spostamenti necessari, cioè quali agnellini e da dove a dove. Garantisce la conservazione del totale.
- **Cervello** (puro): il movimento passo per passo, con posizione, destinazione, salto e corsa. Contiene:
  - le zone da evitare (il cartello del gregge), aggirate scivolando come nella bozza;
  - `respingi` dentro il recinto;
  - la regia (`prendi`, `rilascia`, `annullaRegia`);
  - la rete di sicurezza: un movimento guidato non dura più di 8 s;
  - `intrappolato` (pozzanghera);
  - i giochi tra agnellini e il sonno della sera.
- **Corpo**: il disegno che segue il cervello (sprite `#agnello`, ombra, brina, bruciacchiato).

### 2.5 Le carte

Il disegno (`cartaSVG` della bozza) legge nome, valore, testo, tipo e "Gemella" dal catalogo del motore (`defCarta`). Non ci sono più carte copiate.

**Illustrazioni:** c'è una tabella da carta a disegno. Contiene i 9 simboli dello sprite (`c-sasso`, `c-calzino`, `c-ombrello`, `c-campanaccio`, `b-beeeno`, `b-gruppo`, `b-svenuta`, `g-grandine`, `g-lupo`) e i 6 meteo disegnati nella bozza (`ILL_METEO`). Le illustrazioni animate restano come nella bozza.

**Senza disegno:** al posto del disegno c'è il simbolo del tipo in grande, sul colore della famiglia:
- Guai: `ico-meteo`, `ico-predatori`, `ico-drammi`, `ico-tosatura` (già nello sprite);
- Trovate: l'agnellino dello sprite (`#agnello`);
- Belati: un fumetto "Beee!" disegnato come i meteo della bozza (originale, semplice).

L'utente li vede nella pagina di sviluppo insieme alle varianti dei recinti e può cambiarli.

### 2.6 Il collegamento al gioco

- **`Scena.tsx`:** il componente React che monta il teatro in un riquadro, gli passa la fotografia a ogni aggiornamento della sessione e lo distrugge uscendo. Funziona anche con il doppio montaggio di React in sviluppo.
- **`Partita.tsx`:** quando c'è la scena (partita su un dispositivo e prova) mostra la scena e il cassetto con i pannelli. Il resto della logica resta com'è: scene, passaggio, `scelto`, chiavi dei pannelli.
- **Stanze** (`Stanza.tsx`): invariate, con `Tavolo` di oggi.
- **Accessibilità:**
  - la scena è decorativa per i lettori di schermo;
  - accanto a lei c'è un riassunto testuale nascosto alla vista ("Bea: 7 agnellini su 15, 2 Guai…"), costruito dalla fotografia;
  - la cronaca resta "aria-live".
- **Testi nuovi** (targhe, segnalini, menu, cassetto) in `client/src/testi.ts`.

### 2.7 La pagina di sviluppo

`client/scena.html`, come `client/prova.html`: esiste solo in sviluppo e non entra nel sito pubblicato. Contiene:
- la scena da sola, con 2, 3 o 4 giocatori;
- il pannello **"Prova eventi"** della bozza (chip "A chi?", meteo, Lupo, furto, Beee-NO!, pascolo, cambio giocatori);
- le **varianti dei recinti**, da mostrare all'utente;
- il **banco di prova** della bozza (`prove.js`) portato in TypeScript: orologio finto e prove `provaCompleta` e brevi.

La bozza in `bozze/scena/` resta com'è, come riferimento, fino alla fine del pezzo 3. Poi decide l'utente.

### 2.8 Gli ordini del teatro

Il teatro espone fin da ora gli ordini che la regia userà nel pezzo 2. Li usa già il pannello "Prova eventi", così le 72 prove del meteo girano nel gioco. Gli ordini sono:
- `spostaAgnellini(n, da, a, modo)`, con `da`/`a` = id giocatore o `'gregge'` come `Luogo` del motore;
- `meteo(guaio, chi)` e `fermaMeteo()`;
- `dado(faccia)`, `testata(chi, bersaglio, n)`, `beeeNo(chi)`;
- `guaio(carta, chi)`;
- `inquadra(chi)`, `sgancia()`;
- `fumetto(chi, testo, ms)`, `reagisci(chi, tipo)`;
- `eventoInCorso()`, `salta()`.

Nel gioco vero, in questo pezzo, si usa solo `allinea`.

---

## 3. Prove

**Prove automatiche (Vitest):**
- **orologio:** `dopo`, `ogni`, `annulla`, velocità, tetto per fotogramma (dalle prove `provaOrologio` della bozza);
- **disposizioni:** per 2, 3 e 4 giocatori, ogni postazione, recinto, area e targa sta dentro la scena 390×844; i recinti non si sovrappongono;
- **fotografia:**
  - posti ruotati per chi sta in basso, nell'ordine di gioco;
  - segnalini;
  - carte coperte o scoperte del round;
  - ora del giorno;
  - eliminati e fuori dal round;
- **registro:**
  - spostamenti minimi e totale conservato;
  - nuove fotografie a metà movimento senza perdite né doppioni;
  - **prova del "conto giusto":** decine di partite simulate per intero (2, 3, 4 giocatori, strategie `semplice` e `casuale`); dopo ogni mossa il registro, a movimenti finiti, coincide recinto per recinto con la partita;
- **cervello:**
  - arriva a destinazione;
  - aggira il cartello senza incastrarsi;
  - resta nel recinto;
  - rete di sicurezza di 8 s;
  - intrappolato non si muove;
- **carte:** tutte le 51 si disegnano dal catalogo, quelle senza disegno con il simbolo del tipo;
- **gioco:** le prove di `App.test.tsx` e della partita di prova restano verdi. Quelle che leggevano le righe del tavolo leggono il riassunto testuale della scena.

**Prove nel browser (pagina di sviluppo e gioco in anteprima):**
- `provaCompleta` normale, veloci, salto e modo leggero: 72 casi ciascuna;
- le prove brevi della bozza;
- tutte le 51 carte: nessun testo fuori dal suo spazio, misurato nella pagina;
- schermi stretti e larghi (`misuraDito`);
- una partita intera a 3 giocatori e una partita di prova giocate nell'anteprima;
- controllo che `npm run build` non includa la pagina di sviluppo.

**Sosta:** varianti dei recinti mostrate all'utente, che sceglie.

**Revisione finale** da un revisore separato, poi stop di fase.

---

## 4. Note per i pezzi successivi

**Cose che il motore fa senza raccontarle con un evento** (la regia del pezzo 2 le ricava dalla vista):
- la distribuzione iniziale delle carte;
- le carte del tavolo che vanno negli scarti a fine round;
- l'Angolo di chi viene eliminato;
- apertura e chiusura della finestra di reazione;
- i cambi di fase;
- una faccia del dado senza effetto.

Le altre informazioni ci sono tutte negli eventi (`agnellini` con `da`, `a`, `quanti` e `causa`; `guaio_preso`; `dado_lanciato`; `testata`; `dichiarazione`…). La regia ricorda l'ultimo `seq` visto: il motore tiene gli ultimi 200 eventi, le stanze ne pubblicano 40.

**Durate:** nebbia circa 18 s, pioggia circa 14 s. La finestra del Beee-NO! è di 6 s (`finestraReazioneSecondi`) e per le stanze il conto alla rovescia parte a fine animazione (pezzo 4). Nella partita su un dispositivo non c'è un conto alla rovescia: la domanda compare dopo l'animazione (pezzo 2).

---

## Rischi

- **Dimensione:** è il pezzo più grosso dei quattro, perché sposta circa 2.400 righe della bozza. Il piano lo divide in passi che si provano uno per uno, e l'aspetto si controlla a confronto con la bozza a ogni passo.
- **Doppio montaggio di React in sviluppo:** la scena ha un ciclo di animazione e dei timer. Deve chiudersi del tutto e ripartire pulita, come già visto per i bot della prova.
- **Prestazioni:** con la scena nel gioco React non deve ridisegnarsi a ogni fotogramma. Il risparmio e il modo leggero della bozza vengono portati.
- **Prove nel browser interno:** con la scheda nascosta le animazioni si fermano. Serve l'orologio finto e la scheda della prova in primo piano, come nella bozza.
- **iPhone e Android economici:** ancora da provare. Restano nella lista dei rischi.
