# Happy Little Sheeps — cose da fare

Aggiornato il 21 ottobre 2026 (piccole cose rimandate fatte e pubblicate; scena 2,5D in tutto il gioco: pezzi 1–4 e rifiniture nel commit bf3ffb0, inviato a GitHub il 20 ottobre). Il contesto di ogni voce è in `bozze/passaggio-di-consegne.md`.

**Ripresa (aggiornato il 27 ottobre sera, non pubblicato dal commit 0341882):**
1. **Testata a fionda, seconda versione: finita e provata dall'utente** (27 ottobre, "il resto sembra ok"). Fatti anche: revisione finale con correzioni (Montone accanto alla pecora di chi tira anche in "Passa il telefono", mancato lungo sul prato, corsa via che non passa sopra le pecore, nuvoletta della partita di prova spostata) e, su richiesta dell'utente, la mano delle carte nascosta mentre si tira. Idea valutata e lasciata così dall'utente: Montone sotto il proprio recinto (servirebbe un elastico più corto). Minori rimasti da guardare giocando: Bea che si scansa nel proprio recinto, agnellini scansati in colonna, un agnellino libero sotto il Montone stordito, ombra del sole specchiata, ↓↓ da tastiera che manca corto, Montone a riposo che copre un pezzo del proprio recinto.
2. Animazioni di Belati e Guai e movimento alla pesca: fatti (da vedere con l'utente, `bozze/animazioni-carte.md`).
3. **Schermata delle Regole (fase 6): fatta il 27 ottobre** (progetto `bozze/regole-progetto.md`, piano `bozze/regole-piano.md`, compiti 1–5). Da decidere con l'utente (visto a occhio a 375×812):
   - La fascia "Nella stanza la partita va avanti: torna presto." è alta circa 111 px (tiene il posto del richiamo): tanta per una frase.
   - L'esempio del Beee-NO! contro Beee-NO! è uguale nella sezione 6 e tra i "Tre esempi".
   - Testi d'interfaccia scritti durante il lavoro, da confermare: "La partita è in pausa.", "La partita è finita.", "Un giocatore si è scollegato: decidi tu." (prima "è uscito"; 268 px, su una riga a 360 px, va a capo a 320), "Tocca a te: la partita ti aspetta.", "Torna alla partita".
   - Minori rimandati: frase del tratto ripetuta in "Lo scopo" e in "Guai"; nome della pecora detto due volte (testo alternativo e didascalia), otto zone "region"; `scroll-padding-bottom` di 96 px da confrontare con la barra di Safari; pausa delle animazioni per pannello intero e "Riduci movimento" letto una volta; al ritorno lo scorrimento è rimesso prima di contenuti che arrivassero dopo, e il pulsante d'apertura si ritrova dal testo; in `client/prova.html` la stanza non tiene lo schermo acceso; nessun richiamo per la rivincita; piccole pulizie (asserzione doppia in `figure.test.tsx`, il banco "carte fuori" misura carte animate, prove mancanti sul ritorno in cima e sul margine).
   - "Riduci movimento" non si può simulare nel browser interno: c'è la prova automatica (nessuna carta animata), da guardare su un telefono con l'opzione attiva.
4. **Giro finale di revisione (27 ottobre): fatto, con un giro di correzioni.** Tre revisioni (motore, interfaccia, scena): nessun problema grave. Corretti:
   - partite salvate e stanze della versione pubblicata: alla ripresa le regole di eliminazione si rimettono da `setup.json` (prima a 2 giocatori restava solo "4 uguali", a 3–4 "3 diversi");
   - Regole e consiglio della prova: con la Testata chi è colpito perde gli agnellini, che tornano nel Gregge; i numeri 3/2/1 vengono dai dati, come nel disegno;
   - "Passa il telefono" a 3–4: durante la mira la pecora di chi tira non si attenua più; la scritta della mira dice chi tira ("Anna, tira indietro il Montone…");
   - Furto: "se gli altri non ne hanno abbastanza, il resto viene dal Gregge"; richiamo di chi ospita "si è scollegato"; titoli delle Regole letti "1. Lo scopo"; a 2 giocatori niente Belato Finale nelle Regole ed esempio del round a due ("7 e 4"); "in fondo al mazzo dei Guai" anche nei messaggi della partita; consiglio dell'eliminazione della prova letto da `setup.json`;
   - documenti: numeri di D46/D47 allineati ai rapporti, frase della Tosatura del brief allineata a D29, durata non più ripetuta nella seconda sezione del rapporto dei bot; prova che le stanze usano il bot `normale`; spazio mancante in `grafica.tsx`.
   - **Rimandati** (minori, da guardare giocando o in un altro giro): meteo ancora in corso sul recinto ingrandito dalla mira (pozzanghera e nuvoletta si spostano); proprietà CSS `translate`/`rotate`/`scale` separate nei browser vecchi; "Riduci movimento" letto una volta; didascalie ripetute dei testi alternativi; riga della sala d'attesa che sposta il testo quando la partita comincia; modo leggero che non alleggerisce le animazioni nuove; una mira tolta e rimessa prima del lancio riparte da un punto nuovo a caso; mossa del bot di chi ospita senza try/catch. Anche: a 2 giocatori la riga "Pari al primo posto in un round?" non può capitare (è "Tutti pari"), da decidere se toglierla.
5. Poi: pubblicazione solo se l'utente lo chiede.

Spunta le voci man mano (`- [x]`). Le voci nuove vanno nella sezione giusta.

**Ordine concordato il 14 ottobre:** 1) problemi minori della revisione, 2) partita di prova, 3) scena nel gioco vero, 4) illustrazioni delle carte, 5) 5–6 giocatori, 6) orizzontale, 7) fase 6. **Si pubblica quando si può giocare con la nuova grafica** (dopo il punto 3), non prima.

