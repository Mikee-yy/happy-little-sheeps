# Happy Little Sheeps — passaggio di consegne (13 ottobre 2026)

Questo file serve a riprendere il lavoro in una chat nuova. Leggilo tutto prima di fare qualsiasi cosa, poi leggi anche:
- `CLAUDE.md`: struttura, comandi e regole del progetto;
- `bozze/punto-della-situazione.md`: cosa è fatto, cosa manca, migliorie e rischi;
- `docs/motore.md`: specifica del motore e decisioni D1–D45.
- `bozze/guida-stile-eccezioni.md`: eccezioni alla guida di stile per la scena, in attesa di approvazione.
- `bozze/da-fare.md`: **la lista di tutto ciò che resta da fare**, da tenere aggiornata.

Se serve un dettaglio preciso della vecchia conversazione, la trascrizione completa è qui (file JSONL, molto grande: cercaci dentro, non leggerlo tutto):
il file `420c17b4-616a-46ff-ad4d-f8bd8f6ead1c.jsonl` nella cartella dei progetti di Claude Code sul PC di lavoro (non è nel repository).

---

## 1. Regole fisse (non negoziabili)

- **Non pubblicare senza richiesta.** Siamo in area di test. Niente commit, niente push, niente Artifact, niente modifiche al sito pubblico finché l'utente non lo chiede esplicitamente. Dal 13 ottobre, su sua richiesta, anche `bozze/` è nel repository (pubblico): mai percorsi del PC, nomi utente o email aziendali nei file. `bozze/scena/scena.html` è generato e resta fuori.
- **Si lavora a fasi con stop:** a fine fase ci si ferma e si aspetta il via libera. Non iniziare lavori nuovi senza conferma.
- **Costo zero:** solo GitHub Free, GitHub Pages, Firebase Spark. Mai Blaze né Cloud Functions.
- **Niente installazioni:** Node è quello di VS Code, tramite gli shim in `.tools/bin` (`export PATH="$PWD/.tools/bin:$PATH"` in Bash).
- **Tutti i testi visibili in italiano.** Grafica, nomi e testi solo originali.
- **Identità git:** "Maikiii" <196257962+Mikee-yy@users.noreply.github.com>. Mai l'email aziendale.
- **Il brief vince** sulle carte d'esempio del pacchetto grafico.
- L'utente è il game designer: decide regole e aspetto. Le scelte già prese non vanno riproposte.
- Si risponde all'utente in italiano, in modo chiaro e senza gergo tecnico superfluo.

## 2. Stato del progetto

- **Fasi 1–4 consegnate e pubblicate:** motore, simulatore, gioco su un telefono, gioco su più telefoni con Firebase. Commit `de36174`, sito https://mikee-yy.github.io/happy-little-sheeps/, repo github.com/Mikee-yy/happy-little-sheeps. 789 test verdi.
- **Fase 5 (grafica): in corso** come bozza solo locale in `bozze/scena/`. La bozza simula le regole da sola: non è ancora collegata al motore.
- **Fase 6 (rifinitura):** bot, schermata delle regole, LEGGIMI. Non iniziata.

## 3. Scelte grafiche della fase 5 decise dall'utente

