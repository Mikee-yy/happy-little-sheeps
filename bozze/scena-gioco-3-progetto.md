# Scena nel gioco, pezzo 3: le scelte dentro la scena — progetto (19 ottobre 2026)

Progetto approvato a voce, parte per parte, nella chat del 19 ottobre. Questo file lo mette per iscritto. È il terzo dei quattro pezzi del punto 3 (vedi `bozze/scena-gioco-1-progetto.md` per la divisione e le scelte comuni, `bozze/scena-gioco-2-progetto.md` per la regia).

## Lo scopo

Si gioca dentro la scena 2,5D. Carte, bersagli, risposte, dado e furto si scelgono toccando la scena, al posto dei pannelli di oggi nel cassetto. Vale per la partita su un dispositivo e per la partita di prova. Dopo questo pezzo si pubblica.

**Criterio di riuscita:**
- una partita intera a 2, 3 e 4 giocatori e la prova si giocano solo toccando la scena, senza mai aprire un pannello;
- ogni momento della tabella del § 1 ha il suo gesto, con la scritta in alto che dice cosa fare;
- si possono fare solo le mosse permesse dal motore, come oggi;
- la regola anti-sbirciata resta: la propria mano è scoperta e si gioca solo quando si ha il telefono;
- durante le animazioni (pezzo 2) non compare nessuna domanda.

**Fuori dal pezzo 3:**
- le stanze con più telefoni (pezzo 4): tengono i pannelli di oggi;
- la Testata a fionda nella scena (idea segnata in `bozze/da-fare.md`, da valutare dopo la pubblicazione);
- la vista orizzontale;
- le rifiniture "prima della pubblicazione" di `bozze/da-fare.md`, un passo a parte.

## Decisioni dell'utente (19 ottobre)

- **Giocare una carta, in due modi:** tocchi la carta, si solleva al centro e sotto compare "Gioca"; oppure la trascini sulla tovaglia.
- **Bersagli:** le pecore che si possono scegliere si illuminano e saltellano; si tocca la pecora o il suo recinto. In alto una scritta dice cosa si sta scegliendo, con "Annulla".
- **Dado:** si tira toccandolo sulla tovaglia.
- **Testata del Montone:** il gioco di mira di oggi, in un riquadro sopra la scena invece che nel cassetto.
- **Chi risponde** (Beee-NO!, Belati di punteggio): le pecore di chi può rispondere si illuminano, chi vuole tocca la sua; altrimenti "Nessuno".
- **Furto:** ogni tocco sul recinto di un avversario prende un agnellino, che si alza; toccandolo di nuovo lo si rimette. In alto "Ruba ancora N", poi "Conferma".
- **Momenti senza scelta:** finita l'animazione compare in basso un pulsante "Continua".
- **Consigli della prova:** una nuvoletta a pallini che esce dalla propria pecora (il suo pensiero), con "Ho capito".
- **Strada A:** una parte nuova senza grafica prepara "la domanda di adesso" dalle mosse permesse; la scena la mostra e restituisce la risposta, che diventa la mossa del motore.

---

## 1. Cosa vede e fa il giocatore

Regole comuni a tutti i momenti:
- **la scritta in alto** dice sempre cosa fare ("Scegli la carta del round", "Tocca la pecora da colpire"…), con "Annulla" quando si può tornare indietro. Gli avvisi di oggi (per esempio quelli sotto il titolo dei pannelli) compaiono qui;
- ciò che si può toccare **si illumina**; il resto è spento e non risponde;
- **tenere premuta una carta** la fa leggere, come oggi;
- i pulsanti ("Gioca", "Conferma", "Continua", "Nessuno", "Passo"…) sono piccoli e chiari, dentro la scena; i testi stanno in `client/src/testi.ts`.

