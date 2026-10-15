# Partita di prova: piano di lavoro

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un compito alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** dalla schermata principale una partita di prova contro due bot, con i primi tre round preparati e una guida che spiega ogni momento la prima volta che capita.

**Architettura:**
- **Motore:** una "preparazione" facoltativa per `nuovaPartita`, con i dati in `engine/data/prova.json`: mani, cima del mazzo, primi Guai e primi tiri del dado.
- **Sessione:** `SessioneProva` in `sync/prova.ts` fa giocare i bot da soli.
- **Gioco:** `client/src/prova/` contiene la regia per un solo umano, la guida (funzione pura) e i riquadri. `Partita` riceve due proprietà facoltative per usarli.

**Tecnologie:** TypeScript, React, Vitest e Testing Library, con il Node di VS Code tramite `.tools/bin`.

**Progetto:** `bozze/partita-prova-progetto.md`. Leggerlo prima di iniziare: i 16 testi dei suggerimenti sono lì, già approvati.

## Vincoli generali

- **Nessun commit né push.** Si pubblica solo quando si gioca con la nuova grafica, per decisione dell'utente. Al posto del passo "Commit" c'è "Nessun commit".
- **Node:** in Bash, `export PATH="$PWD/.tools/bin:$PATH"` dalla radice del progetto. Niente dipendenze nuove.
- **Motore:** resta una funzione pura. Niente `Math.random`, `Date` o DOM: la casualità passa da `stato.rng`. Numeri e carte stanno nei file dati.
- **Lingua:** nomi, commenti e testi in italiano. Tutti i testi visibili vanno in `client/src/testi.ts`, con i testi dei suggerimenti esattamente come nella tabella del progetto, sezione 2.
- **Giocatori della prova:**
  - `g1` "Tu", Nerina (`nerina`);
  - `g2` "Bea", Ricciolo (`ricciolo`);
  - `g3` "Leo", Sospirella (`sospirella`).
- **Tiri preparati:** `pascolo_piccolo`, `furto_piccolo`, `testata`.
- **Primi Guai:** `lupo-vegetariano`, `grandine-a-sorpresa`, poi un Guaio dei Drammi (`crisi-esistenziale`).
- **Pausa dei bot:** 1000 ms.
- **Salvataggio:** la partita di prova non scrive mai nell'archivio `hls-partita-locale`.

## Punti da sorvegliare

1. **"Esci" dal menu durante la prova:** si torna alla Home, la partita vera salvata resta riprendibile e i bot non muovono più. Test nel compito 2 (fermare i bot) e nel compito 5 (Home e salvataggio).
2. **Ricarica della pagina durante la prova:** si riapre la Home senza errori e "Riprendi la partita" riguarda solo la partita vera. Test nel compito 5.
3. **Partita finita prima del terzo round** (Ovile pieno o eliminazione): compare la schermata di fine partita normale, senza riquadro "Ora sai come si gioca!" bloccato. Test nel compito 3.
4. **Tocchi mentre pensa un bot:** nessun pannello d'azione per l'umano, solo "… sta pensando". Test nel compito 3 (regia) e nel compito 5.
5. **Beee-NO! giocato prima del round 2:** il Furto arriva senza Beee-NO! in mano, il suggerimento 11 non compare e la partita va avanti. Test nel compito 3.

---

### Compito 1: motore, la partita preparata

**File:**
- Crea: `engine/data/prova.json`
- Crea: `engine/test/prova.test.ts`
- Modifica:
  - `engine/src/tipi.ts`: tipo `Preparazione`, campo facoltativo `dadoPreparato` nello `Stato`;
  - `engine/src/partita.ts`: `nuovaPartita`;
  - `engine/src/dado.ts`: `lanciaDado`;
  - `engine/src/dati.ts`: carica ed esporta `PROVA`;
  - `engine/src/index.ts`: esporta `PROVA` e il tipo `Preparazione`.

**Interfacce prodotte:**
- `interface Preparazione { mani: Record<IdGiocatore, IdTipoCarta[]>; cimaMazzo: IdTipoCarta[]; cimaGuai: IdTipoCarta[]; dado: string[]; primoGiocatore: IdGiocatore }`
- `nuovaPartita(o: { giocatori; seme: number; preparazione?: Preparazione }): Stato`
- `Stato.dadoPreparato?: string[]`, cioè gli id delle facce ancora da usare. Non compare in `vistaPer`.
- `PROVA: { giocatori: Array<{ id: IdGiocatore; nome: string; pecora: IdPecora }>; preparazione: Preparazione }`

