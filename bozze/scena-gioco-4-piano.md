# Scena nel gioco, pezzo 4: le stanze — piano di lavoro

> **Per chi esegue:** SOTTO-SKILL OBBLIGATORIA: superpowers:subagent-driven-development (o superpowers:executing-plans), compito per compito. I passi usano le caselle (`- [ ]`).

**Obiettivo:** nelle stanze (un telefono per giocatore) si gioca dentro la scena 2,5D come nella partita su un dispositivo; chi ospita calcola scadenze, fasi automatiche e mosse dei bot tenendo conto della durata normale delle animazioni; la vista proiettore mostra la scena.

**Architettura:**
- una funzione pura nel client (`durataRecita`) calcola dagli eventi di una mossa la durata normale della sua recita, con le durate in un file di dati; `SessioneHost` la riceve dall'esterno (iniezione), così `sync/` non dipende dal client;
- il collegamento scena + domande del pezzo 3 esce da `Partita.tsx` in un componente comune, usato da `Partita` e dalla partita delle stanze;
- un adattatore traduce lo schermo della stanza (`scenaRemota`) nel `Momento` delle domande.

**Tecnologie:** TypeScript, React 19, Vitest con jsdom.

**Progetto:** `bozze/scena-gioco-4-progetto.md` (approvato dall'utente il 20 ottobre). Pezzi precedenti: `bozze/scena-gioco-2-progetto.md` (regia), `bozze/scena-gioco-3-progetto.md` (scelte).

## Vincoli globali

- **Niente commit né push** senza richiesta dell'utente.
- In Bash: `export PATH="$PWD/.tools/bin:$PATH"`. Niente installazioni né server di sviluppo da Bash.
- **Prove:** durante i compiti SOLO i file di prova mirati (TDD: prova che fallisce, poi codice). Niente `npm test` intero, niente cartella intera: le prove lunghe si fanno una volta sola alla fine (compito 7). `npm run typecheck` alla fine di ogni compito.
- Nomi, tipi e commenti in italiano; testi visibili solo in `client/src/testi.ts` (si riusano quelli delle stanze di oggi quando il senso è lo stesso).
- Il motore (`engine/`) non si tocca. **`database.rules.json` non si tocca** e non si aggiungono percorsi al database: nessun nuovo messaggio tra telefoni.
- `sync/` non importa niente da `client/`: ciò che serve dal client arriva per iniezione.
- Regole della scena e anti-sbirciata dei pezzi 1–3; nelle stanze la mano del telefono è sempre scoperta e mai quella degli altri.
- Valori: finestra di reazione dalle impostazioni della stanza (oggi 6 s, da 2 a 30); `TEMPI.prosegui` e `TEMPI.bot` di `sync/host.ts` restano come pausa minima.

## Punti da controllare in revisione

1. **Mano altrui:** in nessun momento (domanda, attesa, riserva, proiettore) una carta della mano di un altro giocatore compare su un telefono. → prova nel compito 5.
2. **Scadenza uguale per tutti:** la scadenza dipende solo da eventi e impostazioni, non dalla scena di chi ospita né da salto/animazioni veloci. → prova nel compito 2.
3. **Pause e scollegamenti:** con un giocatore in pausa o chi ospita scollegato la finestra si comporta come oggi (riparte a tempo pieno). → prova nel compito 2.
4. **Rifiuto di chi ospita:** dopo un rifiuto la scelta si sblocca e riparte vuota; nessun blocco permanente. → prova nel compito 5.
5. **Pezzo comune:** dopo l'estrazione, tutte le prove di `Partita`/`App` del pezzo 3 restano verdi senza cambiare quello che controllano. → compito 3.

---

## Mappa dei file

```
client/src/scena/regia/durate.json       durata normale (ms) di ogni tipo di battuta
client/src/scena/regia/durate.ts         durataRecita(eventi, vista): number (pura, usa copione)
sync/host.ts                             + opzione durataRecita; scadenza, prosegui e bot che la usano
client/src/partita/GiocoInScena.tsx      componente comune (scena, momento, scelta, gesti, scritta, Testata, riserva)
client/src/partita/Partita.tsx           usa GiocoInScena
client/src/remoto/regiaRemota.ts         + momentoRemoto (adattatore) e schermo d'attesa
client/src/remoto/Stanza.tsx             PartitaRemota e VistaTavolo con la scena; conto alla rovescia nella striscia
client/src/remoto/connessione.ts / App   pre-caricamento della scena per le stanze
client/src/testi.ts                      testi nuovi solo se servono
```

---

### Compito 1: Le durate normali

**File:**
- Creare: `client/src/scena/regia/durate.json`, `client/src/scena/regia/durate.ts`
- Prova: `client/src/scena/regia/durate.test.ts`

**Interfacce:**
- Consuma: `copione(eventi, vista)` e il tipo `Battuta` (`client/src/scena/regia/copione.ts`).
- Produce:
  ```ts
  /** Durata normale (velocità 1, senza salto) della recita degli eventi, in ms di tempo della scena. 0 se nessuna battuta. */
  export function durataRecita(eventi: Evento[], vista: Vista): number;
  ```
  Somma, battuta per battuta, `durate.json[tipo]`; per una battuta con attesa `massimo` usa il minimo tra la durata del tipo e quel massimo (il Guaio con meteo vale al più 5000 + il volo della carta prima del meteo, come `guaio(…, { liberaDopoMs })`); una battuta con attesa `niente` vale 0.
- **`durate.json`:** una voce per ogni `Battuta['tipo']` (`guaioRivelato`, `annuncio`, `giraCarte`, `fumetti`, `volaCarta`, `beeeNo`, `dado`, `agnellini`, `testata`, `guaio`, `eliminata`, `festa`), in ms, misurate con il teatro vero a ciclo manuale (`ambiente: false`) facendo girare ogni ordine fino alla fine come in `ordini.test.ts` (`finoAllaFine`); arrotondate per eccesso ai 100 ms. Per `agnellini` la durata di una corsa tipica (3 agnellini dal gregge) e per `testata` quella con 2 agnellini.

- [ ] **Passo 1: prove che falliscono** (`durate.test.ts`):
  - ogni tipo di `Battuta` ha la sua voce in `durate.json` (elenco dei tipi preso da una costante esportata dal copione o scritto nella prova con un controllo di esaustività del tipo);
  - per ogni tipo, la durata del file è ≥ della durata misurata dell'ordine corrispondente (teatro vero, ciclo manuale), e non più del doppio;
  - `durataRecita` su eventi costruiti a mano: Pascolo (dado + fumetti + agnellini) = somma delle tre voci; Guaio meteo ≤ voce `guaio` e ≤ 5000 + volo; consolazione dopo il meteo (attesa `niente`) vale 0; nessun evento → 0;
  - su 10 partite vere giocate a caso, per ogni azione `durataRecita(eventi nuovi)` è ≥ 0 e > 0 quando il copione dà almeno una battuta che fa aspettare.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: misurare, scrivere `durate.json` e `durate.ts`.**
- [ ] **Passo 4: lanciare `durate.test.ts`, `copione.test.ts`, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 2: Chi ospita aspetta le animazioni

**File:**
- Modificare: `sync/host.ts`
- Prova: `sync/remoto.test.ts`

**Interfacce:**
- Consuma: la firma di `durataRecita` (compito 1), ma **senza importarla**: arriva come opzione.
- Produce: `SessioneHost.crea(…, opzioni?)` e `SessioneHost.riprendi(…, opzioni?)` accettano `{ durataRecita?: (eventi: Evento[], vista: Vista) => number }` (senza: 0, cioè il comportamento di oggi). Nella stessa forma di parametro opzionale degli altri metodi statici: guarda le firme attuali e aggiungi in coda.
- **Regole in `pianifica()`:**
  - si tiene `ultimoSeqPianificato`; gli eventi nuovi sono quelli della vista del tavolo con `seq` maggiore; `recita = durataRecita(eventiNuovi, vistaTavolo)`, ricordata insieme al momento in cui è stata calcolata (`inizioRecita = ora`);
  - **finestra nuova:** `scadenza = ora + recita + finestraSecondi * 1000` (solo quando la chiave cambia, come oggi);
  - **fasi automatiche:** `prosegueAlle = fineRecita + TEMPI.prosegui[fase]`, dove `fineRecita = inizioRecita + recita` dell'ultima mossa (se è già passata, conta solo la pausa);
  - **bot:** muove a `max(ora + TEMPI.bot, fineRecita)`;
  - pause, host scollegato, chiave che non cambia: come oggi (la finestra che riparte a tempo pieno riparte senza la recita, che è già finita).
- Il formato pubblicato (`Pubblico.scadenza`, `prosegueAlle`) non cambia.

- [ ] **Passo 1: prove che falliscono** (`sync/remoto.test.ts`, orologio finto, una `durataRecita` finta che vale per esempio 3000 ms quando ci sono eventi):
  - una dichiarazione apre la finestra con `scadenza = ora + 3000 + finestraSecondi*1000`; la `scadenza` automatica arriva a quel tempo e non prima;
  - una fase automatica avanza a `ora + 3000 + TEMPI.prosegui[fase]`;
  - un bot muove non prima di `ora + 3000` (e non prima di `TEMPI.bot`);
  - senza opzione: tutto come oggi (le prove esistenti restano verdi);
  - giocatore in pausa e host scollegato: come oggi (punto 3);
  - la scadenza non dipende da niente che venga dagli ospiti (punto 2): stessa sequenza di azioni, stessa scadenza.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere le modifiche.**
- [ ] **Passo 4: lanciare `sync/remoto.test.ts`, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 3: Il pezzo comune

**File:**
- Creare: `client/src/partita/GiocoInScena.tsx`
- Modificare: `client/src/partita/Partita.tsx`
- Prove: `client/src/App.test.tsx`, `client/src/partita/Partita.test.tsx` (invariati nel contenuto; solo gli import se cambiano)

**Interfacce:**
- Produce `GiocoInScena` (componente) con props esplicite, almeno:
  ```ts
  {
    tavolo: Vista;               // vista del tavolo per la scena (mai privata)
    foto: Fotografia;            // con la mano già decisa da chi lo usa (anti-sbirciata)
    momento: Momento | null;     // null: nessuna domanda (attesa, recita, fine)
    conAzioni: boolean;          // la domanda si può mostrare (scena libera, niente strati sopra)
    invia: (a: Azione) => boolean;
    onRisponde?: (chi: IdGiocatore) => void;   // "Chi risponde?" (solo Partita)
    onIndietro?: () => void;
    pensiero?: Pensiero | null;
    sopraStriscia?: React.ReactNode;           // per esempio il conto alla rovescia delle stanze
    rifTeatro?, onOccupato?, nascosta?, sospesa?;
    riserva: React.ReactNode;    // i pannelli da mostrare se la scena non è pronta
  }
  ```
  Dentro: `scenaPronta`, scelta a metà con reset sulla chiave, blocco dopo la mossa (chiave + seq) **più** un modo per sbloccare da fuori (prop `sblocca?: number` che cambia a ogni rifiuto, o equivalente), `Scritta` con la X, riquadro della Testata, `ScenaCaricata` con tutte le props dei pezzi 2–3, pannelli di riserva quando la scena non è pronta.
- `Partita` resta responsabile di: schermo (`scena`/`scenaProva`), "Passa il dispositivo", `detentore`/`giu`, `scelto`, consigli della prova, classifica dopo la festa, menu.
- **Nessun cambiamento di comportamento** (punto 5).

- [ ] **Passo 1: prima di toccare il codice** lanciare `npx vitest run client/src/App.test.tsx client/src/partita client/src/scena/Scena.test.tsx` e annotare il numero di prove verdi.
- [ ] **Passo 2: estrarre `GiocoInScena`** e far usare a `Partita`. Una prova nuova in `client/src/partita/GiocoInScena.test.tsx` (teatro finto come in `App.test.tsx`) per lo sblocco da fuori: dopo una mossa i gesti sono ignorati; cambiando `sblocca` tornano validi e la scelta riparte vuota (punto 4). Vederla fallire prima di aggiungere lo sblocco.
- [ ] **Passo 3: rilanciare gli stessi file:** stesso numero di prove verdi più le nuove.
- [ ] **Passo 4: `npm run typecheck`.**
- [ ] **Passo 5: registro.**

### Compito 4: Lo schermo della stanza diventa un momento

**File:**
- Modificare: `client/src/remoto/regiaRemota.ts`
- Prova: `client/src/remoto/regiaRemota.test.ts`

**Interfacce:**
- Consuma: `ScenaRemota` (oggi), `Momento` (`client/src/scena/scelte/tipi.ts`).
- Produce:
  ```ts
  /** Il momento delle domande per il telefono di `io`; null quando si aspetta qualcun altro o la partita è finita. */
  export function momentoRemoto(sc: ScenaRemota, io: IdGiocatore, vistaIo: Vista, tavolo: Vista, azioni: Azione[]): Momento | null;
  /** Testo della striscia quando si aspetta (riusa i testi di PannelloAttesa di oggi). */
  export function scrittaAttesa(sc: ScenaRemota, tavolo: Vista): string;
  ```
  Traduzione: `pannello` privato → `{ tipo: 'privata', giocatore: io, pannello }`; `lancio`/`dichiarazione`/`testata` → `{ tipo: 'pubblica', giocatore: io, pannello }`; `automatica` → `null` nelle stanze (avanza chi ospita; la striscia mostra il testo della fase, compito 5); `attesa`/`fine` → `null`. Sempre `condiviso: false`, `manoScoperta: true`, `sistema: []`, `vista` = `vistaIo` per le private, `tavolo` per le pubbliche.

- [ ] **Passo 1: prove che falliscono:** per ogni schermo della stanza (scelta, effetto, richiesta, reazione, punteggio, belato finale, salvataggio, consolazione, lancio, dichiarazione, testata, attesa, automatica, fine) il momento atteso; `domandaDi(momento, sceltaVuota(...))` non nullo per tutti gli schermi con azioni e senza "Annulla"/"Nessuno"; `scrittaAttesa` con i testi di oggi.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere `momentoRemoto` e `scrittaAttesa`.**
- [ ] **Passo 4: lanciare `regiaRemota.test.ts`, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 5: Le stanze nella scena

**File:**
- Modificare: `client/src/remoto/Stanza.tsx`, `client/src/remoto/connessione.ts` o `client/src/App.tsx` (pre-caricamento), `client/src/stile.css`, `client/src/testi.ts` (se serve)
- Prova: `client/src/remoto/Stanza.test.tsx`

**Interfacce:**
- Consuma: `GiocoInScena` (compito 3), `momentoRemoto`/`scrittaAttesa` (compito 4), `durataRecita` (compito 1), l'opzione di `SessioneHost` (compito 2).
- **`PartitaRemota`:**
  - usa `GiocoInScena` con `foto = fotografia(tavolo, io, manoDiIo)` (mano sempre scoperta, sempre e solo quella di `io`), `momento = momentoRemoto(...)`, la riserva = l'area d'azione di oggi (pannelli, `PannelloAttesa`);
  - **striscia:** con una domanda la sua scritta; quando si aspetta `scrittaAttesa`; nelle fasi automatiche il titolo della fase;
  - **conto alla rovescia** nella striscia (`sopraStriscia`): pieno e fermo fino a `scadenza − finestraSecondi*1000`, poi scorre fino a `scadenza` (ora del server `sessione.ora()`); stesso aspetto della barra di oggi (`ContoAllaRovescia`) con lo stato "fermo";
  - **rifiuto** di chi ospita: incrementa `sblocca` (punto 4); il messaggio di oggi resta;
  - **"Passa sempre se non ho niente"**, `Pausa`, schermo acceso, `FinePartita` con rivincita dopo la festa: come oggi;
  - **togliere `Spettacolo`.**
- **Chi ospita:** `ModuloStanza` passa `{ durataRecita }` a `SessioneHost.crea` e `riprendi` (anche nel rientro automatico di `App.tsx`).
- **Pre-caricamento** della scena (`precaricaScena`) creando, entrando o rientrando in una stanza.
- **Teatro finto** come in `App.test.tsx` (`vi.mock('../scena/teatro')`, `chiedi`/`suGesto` registrati) per le prove delle stanze.

- [ ] **Passo 1: prove che falliscono** (`Stanza.test.tsx`):
  - partita intera a 3 telefoni (archivio in memoria, come la prova di oggi) giocata **solo con i gesti** sulle domande del teatro finto; a ogni `chiedi` su un telefono, nessuna carta di un altro giocatore nella fotografia e nessun `.cassetto` (punto 1);
  - conto alla rovescia: con una `durataRecita` finta di 3000 ms la barra è piena e ferma nei primi 3 s, poi scende; alla scadenza la finestra si chiude;
  - rifiuto (mossa non più valida, come la prova di oggi del "Lascia passare" in ritardo): scelta sbloccata e messaggio;
  - riserva: con `caricaScena` che fallisce, la partita delle stanze si gioca con i pannelli (le prove di oggi coi pannelli diventano queste);
  - nessuno `Spettacolo`.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere le modifiche.**
- [ ] **Passo 4: lanciare `Stanza.test.tsx`, `regiaRemota.test.ts`, `sync/remoto.test.ts`, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 6: La vista proiettore

**File:**
- Modificare: `client/src/remoto/Stanza.tsx` (`VistaTavolo`)
- Prova: `client/src/remoto/Stanza.test.tsx`

- `VistaTavolo` mostra `ScenaCaricata` (senza domanda, senza pensiero, senza mano: `fotografia(tavolo, primoGiocatore, null)`), che recita gli eventi del tavolo; sopra la cronaca come oggi; riserva: il `Tavolo` di oggi.
- [ ] **Passo 1: prove che falliscono:** la vista proiettore monta la scena (teatro finto) con `foto.mano === null`, recita gli eventi nuovi, non chiama mai `chiedi`; con `caricaScena` che fallisce mostra il tavolo di oggi.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere la modifica.**
- [ ] **Passo 4: lanciare `Stanza.test.tsx`, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 7: Il giro finale prima della pubblicazione (controllore)

- [ ] **Passo 1: prove lunghe, una volta sola:** `npm test` intero, `npm run typecheck`, `npm run build`.
- [ ] **Passo 2: browser** (390×844, finestra visibile):
  - `client/prova.html`: tre telefoni affiancati, partita intera giocando sulla scena di ciascuno; conto alla rovescia fermo e poi in discesa; un giocatore che esce e il bot che lo sostituisce; vista proiettore;
  - partita su un telefono e prova fino alla fine (dopo le rifiniture: "Cura" con conferma, striscia con la X e altezza con 4 giocatori e l'avviso più lungo, suono che si ferma uscendo);
  - i 72 casi del meteo della pagina di sviluppo.
- [ ] **Passo 3: documenti** (`bozze/da-fare.md`, `bozze/passaggio-di-consegne.md`, `CLAUDE.md`).
- [ ] **Passo 4: revisione finale** (revisore separato, impegno alto), un giro di correzioni, stop di fase. Poi la pubblicazione, solo su richiesta dell'utente.

---

## Copertura del progetto

| Progetto | Compito |
|---|---|
| § 1 cosa vede chi gioca (telefono suo, scelte, risposte senza Annulla, attesa) | 4, 5 |
| § 1 conto alla rovescia pieno e poi in discesa | 2, 5 |
| § 1 Spettacolo tolto, riserva, cose che restano | 5 |
| § 1 vista proiettore | 6 |
| § 2.1 pezzo comune | 3 |
| § 2.2 adattatore | 4 |
| § 2.3 durate e chi ospita, nessun messaggio nuovo | 1, 2 |
| § 2.4 conto sui telefoni | 5 |
| § 2.5 pre-caricamento, rifiuto, ritorno | 5 (il ritorno è già del pezzo 2) |
| § 3 casi particolari | 2, 5 |
| § 4 prove (alla fine il giro lungo) | tutti, 7 |