### Ambiente
- Scena **2,5D immersiva**, non 3D vero. L'interfaccia deve "portarti dentro il gioco", non essere fatta di riquadri.
- **Prato:** solo ciuffi d'erba radi, sottili e un po' alti, che si piegano col vento (si muove il ciuffo, non tutto il prato). **Scartati:** fiori, sassi, funghi, puntini lontani, prato fitto.
- **Cielo:** un solo azzurro uniforme (scartata la fascia d'orizzonte a due colori). Va verso il tramonto durante la partita.
- **Sole:** raggi animati; luce e ombre direzionali. Le ombre sono **sagome proiettate** di pecore e agnellini, non linee.
- **Nuvole:** forme varie che cambiano nel tempo, mai tagliate ai bordi.
- **Vento:** muove erba, vello delle pecore e agnellini.

### Tavolo e carte
- **Tovaglia:** classica da picnic a quadri rossi e bianchi (confermata dall'utente il 14 ottobre).
- **Area carte degli avversari:** uno sterrato color sabbia, tendente al giallo, **senza sassi né ciuffi**, spostato verso i bordi dello schermo.
- **Dado:** 3D, sempre pieno, mai trasparente, mai coperto da ciò che sta sotto.
- **Mano a ventaglio:** tocco per sollevare, pressione lunga per leggere, trascinamento sulla tovaglia per giocare.
- **Illustrazioni:** animate quando una carta è mostrata da sola.

### Personaggi
- **Pecore dei giocatori:** animate sul posto.
- **Agnellini:** passeggiano e giocano tra loro (testate, rincorse, cavallina, coro), e verso sera dormono vicini. Le interazioni sono solo scena, non regole.
- **Cartello del gregge:** gli agnellini ci girano attorno, non ci passano sotto.

### Guai meteo (animati e che interagiscono con la scena)
- **Un solo meteo alla volta:** quello nuovo sostituisce il precedente.
- **Nebbia:** più banchi di nuvola grandi che attraversano lo schermo da un lato all'altro. **Scartato:** velo uniforme su tutto.
- **Fulmine:** lascia fumo. La pecora o l'agnellino colpito resta bruciacchiato, con espressione scioccata e pelo elettrizzato, per 5–10 secondi.
- **Gelata:** brina che si attacca a pecore e agnellini, qualche stalattite, ciuffi ghiacciati.
- **Pozzanghera senza fondo:** la crea una nuvoletta di pioggia; ha un mulinello a spirale vero. **Ogni** agnellino che ci passa sopra resta intrappolato a girare fino alla fine; possono esserlo più di uno alla volta.
- Ci sono anche gli altri meteo e il Lupo, già animati.

### Avversari e zoom
- **"A chi?":** un evento può colpire qualsiasi giocatore, non solo me.
- **Disposizioni:** a 2, 3 e 4 giocatori fatte. Con 2 giocatori c'è un solo avversario, più grande e vicino: pecora a sinistra con lo sterrato davanti, recinto accanto, gregge a destra.
- **Tetto massimo: 6 giocatori** (concordato). Oggi le regole vanno da 2 a 4: per 5–6 servono numeri bilanciati col simulatore, 2 pecore nuove e le disposizioni.
- **Orizzontale (PC, telefono girato):** si farà più avanti. Va tenuto in conto in ogni scelta: le disposizioni sono dati proprio per poter aggiungere `DISPOSIZIONI.orizzontale`.
- **Zoom sull'avversario colpito:**
  - deve sembrare un vero zoom della camera;
  - la sua pecora diventa grande come la mia;
  - il suo recinto si allarga alle mie proporzioni;
  - le altre postazioni avversarie vengono **rimosse** durante lo zoom, non solo rese trasparenti.

### Da decidere o approvare
- Le 6 illustrazioni meteo disegnate in bozza.
- Le eccezioni alla guida di stile, scritte in `bozze/guida-stile-eccezioni.md`: ombre col sole, luce, colori d'ambiente (rosso tovaglia, sabbia, pavimento), effetti meteo, tratto delle cose lontane, animazioni. Una volta approvate vanno aggiunte a `design/guida-stile.md`.
- ~~Il disegno definitivo della tovaglia~~: confermata a quadri rossi e bianchi (14 ottobre).

## 4. Come è fatta la bozza

### File
- `bozze/scena/scena.src.html` è il sorgente (circa 2430 righe). Contiene CSS e JS e un segnaposto `<!--SPRITE-->`.
- `bozze/scena/costruisci.cjs` genera `scena.html` inserendo `design/svg/sprite.svg` (senza metadati). **Si modifica solo `scena.src.html`.**
- `bozze/scena/server.cjs` serve l'anteprima su http://localhost:5180, con ricarica automatica (SSE) a ogni modifica.
- **Avvio:** configurazione "bozza-scena" in `.claude/launch.json` (lanciatore `.tools/bozza.cmd`). Va aperta con `preview_start` nel browser interno.
  - Se il riquadro del browser è nascosto, le animazioni si fermano (il rAF viene rallentato): non è un errore.

### Struttura della scena
- Scena logica 390×844, scalata per adattarsi allo schermo e ancorata in basso.
- DOM: `#scena > #camera > #mondo` è il mondo, che si può zoomare. Sopra c'è `#ui`, fisso: mano, pulsanti, carte in volo, lettura, finale, scoppio, linee dello zoom.
- `inScenaDaMondo(x, y)` converte le coordinate del mondo in coordinate dell'UI, tramite la matrice della camera.
- **Un solo ciclo rAF**, `ciclo`: vento, meteo, sole, nuvole e flora (a 30 fps), tween dei recinti, pecore, agnellini, scenette, fumetti, particelle.
  - I tween stanno prima degli agnellini, così un recinto che si restringe li spinge dentro nello stesso fotogramma.
  - `dt` non è mai negativo: al ritorno da un'altra scheda il browser può passare un istante precedente.
- Le animazioni una tantum usano WAAPI. C'è un sistema di particelle su canvas dentro il mondo.

### Disposizioni come dati
- `DISPOSIZIONI.verticale[2|3|4]` (riga ~931) contiene, per ogni avversario: x, y, w, targa, fumetto, recinto `[x, dietro, davanti, larg, k]`, area, tappetino, ventaglio, guai, agnelli, mano, angolo, specchia. Più il gregge (area, zone evita, cartello), `liberoDaPiante` e `prospettiva [y0, k0]`.
- `costruisciTavolo(n)` costruisce il tavolo. Variabili globali: `GIOCATORI`, `AREE`, `AVVERSARI`, `TUTTI`, `DISP`.
- `profondita(y)` dipende da `DISP.prospettiva`, così la scala degli agnellini corrisponde a quella delle pecore avversarie.
- Valori attuali:
  - **2 giocatori:** Bea (ricciolo) con w 84; posti 18; agnellini io 5, Bea 6, gregge 25.
  - **3 giocatori:** Bea (ricciolo), Leo (sospirella, specchiato); posti 15; agnellini io 5, gregge 27.
  - **4 giocatori:** Bea, Ada (brontolana), Leo, tutte con w 50; posti 12; agnellini io 4, gregge 26.
- I totali degli agnellini restano costanti: 36 con 2 giocatori, 45 con 3, 44 con 4 (come in `engine/data/setup.json`).

### Agnellini (`class Agnello`, riga ~1054)
- **Stato "regia":** `prendi`, `rilascia`, `annullaRegia`.
  - `muovi(g, x, y, vel, salto, trappola)` e `effetto(g, fn, trappola)` si risolvono subito se l'agnellino non è in regia: questo ha corretto il meteo che si bloccava.
  - `muovi` sposta le destinazioni fuori dalle zone evita (il cartello).
  - Rete di sicurezza: un movimento guidato non dura più di 8 s.
- `intrappolato` protegge gli agnellini presi nel mulinello.
- `respingi()` tiene l'agnellino dentro il recinto quando non è in regia. Se il cartello lo spinge di lato, scivola verso il basso invece di incastrarsi.

### Pecore (`class Pecora`, riga ~1369)
- Fatte con pezzi dello sprite: zampe, cerchi di lana, testa con orecchie e occhi.
- Strati sovrapposti per fuliggine, pelo elettrico, faccia scioccata e brina.
- Ombra: sagoma proiettata con una matrice.

### Meteo
- `avviaMeteo(id, chi)` (riga ~1899) crea un gettone `m` con `vivo`, `pulisci`, `ok`, `attesa` e un simbolo FERMATO.
- `fermaMeteo()` esegue le pulizie. Un meteo nuovo sostituisce quello in corso.
- `rannicchia(m, area, centri, sec, opz)` raduna gli agnellini al riparo. Ognuno va al punto di raccolta più vicino (il gregge ne ha due, uno per lato del cartello). Chi è lontano corre, così il riparo è fatto entro `ARRIVO_RIPARO` (1,8 s), e dopo 2,5 s chi è rimasto indietro si ferma dov'è. Questo tiene costante la durata di pioggia, grandine e gelata.
- Durate misurate (2, 3 e 4 giocatori, su ogni bersaglio):

  | Meteo | Durata |
  |---|---|
  | Vento | 5–7 s |
  | Lupo | 5–7 s |
  | Grandine | 7,5–9 s |
  | Gelata | 8,5–10 s |
  | Fulmine | 6–11 s (dipende dalla durata del bruciacchiato, scelta a caso) |
  | Pozzanghera | 10,5–14 s |
  | Pioggia | 11,5–14 s |
  | Nebbia | 17–18,5 s (la più lunga, perché i banchi attraversano tutto lo schermo) |

### Camera e zoom
- `animaCamera` usa keyframe con zoom esponenziale e un assestamento finale.
- `inquadra(chi)`:
  - zoom con K = io.w / g.w;
  - allarga il recinto con `recintoVicino` e `disegnaRecinto`, con tween;
  - nasconde le altre postazioni con `sfuma`;
  - disegna `lineeZoom`.
- `sgancia()` annulla tutto. `recinto0` e `area0` conservano la geometria originale, che viene ripristinata esatta.
- Con un avversario, l'effetto parte 1250 ms dopo lo zoom.
- I fumetti sono contro-scalati di 1/zoom. C'è un solo fumetto per pecora.

### Dado
- Sta su un piano trasparente separato, `#dado-piano` (z 356), sopra la tovaglia.
- Le facce hanno uno sfondo pieno. L'ombra è un elemento a parte.

### Strumenti di prova
- Pannello "Prova eventi" costruito da `disegnaPannello()`: chip "A chi?", eventi, scelta 2/3/4 giocatori (`cambiaGiocatori(n)`).
- Funzioni di prova: `guaio(forzato, chi)`, `furto(q, ladro)`, `rubaA(vittima, q)`.
- **Prove automatiche dal browser interno:** se la finestra dell'app non è in primo piano, la pagina risulta nascosta e le animazioni si fermano. Per provare lo stesso si può installare nella pagina, con `javascript_tool`, un orologio finto che sostituisce `performance.now`, `setTimeout`, `setInterval` e `requestAnimationFrame` e fa avanzare la scena a passi di 33 ms. Va scritto da capo a ogni prova, perché non è salvato nella bozza.
- **Ultima prova completa (13 ottobre):** 72 casi, cioè 8 meteo per ogni bersaglio con 2, 3 e 4 giocatori. Tutti finiti, nessun errore, agnellini tutti presenti, zoom e postazioni ripristinati, nessun agnellino intrappolato o fuori dal recinto.

### Migliorie del 13 ottobre (seconda chat)

Progetto: `bozze/migliorie-progetto.md`. Piano: `bozze/migliorie-piano.md`. Registro dell'avanzamento: `.superpowers/sdd/migliorie-piano/progress.md` (fuori da git), con tutte le scelte fatte durante il lavoro.

**Nel gioco vero (`client/`, pubblicato il 13 ottobre), con test automatici (798 verdi):**
- Riassunto "Come si gioca, in breve" in fondo a "Nuova partita" e alla sala d'attesa, con "Leggi tutte le regole ›". Tornando dalle Regole le scelte restano.
- In cima a "Nuova partita": "Puoi leggere le regole in fondo ↓" (toccandolo scende al riassunto).
- Nella Home, un "?" piccolo a cavallo del bordo di "Gioca su questo dispositivo": spiega che si gioca passandosi il dispositivo e che ognuno vede le proprie carte solo nel suo turno.
- **Niente sbirciate su un dispositivo condiviso:** nelle domande a tutti (Beee-NO!, Belati di punteggio) non si vede più la mano, solo i Belati giocabili. Nelle stanze (un telefono a testa) la mano resta intera (`manoIntera`). Il codice segreto è stato scartato dall'utente.

**Nella bozza della scena:**
- **Orologio unico** (`OROLOGIO`, `dopo(fn, ms)`, `ogni(fn, ms)`, `annulla`, `attesa`; `attesaVera` per l'interfaccia). Le animazioni WAAPI della scena ricevono la stessa velocità (`impostaVelocita`), quelle di mano e pulsanti no (`inInterfaccia`).
- **Regia degli eventi:** `eventoInCorso()` (eventi aperti con `conEvento`, meteo, timer della scena, agnellini in viaggio `IN_VIAGGIO`). Velocità 1, 2 con "Animazioni veloci", 6 saltando. Un tocco sul prato durante un evento lo salta; mentre si salta i suoni tacciono.
- **Menu Opzioni** al posto di "Suoni": Suoni, Vibrazione (solo se il telefono vibra), Animazioni veloci, Rivedi i suggerimenti. Salvate in `hls-opzioni`; i suggerimenti sui gesti compaiono solo la prima volta (`hls-consigli-visti`).
- **Vibrazione** (`vibra`): Guaio a me [60,50,60], Beee-NO! [140], mia vittoria [80,60,80,60,220].
- **Mano a misura di dito:** `misuraDito(w, h)` dà S (prato) e D (mano, pulsanti, fumetti, lettura, finale); `--kd` = D/S. `manoInScena`/`scenaInMano` per voli e trascinamento.
- **Telefoni modesti:** `RISPARMIO`. Riposo dopo 20 s senza tocchi né eventi (20 aggiornamenti al secondo). Modo leggero dopo 5 s di fila sotto i 30 fotogrammi al secondo: al massimo 60 particelle, erba e nuvole a 15 al secondo, ombra semplice sotto le carte. Non torna indietro.
- **Banco di prova `bozze/scena/prove.js`:** si carica con `await import('/prove.js?'+Date.now()); PROVE.installaOrologio();` (lo serve `server.cjs`). Contiene l'orologio finto, `provaCompleta(modo)` (72 casi), `provaOrologio`, `provaSalto`, `provaOpzioni`, `provaVibrazione`, `provaDito`, `provaRisparmio`. Le prove lunghe si avviano con `PROVE.lancia(...)` e si leggono con `PROVE.stato()`.
  - **Attenzione:** tenere la scheda della prova in primo piano e farne girare una sola alla volta. In una scheda nascosta l'orologio finto rallenta molto, e una volta ha dato falsi fallimenti.
  - Non re-importare `prove.js` senza ricaricare la pagina: si crea un orologio nuovo che non avanza.
- **Porta della bozza:** `.claude/launch.json` ha `autoPort` (la 5180 era occupata dalla vecchia chat). La porta cambia a ogni avvio.

**Esito delle prove:** tutti i test di compito verdi. Prove complete dei 72 casi passate dopo l'orologio (normale), dopo il salto (normale, veloci al 45–57% delle durate, salto con fine entro 2 s dal tocco).

**Chiusura del 14 ottobre:**
- **Prove complete finali:** normale, veloci e salto, 72/72 ciascuna. In modo leggero 72/72, con al massimo 60 particelle.
- **Revisione finale** fatta da un revisore separato, senza problemi critici. Sono state corrette, ciascuna con una prova `provaCorrezioni`:
  - pioggia che restava accesa dopo un salto;
  - suoni salvati che non si sbloccavano col dito;
  - salto che cancellava la vibrazione;
  - dado che girava fuori dall'orologio della scena;
  - salto che partiva toccando la tovaglia, una carta sollevata o il menu.
- **Problemi minori** in `bozze/da-fare.md`.
- **Nel gioco:** "Nuova partita" ora riparte con dati nuovi, su richiesta dell'utente; le scelte restano solo andando e tornando dalle Regole. 799 test verdi.
- **Non fatto:** il controllo con "Riduci movimento", perché il browser interno non simula la preferenza.
- **Pubblicazione:** le correzioni del 14 ottobre non sono ancora pubblicate.

## 5. Problemi aperti noti
- La bozza non ha più lavori a metà: pioggia sistemata, disposizione a 2 giocatori fatta, prove complete passate.
- **Recinti avversari:** con 3 o 4 giocatori, a vista normale, sono stretti e sembrano affollati quando si avvicinano al pieno (12–15 agnellini). Non è un errore: è una scelta di proporzioni da rivedere quando si porta la scena nel gioco.
- **Durata degli eventi:** la nebbia dura circa 18 s e la pioggia circa 14 s. Nel gioco vero vanno accordate con la finestra di 6 s del Beee-NO!: il conto alla rovescia deve partire a fine animazione, oppure l'animazione deve accorciarsi.
- La bozza non ha test automatici: nel gioco vero la parte degli agnellini va riscritta con dei test.
- **Non ancora provati:** iPhone/Safari (effetto 3D di tovaglia e dado) e telefoni Android economici (prestazioni).
- Gli altri rischi sono in `bozze/punto-della-situazione.md`.

## 6. Cose che l'utente deve ancora confermare
- La prova reale della fase 4 con 3 telefoni.
- Le decisioni D1–D45 in `docs/motore.md`.
- ~~Lo scollegamento di Google Analytics da Firebase~~: già fatto dall'utente (confermato il 14 ottobre).
- ~~La limitazione della chiave Firebase al dominio del sito e la chiusura dell'avviso di GitHub~~: fatto dall'utente (confermato il 14 ottobre).

## 7. Prossimo passo (in attesa della scelta dell'utente)

Le migliorie sono chiuse (14 ottobre), in attesa del via libera dell'utente. Poi la parte C, **partita di prova** dalla schermata principale: tu contro 2 bot, mazzo preparato, suggerimenti col pensiero della tua pecora. È già approvata come idea dall'utente e va fatta nel gioco di oggi, con un suo progetto scritto. Dopo, l'ordine consigliato:
1. Portare la scena nel gioco vero (`client/`): una regia legge gli eventi del motore e li trasforma in animazioni uguali su tutti i telefoni. La parte degli agnellini va riscritta con dei test.
2. 5–6 giocatori: limiti del motore, bilanciamento col simulatore, 2 pecore nuove.
3. Orizzontale.

Altro ancora da fare:
- circa 36 illustrazioni originali delle carte;
- approvazione delle eccezioni alla guida di stile e delle 6 illustrazioni meteo;
- fase 6.

**Non iniziare nessuno di questi lavori senza la conferma dell'utente.**

## Partita di prova (14 ottobre)

Progetto `bozze/partita-prova-progetto.md`, piano `bozze/partita-prova-piano.md`, registro `.superpowers/sdd/partita-prova-piano/progress.md`. Non pubblicata (si pubblica con la nuova grafica).
- **Motore:** `nuovaPartita` accetta `preparazione` (mani, cima del mazzo e dei Guai, primi tiri del dado `dadoPreparato`); dati in `engine/data/prova.json` (`PROVA`). Test `engine/test/prova.test.ts`, che controlla anche la storia dei tre round con i bot veri.
- **Sessione:** `sync/prova.ts` (`SessioneProva`): seme fisso 7, bot con la strategia "semplice" e lo stesso generatore della prova del motore, pausa 1 s, niente salvataggio, `chiudi()` ferma i bot.
- **Gioco:** pulsante "Partita di prova" nella Home; `client/src/prova/` (`regiaProva.ts`, `guida.ts` con i 15 consigli in ordine, `PartitaProva.tsx`); `Partita` ha `umano` e `testa`; in `App` la prova resta montata mentre si leggono le Regole.
- **Storia dei tre round** (giocando le carte "ovvie"): 1) tu tiri Pascolo, Bea prende il Lupo; 2) Bea tira Furto contro di te (Beee-NO!), tu prendi la Grandine; 3) tu tiri Testata, Bea prende Crisi esistenziale. Poi "Ora sai come si gioca!".