**Come funziona la preparazione:**
- Si mescola come sempre.
- Per ogni tipo richiesto si prende la prima istanza libera di quel tipo dal mazzo (o dai Guai):
  - le mani indicate vanno ai giocatori, completate dalla cima del mazzo se sono meno di `manoIniziale`;
  - `cimaMazzo` va in testa al mazzo, nell'ordine dato;
  - `cimaGuai` va in testa al mazzo Guai;
  - `primoGiocatore` sostituisce l'estrazione a caso.
- Tipo sconosciuto o copie insufficienti: `errore('preparazione_non_valida', …)`.
- `lanciaDado` usa `s.dadoPreparato.shift()` (con `faccia(s, id)`) finché ce n'è, poi `estraiFaccia`.

**Contenuto di partenza di `prova.json`** (da aggiustare al passo 4 finché il test dei tre round passa):
- **Mani:**
  - g1: `carriola`, `calzino-gemello`, `pantofola-gemella`, `belato-di-gruppo`, `beee-no`;
  - g2: `capriola`, `cannocchiale`, `sasso-comodo`, `agnellino-smarrito`, `orecchino-gemello`;
  - g3: `balla-di-fieno`, `coperta-di-lana`, `trifoglio-qualunque`, `scorta-nel-vello`, `megafono-di-latta`.
- **Cima del mazzo:** contiene `tappi-per-le-orecchie` (9), in modo che arrivi a g1 con la ripescata del round 1.
- **Primo giocatore:** `g1`.

- [ ] **Passo 1: scrivere i test che falliscono** in `engine/test/prova.test.ts`:
  - `'con la preparazione mani, Guai e primi tiri sono quelli del file'`: `tipoDi` delle mani di g1, g2 e g3 uguale a `PROVA.preparazione.mani`; `tipoDi(mazzoGuai[0])` = `lupo-vegetariano` al primo Guaio scoperto; i primi tre `lanciaDado` producono `dado_lanciato` con `faccia` `pascolo_piccolo`, `furto_piccolo`, `testata`;
  - `'finiti i tiri preparati il dado torna casuale'`: dopo tre tiri `dadoPreparato` è vuoto e il quarto tiro usa l'rng, cioè cambia con il seme;
  - `'la vista non mostra i tiri preparati'`: `vistaPer(s, 'g1')` non ha la chiave `dadoPreparato`;
  - `'tipo sconosciuto o copie insufficienti: preparazione_non_valida'`;
  - `'senza preparazione nuovaPartita è identica a prima'`: lo stesso seme dà lo stesso `Stato` (mani, mazzo, primo giocatore) di una partita creata senza il campo;
  - `'i tre round preparati vanno come nel progetto'`: g1 gioca la carta più alta che non sia una Gemella nei round 1 e 3, le due Gemelle nel round 2, e passa negli altri momenti; g2 e g3 giocano con `semplice` e `r = rng(1)` (un generatore fisso); l'esito della Testata è 2. Si controlla che:
    - nel round 1 tira g1 ed esce Pascolo;
    - nel round 2 tira un bot, esce Furto, e g1 è in `finestra.inAttesa` con un `giocaBelato` di `beee-no` tra le azioni;
    - nel round 3 tira g1 ed esce Testata;
    - in uno dei tre round un bot prende un Guaio.

- [ ] **Passo 2: lanciarli e vederli fallire.**
  - Comando: `npx vitest run engine/test/prova.test.ts`
  - Atteso: FAIL ("PROVA" non esportato).

- [ ] **Passo 3: realizzare** tipo, dati, `nuovaPartita` e `lanciaDado` come indicato sopra.

- [ ] **Passo 4: far passare il test dei tre round.** Se `semplice` porta i round altrove, si cambiano solo le carte in `prova.json` (mani dei bot e cima del mazzo), mai il codice. Le carte finali si annotano in fondo a questo piano.
  - Comando: `npx vitest run engine/test/prova.test.ts`. Atteso: tutto verde.
  - Poi `npm test`. Atteso: tutti i test esistenti verdi.

- [ ] **Passo 5: nessun commit.**

---

### Compito 2: sessione di prova con i bot

**File:**
- Crea: `sync/prova.ts`, `sync/prova.test.ts`