| Momento (fase o richiesta del motore) | Pannello di oggi | Nella scena |
|---|---|---|
| Carta del round (`scelta`) | `PannelloScelta` | Tocchi la carta: si solleva e compare "Gioca · 5". Oppure la trascini sulla tovaglia. **Gemelle:** con una carta sollevata tocchi la sua gemella, si sollevano insieme e il pulsante mostra il totale. Le carte che non si possono giocare restano spente. |
| Effetto della Trovata (`effetti`) | `PannelloEffetto` | La carta sta al centro con "Attiva" e "Rinuncia". Se serve un bersaglio (`sposta_agnellino`), "Attiva" accende le pecore da toccare. |
| Guarda le prime 2 (`richiesta guarda_due`) | `PannelloRichiesta` | Le due carte compaiono grandi sopra la tovaglia; tocchi quella da tenere (si può leggerle tenendo premuto). |
| Scarta e somma, scarta fino a tre (`richiesta`) | `PannelloRichiesta` | Tocchi le carte, che si sollevano; poi "Scarta (2)" oppure "Non scartare" (solo per "fino a tre"). |
| Chi risponde? (`finestra` di reazione, `belati_punteggio`) | `PannelloDomanda` | In alto la mossa a cui si risponde e "Qualcuno risponde? Tocca la tua pecora". Le pecore dei candidati si illuminano; sotto c'è "Nessuno". Toccata una pecora: "Passa il dispositivo a…", come oggi. Nella prova l'umano salta questo passo, come oggi. |
| Risposta (Beee-NO!) | `PannelloReazione` | Dopo "Sono io" chi risponde vede la sua mano: si illumina solo il Beee-NO! giocabile. Lo gioca (tocco + "Gioca" o trascinando) oppure tocca "Passo". Su un dispositivo condiviso c'è anche "Annulla" (torna a "Chi risponde?"). |
| Belati di punteggio (`belati_punteggio`) | `PannelloPunteggio` | Si gioca il Belato dalla mano; se serve un bersaglio (`modifica_punteggio`) si accendono le pecore dei partecipanti, compresa la propria. "Passo" per non giocare. |
| Dado (`dado`) | `PannelloLancio` | Il dado sulla tovaglia si illumina; lo tocchi e rotola nella scena (la faccia la decide il motore, la scena la recita come nel pezzo 2). |
| Furto (`risoluzione_dado`, dichiarazione) | `PannelloDichiarazione` | Tocchi i recinti degli avversari: ogni tocco prende un agnellino, che si alza sopra il recinto; toccando un agnellino alzato lo rimetti giù. In alto "Ruba ancora N"; "Conferma" quando la divisione è una di quelle permesse. Non si può prendere più del massimo per avversario né del totale. |
| Testata: chi colpire (`risoluzione_dado`, dichiarazione) | `PannelloDichiarazione` | Si accendono le pecore degli avversari; tocchi quella da colpire. |
| Testata: il colpo (`esito_testata`) | `Testata.tsx` | Il riquadro di mira di oggi (`Testata.tsx`), sopra la scena. Poi la scena recita il colpo vero (pezzo 2). |
| Belato finale (`belato_finale`) | `PannelloBelatoFinale` | Come la carta del round: tocco + "Gioca" o trascinando. |
| Salvataggio dal Guaio (`belati_salvataggio`) | `PannelloSalvataggio` | La carta del Guaio sta al centro. Giochi un Belato dalla mano; se devia il Guaio (`devia_guaio`) si accendono le pecore. Oppure "Prendi il Guaio". |
| Consolazione (`consolazione`) | `PannelloConsolazione` | Per curare: tocchi il Guaio nel tuo angolo e giochi la carta di cura (i Guai curabili si illuminano). Poi, se vuoi, tocchi una carta da scartare, e "Fatto" (o "Non scartare"). |
| Momenti senza scelta (`guaio`, `rivelazione`, `guaio_al_peggiore`, `fine_round`, `ultimo_round`) | `PannelloAutomatico` | Finita l'animazione compare in basso "Continua"; la scritta in alto dice cosa è successo (il testo dei pannelli di oggi). |
| Turno di un bot (solo prova) | "X pensa…" | La nuvoletta della propria pecora dice "Bea sta pensando…". |
| Consigli della prova | riquadro giallo sopra il cassetto | Nuvoletta a pallini che esce dalla propria pecora, con il consiglio e "Ho capito". Anche "Ora sai come si gioca!" con i suoi due pulsanti. |
| Fine partita | `FinePartita` | Invariata: festa (pezzo 2), poi la schermata con classifica, "Rigioca" e "Torna alla home". |