## Scena nel gioco, pezzo 1 (15 ottobre, fatto, in attesa della revisione finale)

Il punto 3 ("portare la scena nel gioco vero") è diviso in 4 pezzi: 1) la scena entra nel gioco, 2) la regia che recita gli eventi, 3) le scelte dentro la scena, 4) le stanze. Si pubblica dopo i pezzi 1–3, con la partita su un dispositivo e la prova; le stanze tengono per un po' la grafica di oggi. Progetto del pezzo 1: `bozze/scena-gioco-1-progetto.md`; piano: `bozze/scena-gioco-1-piano.md` (12 compiti). Registro con tutte le scelte: `.superpowers/sdd/scena-gioco-1-piano/progress.md` (fuori da git).

**Stato al 15 ottobre:**
- Tutti i 12 compiti sono fatti e revisionati. Restano la revisione finale di tutto (revisore ad alto impegno) e lo stop di fase.
- Nella partita su un dispositivo e nella partita di prova si gioca dentro la scena 2,5D; le scelte si fanno ancora con i pannelli di oggi, in un cassetto. La scena mostra sempre lo stato vero della partita. Le stanze (`client/src/remoto/`) non cambiano.
- Regola anti-sbirciate: la mano di chi sta in basso è scoperta solo nella schermata privata, quando ha il telefono; durante "Passa a …" e nelle schermate pubbliche si vedono i dorsi. Nella partita di prova la mano di "Tu" è sempre scoperta (un solo umano).
- Corretto il 15 ottobre: targhe degli avversari con nomi lunghi (dentro lo schermo e senza sovrapposizioni a 2, 3 e 4 giocatori), Testata che sta tutta nello schermo senza scorrere, consiglio del tratto della prova ("Nerina se la cava con i Predatori…"), scena caricata a parte (React.lazy, con confine d'errore e pulsante "Riprova"; tolta la soglia alzata in `vite.config.ts`).
- Verificato: partita a 3 intera nel browser (390×844) senza errori in console; nella pagina di sviluppo 72/72 eventi in modo normale, veloce, salto e leggero.
- Decisioni dell'utente: recinti "base" e simboli delle carte senza disegno approvati per ora, da rivedere (in `da-fare.md`). Vitest usa i fili (`pool: 'threads'`) e le scorciatoie `npm`/`npx` in `.tools/bin` lanciano il programma direttamente, per evitare le finestre di terminale.
- Niente pubblicato, niente commit.

**Mappa dei file** (`client/src/scena/`, tranne dove indicato):
- `teatro.ts`: `creaTeatro`, unico punto d'accesso (`allinea(foto, modo)`, `distruggi`, `adatta`, `sospendi`). `ciclo.ts` è il ciclo di animazione, automatico o manuale.
- `fotografia.ts`: funzione pura che traduce la vista del motore in ciò che la scena mostra. `contesto.ts`: ciò che i moduli condividono (DOM, orologio, aree, servizi). `orologio.ts`, `misure.ts`, `disposizioni.ts` + `.json` (geometria per posto, 2/3/4 giocatori), `piattaforma.ts` (API del browser con ripiego per jsdom).
- `scheletro.ts` e `scena.css`: DOM e stili, tutto sotto `.teatro`.
- Cartelle: `servizi/` (opzioni, regia, risparmio, suoni, consigli), `ambiente/` (paesaggio, flora, particelle, cielo), `personaggi/` (agnelli, branco, pecore), `carte/`, `tavolo/` (recinti, postazioni, coperta), `meteo/`, `sviluppo/`.
- `mano.ts`, `lettura.ts`, `camera.ts`, `ordini.ts` (dado, testata, Beee-NO!, Guai, voli di carte).
- React: `Scena.tsx` monta il teatro; `ScenaCaricata.tsx` e `caricaScena.ts` (in `client/src/partita/`) la caricano a parte; `OpzioniScena.tsx` ha gli interruttori delle Opzioni.
- Sviluppo: `client/scena.html` (non pubblicata), `aiuti-prova.ts` (contesto finto e partite simulate per le prove).