**Interfacce:**
- Consuma: `PROVA` e `nuovaPartita({ …, preparazione })` (compito 1); `semplice` da `engine/sim/politiche`; `esitoTestataCasuale` da `engine/sim/simulatore`.
- Produce, in `class SessioneProva implements Sessione`:
  - `static nuova(o?: { seme?: number; casuale?: () => number; pausaMs?: number; temporizzatore?: (fn: () => void, ms: number) => unknown; annulla?: (id: unknown) => void }): SessioneProva`
  - `readonly umano: IdGiocatore` (sempre `'g1'`);
  - `vista`, `azioni`, `invia`, `ascolta` come `SessioneLocale`;
  - `chiudi(): void`, che ferma i bot.
  - `modo = 'prova' as const`. Se il tipo `Sessione` limita `modo`, si aggiunge `'prova'` all'unione.

**Comportamento:**
- Dopo la creazione e dopo ogni azione si pianifica una mossa di bot se `inAttesaDi(stato).giocatori` contiene un id diverso da `umano`. Come in `SessioneHost.mossaBot` (`sync/host.ts:574–589`):
  - Testata con `esitoTestataCasuale(massimo, casuale)`;
  - altrimenti `semplice.scegli(stato, id, azioni, casuale)`, con ripiego su un'azione a caso se non è valida.
- Le fasi di sistema (`prosegui`) restano all'umano, che tocca "Continua".
- Non si salva mai.

- [ ] **Passo 1: test che falliscono** (`sync/prova.test.ts`, con `vi.useFakeTimers()`):
  - `'i bot scelgono da soli la Trovata, l'umano no'`: dopo `prosegui` e 1000 ms, g2 e g3 hanno l'evento `ha_scelto` e g1 no;
  - `'mentre tocca all'umano i bot aspettano'`: con solo g1 in attesa, nessun nuovo evento dopo 5000 ms;
  - `'chiudi ferma i bot'`: dopo `chiudi()` e 5000 ms nessuna mossa dei bot;
  - `'la prova non scrive nel salvataggio'`: `localStorage.getItem('hls-partita-locale')` resta com'era (impostato prima a `'x'`) dopo una manciata di azioni;
  - `'stesso seme e stesso casuale: stessa partita'`.

- [ ] **Passo 2: vederli fallire.**
  - Comando: `npx vitest run sync/prova.test.ts`
  - Atteso: FAIL (modulo mancante).

- [ ] **Passo 3: realizzare `SessioneProva`.** Il generatore dei bot predefinito è un `mulberry32` con il seme della partita: niente `Math.random` nei test.

- [ ] **Passo 4: verificare.**
  - Comando: `npx vitest run sync/prova.test.ts`. Atteso: verde.
  - Poi `npm test`. Atteso: tutto verde.

- [ ] **Passo 5: nessun commit.**

---

### Compito 3: regia per un umano e guida

**File:**
- Crea: `client/src/prova/regiaProva.ts`, `client/src/prova/guida.ts`, `client/src/prova/guida.test.ts`

**Interfacce prodotte:**
- `scenaProva(v: Vista, umano: IdGiocatore): Scena | { tipo: 'attesaBot'; giocatore: IdGiocatore }`. Parte da `scena(v, null)` di `client/src/partita/regia.ts`:
  - `privata` o `pubblica` dell'umano → la stessa scena;
  - `privata` o `pubblica` di un bot → `attesaBot`;
  - `domanda` con l'umano tra i candidati → `{ tipo: 'privata', giocatore: umano, pannello: contesto === 'reazione' ? 'reazione' : 'punteggio' }`;
  - `domanda` senza l'umano → `attesaBot` con il primo candidato;
  - `automatica` e `fine` invariate.