**Cosa non cambia:**
- la schermata "Passa il dispositivo" / "Sono io";
- la regola anti-sbirciata: la propria mano è scoperta solo nella schermata privata di chi ha il telefono (nella prova sempre);
- durante le animazioni non si sceglie niente; il tocco sul prato salta, come nel pezzo 2. Un tocco sul prato mentre c'è una domanda abbassa la carta sollevata, come oggi, e salta il meteo che continua ancora sullo sfondo dopo i primi 5 secondi (corretto il 20 ottobre: prima diceva che non saltava niente);
- il menu in alto e le Opzioni.

**Consigli della scena:** a "Tocca una carta per sollevarla" e "Tieni premuta una carta per leggerla" si aggiunge "Trascina una carta sulla tovaglia per giocarla" (una volta sola, come gli altri).

---

## 2. Come è costruito

### 2.1 Le domande (`client/src/scena/scelte/`, puro)

Nessun DOM, nessuna grafica: si prova tutto senza browser.

- **`domandaDi(vista, schermo, azioni, scelta)`** → la domanda di adesso:
  - che cosa si può toccare: carte della mano, pecore, recinti, dado, Guai dell'angolo, carte grandi di "Guarda le prime 2";
  - la scritta in alto e gli avvisi;
  - i pulsanti, con il loro testo e se sono attivi;
  - che cosa è già scelto: carte sollevate, agnellini presi nel furto, carta in attesa del bersaglio.

  `schermo` è quello di oggi (`client/src/partita/regia.ts` e `client/src/prova/regiaProva.ts`); `azioni` sono le mosse permesse (`azioniPossibili`).
- **`scelta`** è lo stato della scelta a metà: carte sollevate, agnellini presi, bersaglio in attesa. Cambia con **`avanza(scelta, gesto)`** a ogni gesto (tocco su carta, pecora, recinto, agnellino, dado, Guaio, carta grande; pulsante; carta trascinata sulla tovaglia).
- **La risposta:** quando un gesto completa la scelta, `avanza` restituisce la mossa da mandare al motore, presa **solo tra le mosse permesse**. Una mossa illegale non si può costruire. Per "Chi risponde?" la risposta è il giocatore scelto (come `scelto` oggi), non una mossa del motore; "Nessuno" è la mossa di sistema di oggi.
- Ogni momento della tabella del § 1 è un caso di `domandaDi` e `avanza`. Le regole sono quelle dei pannelli di oggi (per esempio le Gemelle di `PannelloScelta`, il furto di `PannelloDichiarazione`), spostate qui.

### 2.2 La scena (`client/src/scena/`)

Il teatro mostra la domanda e avvisa dei gesti. Non conosce le regole.

- **`Teatro.chiedi(domanda, suGesto)`** mostra la domanda; **`Teatro.smettiDiChiedere()`** la toglie. Una domanda nuova sostituisce la vecchia.
- Cosa mostra:
  - la scritta in alto (nella striscia della scena, sotto il menu);
  - le illuminazioni: pecore che saltellano, recinti, dado, Guai dell'angolo; il resto spento;
  - i pulsanti sotto la carta sollevata ("Gioca"), in basso ("Continua", "Nessuno", "Passo", "Conferma", "Fatto"…);
  - le carte grandi di "Guarda le prime 2";
  - gli agnellini presi nel furto, alzati sopra il recinto;
  - la nuvoletta del pensiero della propria pecora (consigli e bot della prova).
