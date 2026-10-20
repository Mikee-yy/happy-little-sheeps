# Happy Little Sheeps — cose da fare

Aggiornato il 20 ottobre 2026 (scena 2,5D in tutto il gioco: pezzi 1–4 e rifiniture nel commit bf3ffb0, inviato a GitHub il 20 ottobre). Il contesto di ogni voce è in `bozze/passaggio-di-consegne.md`.

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
- [ ] Protezione in più: se una mossa di un bot non avesse azioni o fallisse, ripianificare la mossa (mai successo in 300 partite simulate).
- [ ] Mentre si leggono le Regole a metà prova i bot continuano finché non tocca a te, e un consiglio legato a un momento si può perdere.

## 2. Decisioni che spettano all'utente

- [ ] **Rivedere le proporzioni dei recinti degli avversari** (3 e 4 giocatori, quasi pieni). Il 14 ottobre si è scelta per ora la **base** (come la bozza). Nella pagina di sviluppo (`client/scena.html`, selettore "Recinti") restano da confrontare la variante A (recinti più profondi) e la B (agnellini più piccoli lontano).
- [ ] **Rivedere i simboli delle carte senza disegno** (Trovate: agnellino; Belati: fumetto "Beee!"; Guai: icona del tipo). Approvati per ora il 14 ottobre; spariranno man mano con le illustrazioni del punto 4.
- [x] **Spostare il suggerimento "Tocca una carta per sollevarla" in basso, vicino alle carte** (segnalato il 15 ottobre: in alto copre il nome di un giocatore). *Fatto il 15 ottobre: ora sta tra la staccionata del proprio recinto e le carte.*
- [ ] Approvare le **eccezioni alla guida di stile** (`bozze/guida-stile-eccezioni.md`). Una volta approvate, aggiungerle a `design/guida-stile.md` in una sezione "Scena di gioco".
- [x] Decidere se la **tovaglia** a quadri rossi e bianchi è definitiva. *Confermata dall'utente il 14 ottobre: va bene.*
- [ ] Approvare o far ridisegnare le **6 illustrazioni meteo** disegnate in bozza: grandine, pioggia, vento, nebbia, fulmine, gelata.
- [ ] Rivedere le **decisioni D1–D45** in `docs/motore.md`.
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
- [ ] **Testata a fionda nella scena** (idea dell'utente, 19 ottobre): tirare indietro il Montone sul prato e lanciarlo verso il recinto avversario, al posto del riquadro di mira. Da valutare dopo la pubblicazione.
- [ ] **5–6 giocatori:** limiti del motore, numeri bilanciati col simulatore, 2 pecore nuove, disposizioni sul telefono.
- [ ] **Orizzontale** (PC e telefono girato): una nuova tabella `DISPOSIZIONI.orizzontale`. Se servirà, anche una disposizione per schermi molto bassi.
- [ ] **Illustrazioni delle carte:** circa 36 illustrazioni originali che mancano. Il pacchetto grafico ne copre 9 su 51 tipi.
- [ ] **Fase 6, rifinitura:** bot, schermata delle regole (già c'è, da rifinire), LEGGIMI che spiega come pubblicare il sito e giocare senza installare nulla.

## Prima della pubblicazione (dalla revisione finale del pezzo 1, 15 ottobre)

*Rifiniture fatte il 20 ottobre (registro `.superpowers/sdd/rifiniture/`), da guardare nel giro finale nel browser: altezza della striscia con 4 giocatori e l'avviso più lungo, suono che si ferma davvero.*

- [x] **Cura con conferma** (decisione dell'utente, 20 ottobre): toccando il Guaio illuminato nell'angolo non si cura subito, compare un pulsante "Cura" di conferma (oggi con una sola cura il tocco cura all'istante).
- [x] **Striscia in alto più compatta, con una X per chiuderla** (decisione dell'utente, 20 ottobre): con 4 giocatori e due avvisi lunghi oggi copre per circa 9 px la metà alta delle targhe avversarie.
- [x] Messaggio del riquadro di errore della scena: distinguere "connessione" da altri errori; dopo un nuovo rilascio del sito offrire "Ricarica la pagina" (la partita è salvata).
- [x] Audio: fermare davvero il suono di fondo uscendo dalla partita e mentre la prova è nascosta (oggi si abbassa solo il volume).
- [x] Facoltativo: fermare l'animazione della scena sotto la schermata "Passa il dispositivo" (batteria).
- [x] Rendere più robusta la regola CSS che separa la mano dei pannelli da quella della scena (selettori `:not()` complessi, problemi su browser molto vecchi).
- [ ] Durata delle prove: `meteo.test.ts` dura circa 100 s; la suite intera circa 3 minuti (oltre 5 con il PC carico, e allora una prova di `meteo.test.ts` può superare il limite di 5 s).
- [x] Vedere a occhio "Ultimo round!" in una partita vera. *Visto il 20 ottobre nella partita di prova.*
- [ ] Decidere se il tempo massimo di 25 s deve valere per la recita intera invece che per ogni battuta (revisione finale del pezzo 2, 19 ottobre; raro).

## 4. Rischi da verificare

- [ ] **iPhone e Safari:** effetto 3D di tovaglia e dado, vibrazione assente (previsto). *L'utente non ha un iPhone (15 ottobre): da provare con qualcun altro dopo la pubblicazione.*
- [ ] **Telefoni Android economici:** fluidità della scena e scatto del modo leggero. *L'utente non ne ha uno (15 ottobre): da provare con qualcun altro dopo la pubblicazione.*
- [ ] **Samsung Internet con la modalità notte** (segnalato dall'utente il 20 ottobre: i colori della partita cambiano e il gioco diventa poco visibile). Il 20 ottobre il sito dichiara "solo colori chiari" (`color-scheme: only light`), che le versioni recenti di Samsung Internet dovrebbero rispettare; da verificare sul telefono dell'utente. Se non basta: Impostazioni → Labs → "Usa il tema scuro del sito web" (consiglio ufficiale di Samsung), ed eventualmente un avviso per i giocatori.
- [x] **Rete aziendale:** Google Fonts, GitHub Pages o Firebase bloccati. Se succede, servono alternative gratuite. *Confermato dall'utente il 13 ottobre: funziona.*