- `type IdConsiglio = 'inizio' | 'guaio' | 'tratto' | 'scelta' | 'gemelle' | 'rivelazione' | 'belatoPunteggio' | 'tuoDado' | 'pascolo' | 'furto' | 'beeeNo' | 'testata' | 'guaioTuo' | 'guaioBot' | 'fineRound'` (nell'ordine dei testi 1–15).
- `prossimoConsiglio(v: Vista, umano: IdGiocatore, azioni: Azione[], visti: ReadonlySet<IdConsiglio>): IdConsiglio | null`: il primo, in quell'ordine, il cui momento è vero e non è ancora tra i `visti`.
- `provaGuidataFinita(v: Vista): boolean`: vero quando c'è un evento `round_iniziato` con `round >= 4` e la partita non è finita (`!v.esito`).

**Quando un momento è vero:**

| Consiglio | Momento |
|---|---|
| `inizio` | sempre |
| `guaio` | evento `guaio_rivelato` con `carta` |
| `tratto` | il Guaio del round è del tipo bonus o malus della pecora dell'umano (`CATALOGO.pecore`) |
| `scelta` | fase `scelta` e l'umano è in attesa |
| `gemelle` | fase `scelta`, l'umano è in attesa e ha almeno due Gemelle in mano |
| `rivelazione` | evento `rivelazione` |
| `belatoPunteggio` | fase `belati_punteggio` e tra le `azioni` dell'umano c'è un `giocaBelato` |
| `tuoDado` | fase `dado` e tocca all'umano lanciare |
| `pascolo`, `furto`, `testata` | evento `dado_lanciato` con faccia del tipo corrispondente (`config.dado`) |
| `beeeNo` | `finestra.inAttesa` contiene l'umano e tra le `azioni` c'è `giocaBelato` di un `beee-no` |
| `guaioTuo`, `guaioBot` | evento `guaio_preso` dell'umano o di un bot |
| `fineRound` | evento `round_iniziato` con `round >= 2` |

- [ ] **Passo 1: test che falliscono** (`guida.test.ts`, stati costruiti con `scenario`/`prosegui`/`scegli` di `engine/test/aiuti.ts`, come in `client/src/partita/regia.test.ts`):
  - `'all'inizio il primo consiglio è inizio, poi guaio'`;
  - `'tratto compare solo se il Guaio tocca la pecora'`: Guaio dei Drammi con Nerina → no; Lupo → sì;
  - `'gemelle solo con due Gemelle in mano'`;
  - `'un consiglio già visto non torna'`;
  - `'due momenti insieme: esce il primo dell'ordine, poi l'altro'`;
  - `'beeeNo solo se l'umano ha un Beee-NO! giocabile'`: senza Beee-NO! in mano, durante una finestra → `null`. È il Punto da sorvegliare 5;
  - `'scenaProva: turno di un bot → attesaBot; domanda con l'umano → suo pannello privato'`. È il Punto da sorvegliare 4;
  - `'provaGuidataFinita: vero dal round 4, falso a partita finita'`. È il Punto da sorvegliare 3.

- [ ] **Passo 2: vederli fallire.**
  - Comando: `npx vitest run client/src/prova/guida.test.ts`
  - Atteso: FAIL (moduli mancanti).

- [ ] **Passo 3: realizzare** `regiaProva.ts` e `guida.ts`.

- [ ] **Passo 4: verificare.**
  - Comando: `npx vitest run client/src/prova/guida.test.ts`. Atteso: verde.
  - Poi `npm run typecheck`. Atteso: pulito.

- [ ] **Passo 5: nessun commit.**

---

### Compito 4: interfaccia della prova

**File:**
- Crea: `client/src/prova/PartitaProva.tsx`
- Modifica:
  - `client/src/testi.ts`: blocco `prova`;
  - `client/src/partita/Partita.tsx`: proprietà facoltative;
  - `client/src/schermate.tsx`: pulsante nella Home;
  - `client/src/App.tsx`: schermata `'prova'`;
  - `client/src/stile.css`: `.consiglio`, `.fine-prova`.

**Interfacce:**
- Consuma: `SessioneProva` (compito 2), `scenaProva`, `prossimoConsiglio`, `provaGuidataFinita` (compito 3).
- `T.prova`:
  - `pulsante: 'Partita di prova'`;
  - `pensa: (nome: string) => \`${nome} sta pensando…\``;
  - `consiglioTitolo: 'Consiglio'`;
  - `hoCapito: 'Ho capito'`;
  - `consigli: Record<IdConsiglio, string>`, con i testi 1–15 del progetto;
  - `fine: { titolo: 'Ora sai come si gioca!', testo: 'Se il mazzo finisce, si gioca un ultimo round e vince chi ha più agnellini.', continua: 'Continua la partita', home: 'Torna alla schermata principale' }`.
- `Partita` riceve `umano?: IdGiocatore` e `testa?: React.ReactNode`:
  - con `umano`, la scena si calcola con `scenaProva` e non compare mai `PassaDispositivo`;
  - `attesaBot` mostra un pannello con `T.prova.pensa(nome)` e nessuna azione;
  - `testa` si disegna sopra il pannello.
  - Senza le due proprietà, `Partita` si comporta come oggi.
- `PartitaProva({ onHome }: { onHome: () => void })`:
  - crea `SessioneProva` all'apertura e la chiude all'uscita (`useEffect` con `chiudi`);
  - tiene i `visti` in uno `useState<Set<IdConsiglio>>`;
  - passa a `Partita` il riquadro del consiglio corrente come `testa`;
  - quando `provaGuidataFinita` è vera (una sola volta) mostra il riquadro `.fine-prova` con i due pulsanti:
    - "Continua" lo chiude e la partita prosegue;
    - "Torna" chiama `onHome`.
  - "Rivincita" a fine partita crea una nuova `SessioneProva`.
- Home: `onProva: () => void`, con il pulsante secondario `T.prova.pulsante` subito sotto il blocco di "Gioca su questo dispositivo".

- [ ] **Passo 1: test che falliscono** (in `client/src/App.test.tsx`, nuovo `describe('Partita di prova')`):
  - `'dalla Home parte la prova: consiglio di inizio, nessun Passa il dispositivo'`;
  - `'il consiglio si chiude con Ho capito e arriva il successivo'`;
  - `'mentre gioca un bot compare "sta pensando" e nessun pulsante d'azione'`.

- [ ] **Passo 2: vederli fallire.**
  - Comando: `npx vitest run client/src/App.test.tsx -t "Partita di prova"`
  - Atteso: FAIL.

- [ ] **Passo 3: realizzare** testi, proprietà di `Partita`, `PartitaProva`, pulsante e schermata. Il riquadro del consiglio ha `role="status"`.

- [ ] **Passo 4: verificare.**
  - Comando: `npx vitest run client/src/App.test.tsx`. Atteso: verde.
  - Poi `npm run typecheck`.

- [ ] **Passo 5: nessun commit.**

---

### Compito 5: prova completa, uscite e controllo a vista

**File:**
- Modifica: `client/src/App.test.tsx`

- [ ] **Passo 1: test della prova completa.** Con timer finti, un aiuto `passoProva()` sceglie le mosse "ovvie" del compito 1:
  - chiude ogni consiglio;
  - gioca la carta più alta che non sia una Gemella nei round 1 e 3, le Gemelle nel round 2, il Beee-NO! quando compare il suo consiglio;
  - altrimenti tocca "Continua" o "Lascia passare".

  I test sono:
  - `'la prova arriva a "Ora sai come si gioca!" mostrando i consigli principali'`: sono comparsi almeno `inizio`, `guaio`, `scelta`, `rivelazione`, `tuoDado`, `pascolo`, `furto`, `beeeNo`, `testata`, `fineRound`. Si controlla dai testi comparsi a schermo;
  - `'Continua la partita porta fino alla fine'`: si arriva a `.fine-partita`;
  - `'Torna alla schermata principale esce dalla prova'`;
  - `'una partita vera salvata resta riprendibile'`: si avvia e si interrompe una partita vera, si entra ed esce dalla prova con "Esci" del menu, poi "Riprendi la partita" mostra `Passa il dispositivo a …`. È il Punto da sorvegliare 1;
  - `'ricaricando durante la prova si riapre la Home'`: smontaggio e rimontaggio di `App`, nessun errore, la Home si vede. È il Punto da sorvegliare 2.

- [ ] **Passo 2: lanciarli.**
  - Comando: `npx vitest run client/src/App.test.tsx`
  - Atteso: verde. Se fallisce, la causa va cercata nel codice dei compiti 1–4, non nel test.

- [ ] **Passo 3: tutto il resto.**
  - Comando: `npm test && npm run typecheck`. Atteso: tutto verde.

- [ ] **Passo 4: controllo a vista** con `preview_start` `{name: "gioco"}` a 360×640:
  - la Home col nuovo pulsante;
  - un consiglio aperto;
  - "Bea sta pensando…";
  - il riquadro "Ora sai come si gioca!";
  - nessuno scorrimento orizzontale.

  Poi `resize_window` con `preset: "desktop"`.

- [ ] **Passo 5: aggiornare `bozze/da-fare.md`** (punto 2 fatto) e `bozze/passaggio-di-consegne.md` (sezione della partita di prova). Nessun commit. Poi stop: riassunto all'utente.

---

## Carte finali di `prova.json` (dal compito 1, passo 4)

Fissate il 14 ottobre (test dei tre round verde):
- Mani: g1 `carriola`, `calzino-gemello`, `ciliegie-appaiate`, `belato-di-gruppo`, `beee-no`; g2 `capriola`, `cannocchiale`, `sasso-comodo`, `agnellino-smarrito`, `orecchino-gemello`; g3 `balla-di-fieno`, `coperta-di-lana`, `trifoglio-qualunque`, `scorta-nel-vello`, `megafono-di-latta`.
- Cima del mazzo: `tappi-per-le-orecchie`, `fischietto-da-richiamo`, `cannocchiale`, `balla-di-fieno`, `capriola`, `coperta-di-lana`.
- Come vanno i round: 1) tu tiri Pascolo, Bea prende il Lupo; 2) Bea tira Furto contro di te (Beee-NO! possibile), tu prendi la Grandine; 3) tu tiri Testata, Bea prende Crisi esistenziale.