- **Mano:** il tocco solleva come oggi; con una domanda attiva compare "Gioca" sotto la carta sollevata. Il trascinamento sulla tovaglia (sopra la mano, come nella bozza: rilascio sopra y 640) gioca la carta; altrimenti la carta torna nel ventaglio come oggi. Più carte possono essere sollevate insieme (Gemelle, scarti).
- **Tastiera e lettori di schermo:** gli elementi illuminati diventano raggiungibili con Tab (`role="button"`, nome leggibile) e si attivano con Invio o Spazio; la scritta in alto è annunciata (`aria-live`).
- **"Riduci movimento":** niente saltelli, solo l'illuminazione.
- **Ricostruzione** (cambio di chi sta in basso, ridimensionamento, ritorno da un'altra scheda): il teatro rimostra la domanda in corso con le scelte a metà.

### 2.3 Il collegamento con il gioco (`Partita.tsx`, `PartitaProva.tsx`)

- Quando la scena è libera (pezzo 2: niente recita, o dopo i 5 s del meteo, o dopo un tocco che salta) e non c'è "Passa il dispositivo", `Partita` calcola la domanda e la passa al teatro. Mentre la scena recita, la domanda è tolta; la `scelta` a metà resta e torna se la domanda è ancora la stessa (stesso schermo e stesse mosse permesse).
- A ogni gesto `Partita` chiama `avanza`; se c'è una mossa la manda alla sessione, come fanno oggi i pannelli. La scena poi la recita (pezzo 2) e, a scena libera, arriva la domanda successiva.
- **Errore del motore** (non dovrebbe succedere): la scritta in alto mostra l'errore di oggi e la domanda si ripresenta.
- **Il cassetto** resta solo come riserva: se la scena non si carica (`ScenaCaricata` in errore) si gioca con i pannelli di oggi, come oggi. Le stanze (`client/src/remoto/`) non cambiano.
- **Testata:** il componente `Testata.tsx` si riusa in un riquadro sopra la scena.
- **Prova:** i consigli (`client/src/prova/guida.ts`) e "Ora sai come si gioca!" passano dalla nuvoletta del pensiero; i bot e la pausa (`SessioneProva.pausa`) restano come nel pezzo 2.

---

## 3. Casi particolari

- **Quando compare la domanda:** solo a scena libera e mai sopra "Passa il dispositivo"; mai durante la festa o la classifica.
- **Mosse dei bot a metà scelta (prova):** la domanda sparisce durante l'animazione e torna dopo; se è la stessa domanda, le carte già sollevate restano sollevate.
- **Chi risponde con un Beee-NO!:** dopo "Sono io" vede tutta la sua mano (è sua e ha il telefono), ma si illuminano solo le carte giocabili.
- **Domande pubbliche** (dado, furto, Testata, "Chi risponde?", "Continua"): la mano resta coperta (dorsi), e chi decide può non essere la pecora in basso: si illuminano gli elementi del tavolo, non la mano.
- **Furto:** gli agnellini presi sono solo una scelta: si spostano davvero quando la mossa è confermata e la scena la recita. "Annulla" rimette giù tutti gli agnellini alzati.
- **Carta trascinata fuori dalla tovaglia o carta non giocabile:** torna nel ventaglio, nessuna mossa.
- **Tocco su un elemento spento:** nessun effetto (niente mosse, niente errori).

---

## 4. Prove

- **Domande (pure):** ogni momento della tabella del § 1 con partite vere del motore (`engine/test/aiuti.ts`, come le prove del copione):
  - la domanda giusta, con gli elementi toccabili giusti;
  - ogni percorso di `avanza` (Gemelle, bersagli, furto con massimi, scarti fino a tre, consolazione, "Annulla");
  - ogni mossa prodotta è tra quelle permesse;
  - su partite giocate a caso, scegliendo a caso solo tra gli elementi toccabili, si arriva sempre a una mossa permessa e la partita finisce.
- **Scena (jsdom):** `chiedi` mostra scritta, illuminazioni e pulsanti; tocco, trascinamento sulla tovaglia, tocco su pecore, recinti, agnellini, dado e Guai arrivano a `suGesto`; elementi spenti non rispondono; tastiera; ricostruzione con domanda in corso.
- **Gioco:**
  - partite intere a 2, 3 e 4 giocatori e la prova, giocate solo con i gesti nella scena (nessun pannello montato);
  - anti-sbirciata con le domande;
  - riserva con i pannelli quando la scena non si carica.
- **Browser** (a misura di telefono, 390×844, finestra visibile): partite intere e la prova toccando la scena; ogni momento guardato a occhio; nessun errore in console; i 72 casi della pagina di sviluppo ancora verdi.

---

## Rischi

- **Dita grandi su schermo piccolo:** i recinti degli avversari sono stretti con 3 e 4 giocatori (proporzioni da rivedere, voce in `bozze/da-fare.md`). Si tocca anche la pecora, non solo il recinto, e la zona di tocco è più grande del disegno.
- **Molti momenti diversi:** 13 tipi di scelta. Le regole sono già nei pannelli di oggi: si spostano nella parte pura, con le prove, invece di riscriverle.
- **Scritta in alto e targhe dei giocatori:** possono sovrapporsi; la scritta va sotto il menu e sopra le postazioni, da controllare a 2, 3 e 4 giocatori.