---

## 1. Chiudere le migliorie A e B (da fare per prima)

- [x] **Prove complete finali della bozza** sul codice definitivo, una alla volta, con la scheda della prova sempre in primo piano (circa 15 minuti l'una):
  - [x] `provaCompleta('normale')`
  - [x] `provaCompleta('veloci')`
  - [x] `provaCompleta('salto')`
  - [x] `provaCompleta('normale')` con `RISPARMIO.leggero = true` e la classe `leggero` su `#scena`

  Come si fa: avvia "bozza-scena" con `preview_start`, poi `await import('/prove.js?'+Date.now()); PROVE.installaOrologio(); PROVE.lancia('provaCompleta', 'normale')`, e leggi il risultato con `PROVE.stato()`. Ogni prova vuole 72 casi e `falliti: []`.
- [x] **Rilanciare le prove brevi** su una pagina appena caricata: `provaOrologio`, `provaSalto`, `provaOpzioni`, `provaVibrazione`, `provaDito`, `provaRisparmio`. Ognuna deve dare `[]`.
- [ ] **Controllo con "Riduci movimento"**: un meteo saltato e uno con animazioni veloci finiscono senza errori. *Non fatto: `RIDOTTO` si legge all'avvio dalla preferenza del sistema e il browser interno non la può simulare. Da provare attivando "Riduci movimento" sul telefono o nel sistema operativo.*
- [x] **Gioco vero:** `npm test` e `npm run typecheck` verdi (799 test, 14 ottobre).
- [x] **Revisione finale** di tutto il lavoro: bozza, gioco e aggiunte chieste in corsa. Le scelte fatte sono nel registro `.superpowers/sdd/migliorie-piano/progress.md`.
- [x] **Stop di fase:** riassunto all'utente con le foto, poi aspettare il via libera. *Fatto il 14 ottobre (via libera alla partita di prova).*

### Problemi minori trovati dalla revisione finale (14 ottobre) — corretti il 14 ottobre (prova `provaMinori` e test del gioco)

- [x] **Bozza:** "Ricomincia" a metà evento lascia in sospeso timer e Guai della partita prima (solo dal pannello di prova). Svuotare `OROLOGIO.timer` e `REGIA` in `preparaPartita`, più un contatore di partita.
- [x] **Bozza:** sotto i 20 fotogrammi al secondo orologio e movimento si separano. Tetto unico di 0,25 s per fotogramma, diviso in passi da 50 ms.
- [x] **Bozza:** l'agnellino liberato dalla pozzanghera non rientra in `IN_VIAGGIO`.
- [x] **Bozza:** la misura della fluidità parte da 0 invece che dall'ora attuale, quindi il modo leggero può scattare un secondo prima.
- [x] **Bozza:** il recinto di un avversario può restare allargato se il meteo si ferma subito dopo lo zoom (raro).
- [x] **Bozza:** il menu Opzioni perde il punto per chi usa la tastiera e non si chiude con Esc.
- [x] **Bozza:** le proprie mosse fatte durante un salto ancora acceso sono mute e veloci.
- [x] **Gioco:** il "?" della Home ha la zona di tocco sopra il bordo di "Gioca su questo dispositivo", e `aria-controls` punta a un elemento assente quando è chiuso. L'avviso "Puoi leggere le regole in fondo ↓" scorre ma non sposta il focus.

### Problemi minori della revisione della partita di prova (14 ottobre)

- [x] Il consiglio 3 sul tratto della pecora, se chiuso solo nel round dopo, può dire "+1" con un Guaio in cui Nerina ha −1. Correggerlo vuol dire cambiare un testo approvato: decide l'utente. *Applicato il 14 ottobre: "Nerina se la cava con i Predatori: con loro ha +1. Con il Meteo invece ha −1."*
- [x] Protezione in più: se una mossa di un bot non avesse azioni o fallisse, ripianificare la mossa (mai successo in 300 partite simulate). *Fatto il 21 ottobre.*
- [x] Mentre si leggono le Regole a metà prova i bot continuano finché non tocca a te, e un consiglio legato a un momento si può perdere. *Fatto il 21 ottobre: con le Regole aperte i bot aspettano.*

## 2. Decisioni che spettano all'utente

- [x] **Rivedere le proporzioni dei recinti degli avversari** (3 e 4 giocatori, quasi pieni). Il 14 ottobre si è scelta per ora la **base** (come la bozza). Nella pagina di sviluppo (`client/scena.html`, selettore "Recinti") restano da confrontare la variante A (recinti più profondi) e la B (agnellini più piccoli lontano). *21 ottobre: scelta la variante A (recinti più profondi), ora è la base.*
- [x] **Rivedere i simboli delle carte senza disegno** (Trovate: agnellino; Belati: fumetto "Beee!"; Guai: icona del tipo). Approvati per ora il 14 ottobre; spariranno man mano con le illustrazioni del punto 4. *21 ottobre: confermati fino all'arrivo delle illustrazioni.*
- [x] **Spostare il suggerimento "Tocca una carta per sollevarla" in basso, vicino alle carte** (segnalato il 15 ottobre: in alto copre il nome di un giocatore). *Fatto il 15 ottobre: ora sta tra la staccionata del proprio recinto e le carte.*
- [x] Approvare le **eccezioni alla guida di stile** (`bozze/guida-stile-eccezioni.md`). Una volta approvate, aggiungerle a `design/guida-stile.md` in una sezione "Scena di gioco". *Approvate tutte il 21 ottobre, ora in `design/guida-stile.md` ("Scena di gioco").*
- [x] Decidere se la **tovaglia** a quadri rossi e bianchi è definitiva. *Confermata dall'utente il 14 ottobre: va bene.*
- [x] Approvare o far ridisegnare le **6 illustrazioni meteo** disegnate in bozza: grandine, pioggia, vento, nebbia, fulmine, gelata. *21 ottobre: grandine e vento approvati; pioggia, fulmine, gelata e nebbia ridisegnati come chiesto dall'utente.*
- [x] Rivedere le **decisioni D1–D45** in `docs/motore.md`. *Fatto il 21 ottobre con l'utente (esito in `bozze/revisione-decisioni.md`): tutte confermate tranne D10, che diventa "a parità di valore, ordine a caso".*
- [ ] Fare la **prova reale della fase 4 con 3 telefoni**.
- [x] **Scollegare Google Analytics** da Firebase. *Già disattivato dall'utente (confermato il 14 ottobre).*
- [x] **Limitare la chiave Firebase** al dominio del sito e chiudere l'avviso di GitHub. *Fatto dall'utente dopo il falso allarme di GitHub (confermato il 14 ottobre).*
- [x] Decidere **quando pubblicare** le modifiche al gioco. *Pubblicate il 13 ottobre su richiesta dell'utente, insieme alla cartella `bozze/`. Per il futuro: commit e push solo su richiesta esplicita.*

## 3. Prossimi lavori (ognuno inizia solo dopo la conferma dell'utente)

- [x] **Partita di prova** (parte C), dalla schermata principale. *Fatta il 14 ottobre (progetto `bozze/partita-prova-progetto.md`, piano `bozze/partita-prova-piano.md`), non pubblicata.* Già approvata come idea, va fatta nel gioco di oggi, con un suo progetto scritto da far approvare:
  - tu contro 2 bot, su un solo dispositivo (servono i bot con un telefono);
  - mazzo preparato nel motore, perché nei primi round succedano le cose importanti (Guaio, dado, furto, Beee-NO!);
  - suggerimenti col pensiero della tua pecora (nuvoletta a pallini) che spiegano ogni momento;
  - non cancella una partita salvata.
- [x] **Portare la scena nel gioco vero** (`client/`): una regia legge gli eventi del motore e li trasforma in animazioni uguali su tutti i telefoni. *Diviso in 4 pezzi (14 ottobre). Si pubblica dopo i pezzi 1–3. Dettagli in `bozze/scena-gioco-1-progetto.md` e `bozze/passaggio-di-consegne.md`.*
  - [x] **Pezzo 1, la scena entra nel gioco.** *Fatto il 15 ottobre: scena nella partita su un dispositivo e nella prova, con i pannelli di oggi in un cassetto. Salvato nel commit locale 033b38b.*
  - [x] **Pezzo 2, la regia:** legge gli eventi del motore e li recita nella scena (dado, furto, Testata, Guai, Beee-NO!). *Fatto il 19 ottobre (progetto `bozze/scena-gioco-2-progetto.md`, piano `bozze/scena-gioco-2-piano.md`), revisione finale fatta. Il conto alla rovescia del Beee-NO! che va in pausa durante le animazioni passa al pezzo 4 (stanze).*
  - [x] **Pezzo 3, le scelte dentro la scena:** carte, bersagli e risposte si scelgono toccando la scena, al posto dei pannelli nel cassetto. *Fatto il 20 ottobre (progetto `bozze/scena-gioco-3-progetto.md`, piano `bozze/scena-gioco-3-piano.md`); i pannelli restano come riserva se la scena non si carica. In attesa della revisione finale.*
  - [x] **Pezzo 4, le stanze:** la scena anche nelle partite con più telefoni. *Fatto il 20 ottobre (progetto `bozze/scena-gioco-4-progetto.md`, piano `bozze/scena-gioco-4-piano.md`): scelte nella scena su ogni telefono, conto alla rovescia del Beee-NO! fermo per la durata normale dell'animazione (file `client/src/scena/regia/durate.json`) e poi in discesa, fasi automatiche e bot che aspettano le animazioni, vista proiettore con la scena. Le regole di Firebase non cambiano.*

  Regole già decise:
  - il pannello "Prova eventi" esiste solo nella versione di sviluppo;
  - il conto alla rovescia del Beee-NO! parte quando le animazioni sono finite (durata normale, presa da un file di dati), e non aspetta le decorazioni come il bruciacchiato;
  - salto e animazioni veloci valgono solo sul proprio telefono;
  - la parte degli agnellini va riscritta con dei test;
  - un telefono che torna da un'altra scheda deve saltare allo stato attuale invece di recitare tutto;
  - i recinti degli avversari, con 3 o 4 giocatori, sono stretti e affollati: le proporzioni vanno riviste.
  - *Discussa il 13 ottobre e per ora scartata dall'utente:* una versione ridotta (solo un dispositivo, scena come tavolo, pannelli di oggi sopra, a un indirizzo separato) da fare in 3–5 ore. Si procede invece nell'ordine normale della lista.
- [x] **Eliminazione con 4 Guai invece di 3** (richiesta dell'utente, 20 ottobre; fatta il 21 ottobre, D46 in `docs/motore.md`). Regola finale: a 3–4 giocatori si esce con 3 Guai uguali o 4 di tipi diversi; a 2 giocatori con 4 uguali o 4 di tipi diversi. La Tosatura resta un jolly e nei "diversi" conta come un tipo in più: 4 diversi = un Meteo, un Predatore, un Dramma e una Tosatura (o due tipi e due Tosature). Tolta la regola "2 per tipo". Aggiornati `setup.json`, prove del motore, testi delle Regole e consiglio della partita di prova, rapporto del simulatore.
- [x] **Testata a fionda nella scena** (idea dell'utente, 19 ottobre; fatta il 26 ottobre, in attesa della revisione finale): si tira indietro il Montone sul prato e lo si lancia verso il recinto avversario, al posto del riquadro di mira (che resta solo nei pannelli di riserva). Progetto `bozze/testata-fionda-progetto.md`, piano `bozze/testata-fionda-piano.md`.
  - [x] **Seconda versione** (richiesta dell'utente, 26 ottobre; compiti 1–5 fatti il 27 ottobre, piano `bozze/testata-fionda-piano-2.md`): zone 3 al centro del recinto, 2 dentro, 1 sulla staccionata o appena fuori; partenza vicino alla propria pecora che cambia; cerchi solo mentre si carica; Montone animato (si dimena, vola con la scia, testata, occhi a spirale, scuote la testa, corre via); chi starebbe sotto si scansa. Finita e provata dall'utente il 27 ottobre (minori rimasti nella "Ripresa" in cima).
- [ ] **Animazioni nelle illustrazioni delle carte** (idea dell'utente e di Claude, 21 ottobre): piccoli movimenti quando la carta è sollevata o in primo piano, come già fanno le carte meteo (nuvola che galleggia, gocce, lampo): note che vibrano, occhi che sbattono, gocce che cadono, fumo che sale. Da fare dopo, con le classi `an-*` già esistenti in `client/src/scena/scena.css` e `avvolgi` in `illustrazioni.ts`.
- [ ] **5–6 giocatori:** limiti del motore, numeri bilanciati col simulatore, 2 pecore nuove, disposizioni sul telefono.
  - *Pecore nuove decise il 21 ottobre:* **Garzina, la dottoressa** (celeste, già disegnata nel pacchetto grafico: `design/svg/pecore/garzina.svg`), bene con i Drammi e male con i Predatori; **Batuffolo, il dormiglione** (color fango; aspetto scelto il 21 ottobre: proposta A con la cuffia da notte celeste a punta e il pon pon, occhi chiusi, "zz" sopra la testa che si muovono durante la partita (sulla pecora in scena), in `bozze/batuffolo-proposte.html`; nell'avatar tondo il pon pon va tenuto dentro il cerchio), bene con il Meteo e male con i Drammi. Così le 6 pecore coprono tutte le coppie bonus/malus. Garzina giocatrice e la carta "Visita di Garzina" (decisione del 21 ottobre): quando Garzina è in partita è proprio lei, la pecora del giocatore, ad andare a curare in scena.
- [ ] **Orizzontale** (PC e telefono girato): una nuova tabella `DISPOSIZIONI.orizzontale`. Se servirà, anche una disposizione per schermi molto bassi.
- [x] **Illustrazioni delle carte:** tutte le carte hanno un disegno dal 21 ottobre (9 del pacchetto grafico, le altre in codice). Trovate fatte il 21 ottobre (16 disegni in codice, `illustrazioni.ts`); Belati fatti il 21 ottobre (4 disegni in codice: Pernacchia, Mondo alla rovescia, Faccio finta di niente, Visita di Garzina); Predatori fatti il 21 ottobre (6 disegni in codice: Volpe gentile, Aquila con il taccuino, Occhi nel cespuglio, Lupo travestito, Invito nel bosco, Faina con la lista); Drammi fatti il 21 ottobre (7 disegni in codice: Figuraccia al pascolo, Specchio impietoso, Crisi esistenziale, Gregge senza di te, Compleanno dimenticato, Insonnia, Inciampo al ruscello); Tosature fatte il 21 ottobre (3 disegni in codice: Tosatura a sorpresa, Spuntatina, Rasatura integrale).
- [x] **Fase 6, rifinitura:** bot, schermata delle regole (già c'è, da rifinire), LEGGIMI che spiega come pubblicare il sito e giocare senza installare nulla. *Tutte e tre fatte: bot "normale" il 26 ottobre, LEGGIMI scritto, schermata delle regole il 27 ottobre (sotto).*
  - *Decisioni del 21 ottobre:* **bot** con un solo livello, "normale": un po' più bravi di oggi (più attenti a non farsi eliminare e a usare bene i Belati), ma non troppo forti da rovinare la giocabilità; da misurare col simulatore contro il bot di oggi (niente livelli di difficoltà né caratteri diversi); **schermata delle regole** a sezioni che si aprono e chiudono, con le carte disegnate accanto alle spiegazioni ed esempi brevi; struttura approvata: 1) lo scopo; 2) com'è fatto un round in 5 passi illustrati; 3) le carte (Trovate con valore/effetto/Nessun effetto e Gemelle, Belati, Guai); 4) il dado con le facce e la fionda; 5) Guai ed eliminazione (4 tipi, tratti +1/−1, 3 uguali o 4 diversi con le carte, Tosatura jolly); 6) il Beee-NO! con un esempio di Beee-NO! contro Beee-NO!; 7) come finisce la partita; 8) due o tre esempi brevi; **LEGGIMI** come proposto (giocare aprendo il sito, come pubblicarlo).  *(LEGGIMI scritto: `LEGGIMI.md` nella radice, parte semplice per i giocatori + parte tecnica.)*
  - *26 ottobre, bot "normale" fatto (D47):* nuova strategia `normale` in `engine/sim/politiche.ts`, usata dai bot delle stanze (`sync/host.ts`), della partita di prova dal round 4 (`sync/prova.ts`; nei tre round guidati resta `semplice`, la storia preparata è scritta con quella) e da `mossaDelBot` (`client/src/scena/aiuti-prova.ts`, ora accetta anche `'normale'`). Misurata col simulatore contro `semplice` su tavoli misti (`npm run simula -- --miste normale,semplice`, rapporto in `docs/rapporto-bot.md`): a 3 giocatori un bot normale contro due semplici vince circa il 42% invece del 33%. Anche la pagina di sviluppo della scena ("Prossima mossa") usa `'normale'` (controllato il 27 ottobre).
  - *27 ottobre, schermata delle regole fatta* (progetto `bozze/regole-progetto.md`, piano `bozze/regole-piano.md`): otto sezioni a fisarmonica con le carte vere animate (ferme con "Riduci movimento", in pausa fuori dallo schermo, scaricate a parte), pecore con i tratti, facce del dado, recinto con le zone 3/2/1 della Testata, tre esempi con i nomi della partita in corso (nomi di esempio fuori da una partita). Si apre da Home, preparazione, sala d'attesa e dal menu di partita, prova e stanza; al ritorno si torna allo stesso punto (con la copertura "Passa a…" nel "Passa il telefono", bot fermi nella prova). Nelle stanze la partita va avanti: riga in cima e richiamo quando tocca a te. Visto a occhio a 375×812 e su schermo largo; corretti a occhio: didascalie delle pecore che andavano a capo dopo "+1", numeri dei passi del round in fondo al disegno, due carte una sotto l'altra con un buco accanto (ora affiancate sopra il testo, accanto al testo su schermo largo). Poi, su decisione del coordinatore: nella prova gli esempi usano i nomi dei bot più un nome di esempio (Bea, Leo e Ada) invece di "Tu"; in "Come finisce la partita" le parole d'apertura in grassetto; richiamo di chi ospita più corto ("Un giocatore è uscito: decidi tu."), su una riga anche a 360 px. Scelte rimaste per l'utente nella "Ripresa" in cima.

## Prima della pubblicazione (dalla revisione finale del pezzo 1, 15 ottobre)

*Rifiniture fatte il 20 ottobre (registro `.superpowers/sdd/rifiniture/`), da guardare nel giro finale nel browser: altezza della striscia con 4 giocatori e l'avviso più lungo, suono che si ferma davvero.*

- [x] **Cura con conferma** (decisione dell'utente, 20 ottobre): toccando il Guaio illuminato nell'angolo non si cura subito, compare un pulsante "Cura" di conferma (oggi con una sola cura il tocco cura all'istante).
- [x] **Striscia in alto più compatta, con una X per chiuderla** (decisione dell'utente, 20 ottobre): con 4 giocatori e due avvisi lunghi oggi copre per circa 9 px la metà alta delle targhe avversarie.
- [x] Messaggio del riquadro di errore della scena: distinguere "connessione" da altri errori; dopo un nuovo rilascio del sito offrire "Ricarica la pagina" (la partita è salvata).
- [x] Audio: fermare davvero il suono di fondo uscendo dalla partita e mentre la prova è nascosta (oggi si abbassa solo il volume).
- [x] Facoltativo: fermare l'animazione della scena sotto la schermata "Passa il dispositivo" (batteria).
- [x] Rendere più robusta la regola CSS che separa la mano dei pannelli da quella della scena (selettori `:not()` complessi, problemi su browser molto vecchi).
- [x] Durata delle prove: `meteo.test.ts` dura circa 100 s; la suite intera circa 3 minuti (oltre 5 con il PC carico, e allora una prova di `meteo.test.ts` può superare il limite di 5 s). *21 ottobre: prove del meteo e del conto divise in più file, prove lente con 30 s di tempo massimo; la suite passa da circa 258 a 200 secondi.*
- [x] Per scendere ancora: dividere in più file le due prove più lunghe del motore (`revisione-segreti-purezza.test.ts`, circa 128 s, e `fuzz.test.ts`, circa 98 s) e le prove del meteo più lente (`meteo-guai-3/4`). Solo organizzazione delle prove: il motore non cambia. *Via libera dell'utente il 21 ottobre.*
- [x] Vedere a occhio "Ultimo round!" in una partita vera. *Visto il 20 ottobre nella partita di prova.*
- [x] Decidere se il tempo massimo di 25 s deve valere per la recita intera invece che per ogni battuta (revisione finale del pezzo 2, 19 ottobre; raro). *21 ottobre: vale per la recita intera. Se una battuta arriva al tempo massimo (la scena non disegna), le battute dopo non si recitano e la scena va in pari: la partita non aspetta mai più di 25 s.*

### Piccole cose rimandate (fatte il 21 ottobre, registro `.superpowers/sdd/piccole-cose/`)

Fatte: pausa dei bot con le Regole aperte, riserva per le mosse dei bot, "passa" da solo che non si manda due volte, proiettore che riprova da solo ogni 5 s, conto alla rovescia che non blocca i tocchi, errore che sparisce alla domanda successiva, fumetto del furto con gli agnellini spostati davvero, tastiera (tasto tenuto premuto, Tab, ritorno al menu dopo la X), tasto destro e centrale ignorati sulla mano, agnellini sollevati esclusi da pozzanghera e vento, terzo consiglio della scena anche a chi aveva visto i primi due, pulizie del codice, prove più veloci e nuove prove. Dalla revisione finale: nelle stanze un aggiornamento qualsiasi (un telefono che si ricollega) non fa più slittare l'avanzamento automatico delle fasi né la mossa dei bot; i controlli "nessuno vede le carte degli altri" nelle prove delle stanze non possono più passare inosservati.

Piccoli difetti della revisione finale, corretti anche loro il 21 ottobre (il fumetto del furto è rimasto com'è: usare il numero vero vorrebbe dire un secondo fumetto corretto dopo, cioè un cambio di progetto):

- [x] L'errore del motore resta visibile per un fotogramma alla domanda successiva.
- [x] Il terzo consiglio ("Trascina una carta…") può comparire durante il Guaio iniziale, quando non si può ancora trascinare: meglio mostrarlo alla prima domanda con carte da trascinare.
- [x] Nella partita di prova, la mossa di riserva di un bot non controlla che sia proprio del bot.
- [x] Sulle pecore, sugli agnellini e sui pulsanti della scena il tasto destro o centrale conta come tocco, e tenere premuto Invio sulla pecora nel furto solleva più agnellini.
- [x] Il proiettore riprova ogni 5 s per sempre, anche dopo un aggiornamento del sito; ogni tentativo ripete l'avviso ai lettori di schermo.
- [x] Il fumetto del furto quasi sempre usa il numero dichiarato (la dichiarazione e lo spostamento arrivano in momenti diversi): nessun peggioramento. *21 ottobre, decisione dell'utente: se gli agnellini spostati sono meno di quelli annunciati, compare un secondo fumetto "Solo N agnellini!".*
- [x] Testo `T.azioni.fatto` non più usato.
- [x] Prove: nessuna prova sui buchi nella numerazione degli eventi; le partite delle prove delle scelte riusano lo stesso momento tra un gesto e l'altro; piccole pulizie di forma.

## 4. Rischi da verificare

- [ ] **iPhone e Safari:** effetto 3D di tovaglia e dado, vibrazione assente (previsto). *L'utente non ha un iPhone (15 ottobre): da provare con qualcun altro dopo la pubblicazione.*
- [ ] **Telefoni Android economici:** fluidità della scena e scatto del modo leggero. *L'utente non ne ha uno (15 ottobre): da provare con qualcun altro dopo la pubblicazione.*
- [ ] **Samsung Internet con la modalità notte** (segnalato dall'utente il 20 ottobre: i colori della partita cambiano e il gioco diventa poco visibile). Il 20 ottobre il sito dichiara "solo colori chiari" (`color-scheme: only light`), che le versioni recenti di Samsung Internet dovrebbero rispettare; da verificare sul telefono dell'utente. Se non basta: Impostazioni → Labs → "Usa il tema scuro del sito web" (consiglio ufficiale di Samsung), ed eventualmente un avviso per i giocatori.
- [x] **Rete aziendale:** Google Fonts, GitHub Pages o Firebase bloccati. Se succede, servono alternative gratuite. *Confermato dall'utente il 13 ottobre: funziona.*
