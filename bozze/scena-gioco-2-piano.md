# Scena nel gioco, pezzo 2: la regia — piano di lavoro

> **Per chi esegue:** SOTTO-SKILL OBBLIGATORIA: superpowers:subagent-driven-development (o superpowers:executing-plans), compito per compito. I passi usano le caselle (`- [ ]`).

**Obiettivo:** gli eventi della partita (dado, furto, Testata, Guai con meteo e Lupo, Beee-NO!, rivelazione, eliminazione, fine) si vedono recitati nella scena. Il pannello successivo e "Passa il dispositivo" aspettano la fine della recita (per i meteo al massimo 5 secondi), e un tocco sul prato salta.

**Architettura:**
- un **copione** puro traduce gli eventi nuovi del motore in battute;
- un **regista** dentro il teatro le recita con gli ordini del pezzo 1 (più alcuni nuovi), poi rimette in pari la scena con la fotografia e dice quando è "occupato";
- React (`Scena`, `Partita`, `PartitaProva`) aspetta finché il regista è occupato.

**Tecnologie:** TypeScript, React 19, Vitest con jsdom.

**Progetto:** `bozze/scena-gioco-2-progetto.md` (approvato dall'utente il 15 ottobre). Bozza di riferimento per le animazioni: `bozze/scena/scena.src.html`. Il teatro del pezzo 1 è in `client/src/scena/`, con le scelte nel registro `.superpowers/sdd/scena-gioco-1-piano/progress.md`.

## Vincoli globali

- **Niente commit né push** senza richiesta dell'utente.
- In Bash: `export PATH="$PWD/.tools/bin:$PATH"`. Le scorciatoie lanciano vitest, tsc e vite direttamente. Niente installazioni né server di sviluppo da Bash.
- Nomi, tipi e commenti in italiano. Tutti i testi visibili ai giocatori in `client/src/testi.ts` (`T.scena`).
- Il motore (`engine/`) non si tocca. Delle stanze (`client/src/remoto/`, `sync/host.ts`, `sync/ospite.ts`) non si tocca niente. Si tocca solo `sync/prova.ts`, per la pausa dei bot.
- Regole del teatro del pezzo 1:
  - tempo della scena da `ctx.orologio`, con `{ decorativo: true }` per ciò che non è evento;
  - API del browser da `piattaforma`;
  - caso da `ctx.caso`;
  - niente `id` nel DOM, CSS sotto `.teatro`.
- **Eccezione nuova alla regola del tempo:** il tempo massimo di una battuta (25 s) è in **tempo vero** (`setTimeout`), perché quando il browser non disegna l'orologio della scena si ferma.
- **Valori fissi dal progetto:**
  - attesa del meteo e del Lupo **5000 ms** di tempo della scena;
  - tempo massimo per battuta **25000 ms** veri;
  - oltre **8** battute in coda la scena si mette in pari "subito";
  - velocità 1, 2 ("Animazioni veloci") e 6 (salto), come nel pezzo 1.
- **Regola anti-sbirciata:** la mano scoperta solo nella schermata privata di chi sta in basso e mai con un passaggio in attesa, anche mentre la scena recita; nella prova sempre scoperta.
- **Comandi:** `npx vitest run <file>`, `npm test`, `npm run typecheck`, `npm run build`. I file di prova che toccano il DOM iniziano con `// @vitest-environment jsdom`.

## Punti da controllare in revisione

1. **Il regista non si libera mai** (battuta che non finisce, finestra coperta): dopo 25 s veri il regista si libera e il pannello compare. → prove nei compiti 3 e 4.
2. **Niente sbirciate durante l'attesa:** mentre la scena recita e un "Passa a" è in attesa, la fotografia ha `mano: null`. → prova nel compito 4.
3. **Mosse che arrivano mentre la scena recita** (bot veloci, più eventi in fila): ordine rispettato, nessun agnellino perso, a fine recita la scena coincide con la partita. → prova "conto giusto con la regia" nel compito 3.
4. **Smontaggio o nascondimento a metà recita** (Regole durante la prova, StrictMode, ritorno da un'altra scheda): nessuna recita rifatta, nessun "occupato" che resta acceso, `Partita` non resta ad aspettare una scena che non c'è più. → prove nei compiti 3 e 4.
5. **Ricostruzione del tavolo** (cambio di chi sta in basso) con un meteo ancora sullo sfondo: il meteo si ferma, la coda si svuota, il regista è libero. → prova nel compito 3.

---

## Mappa dei file

```
client/src/scena/regia/copione.ts      battute dagli eventi (puro)
client/src/scena/regia/regista.ts      recita le battute, occupato, tempo massimo, messa in pari
client/src/scena/ordini.ts             + nuovi ordini (compito 2)
client/src/scena/teatro.ts             + recita / occupato / ascoltaOccupato
client/src/scena/Scena.tsx             + eventi, onOccupato
client/src/partita/Partita.tsx         attese del cassetto, del passaggio, della classifica
client/src/prova/PartitaProva.tsx      pausa dei bot
sync/prova.ts                          SessioneProva.pausa
client/src/testi.ts                    T.scena.fumetti, T.scena.annunci
```

---

### Compito 1: Il copione

**File:**
- Creare: `client/src/scena/regia/copione.ts`
- Prova: `client/src/scena/regia/copione.test.ts`
- Modificare: `client/src/testi.ts`

**Interfacce:**
- Consuma: `Evento`, `Vista`, `IdGiocatore`, `IdCarta`, `Luogo` da `engine/src`; `Fotografia` da `client/src/scena/fotografia.ts`; `descriviVoce`, `nome` da `client/src/partita/descrizioni.ts`; `T`.
- Produce:
  ```ts
  export type Attesa = { tipo: 'fine' } | { tipo: 'massimo'; ms: number } | { tipo: 'niente' };
  export type Battuta =
    | { tipo: 'guaioRivelato'; carta: IdCarta; attesa: Attesa }
    | { tipo: 'annuncio'; testo: string; attesa: Attesa }
    | { tipo: 'giraCarte'; carte: Partial<Record<IdGiocatore, IdCarta[]>>; attesa: Attesa }
    | { tipo: 'fumetti'; testi: Partial<Record<IdGiocatore, string>>; attesa: Attesa }
    | { tipo: 'volaCarta'; daChi: IdGiocatore; carta: IdCarta; testo: string | null; attesa: Attesa }
    | { tipo: 'beeeNo'; chi: IdGiocatore; attesa: Attesa }
    | { tipo: 'dado'; faccia: string; attesa: Attesa }
    | { tipo: 'agnellini'; spostamenti: Array<{ da: Luogo; a: Luogo; quanti: number }>; ladro: IdGiocatore | null; modo: 'corre' | 'vola'; attesa: Attesa }
    | { tipo: 'testata'; chi: IdGiocatore; bersaglio: IdGiocatore; quanti: number; attesa: Attesa }
    | { tipo: 'guaio'; carta: IdCarta; chi: IdGiocatore; deviatoDa: IdGiocatore | null; attesa: Attesa }
    | { tipo: 'eliminata'; chi: IdGiocatore; attesa: Attesa }
    | { tipo: 'festa'; vincitori: IdGiocatore[]; attesa: Attesa };
  export function copione(eventi: Evento[], vista: Vista): Battuta[];
  export const ATTESA_METEO_MS = 5000;
  ```
- **Corrispondenze** (tabella del § 1 del progetto). Attese:
  - `fine` di regola;
  - `{ massimo: 5000 }` per `guaio` quando la carta ha un effetto in scena: i 7 meteo e `lupo-vegetariano` (`meteo/indice.ts` sa quali);
  - `{ massimo: 1200 }` per `fumetti` e `annuncio`;
  - `niente` per nessuna battuta in questo pezzo (il tipo resta per il pezzo 3).
- **Regole:**
  - `round_iniziato` con `ultimo` o `ultimo_round_annunciato` → `annuncio(T.scena.annunci.ultimoRound)`, una sola volta anche se arrivano tutti e due;
  - `guaio_rivelato` con carta → `guaioRivelato`;
  - `rivelazione` → `giraCarte`, poi le righe `punteggio` che la seguono (stessa serie di eventi) diventano **un solo** `fumetti` con il totale di ciascuno (`T.scena.fumetti.punteggio(totale)`);
  - `dichiarazione`:
    - per Trovata con effetto, Belato o Beee-NO! → `volaCarta(autore, carta, testo breve)`;
    - per il dado (dettagli `dado`) → `fumetti` sul lanciatore con la dichiarazione (per esempio `T.scena.fumetti.furto(q)`);
  - `annullata` → `beeeNo(autore della voce `da`)`;
  - `punteggio` fuori dalla rivelazione (Belati) → `fumetti` sul giocatore con `+2`/`−2` (`T.scena.fumetti.delta(n)`);
  - `dado_lanciato` → `dado(faccia)`;
  - `agnellini`:
    - gli eventi `furto` consecutivi più quello dal gregge → **una** battuta `agnellini` con `ladro` = destinazione;
    - `pascolo`, `consolazione`, `prendi_agnellino`, `sposta_agnellino`, `eliminazione` → `agnellini` con `ladro: null`;
    - `modo 'corre'` sempre, tranne `testata`;
  - `agnellini` causa `testata` seguito da `testata` → **una** battuta `testata(chi, bersaglio, quanti)` (l'evento `agnellini` non dà una battuta propria);
  - `belato_finale` → `giraCarte` con le carte rivelate;
  - `guaio_deviato` subito prima di `guaio_preso` → `guaio` con `deviatoDa`;
  - `guaio_preso` → `guaio(carta, chi)`; la `consolazione` che lo segue → `agnellini` subito dopo;
  - `guaio_curato` → `fumetti` (`T.scena.fumetti.curato`);
  - `eliminato` → `eliminata(chi)`, poi il suo `agnellini`;
  - `fine_partita` → `festa(vincitori)`;
  - tutti gli altri (`scartate`, `pescate`, `ripescata`, `guaio_in_fondo`, `guai_rimescolati`, `fuori_dal_round`, `ha_scelto`, `effetto`, `risolta`) → nessuna battuta.
- **Testi nuovi** in `T.scena`:
  - `annunci.ultimoRound: 'Ultimo round!'`;
  - `fumetti.punteggio: (n) => \`${n}\``;
  - `fumetti.delta: (n) => (n > 0 ? \`+${n}\` : \`${n}\`)`;
  - `fumetti.curato: 'Che sollievo!'`;
  - `fumetti.furto: (q) => \`Furto ${q}!\`` (esiste già dal pezzo 1, riusarlo);
  - testo breve di `volaCarta` = nome della carta (`nomeCarta`).

- [ ] **Passo 1: scrivere le prove che falliscono** (`copione.test.ts`). Eventi costruiti a mano con `seq` crescenti più una `Vista` da `vistaPer(nuovaPartita(...), null)`:
  - una prova per ogni regola elencata sopra, controllando tipo, dati e attesa;
  - `testata`: la sequenza `[agnellini(testata), testata]` dà una sola battuta `testata` con `quanti` dall'evento;
  - furto da due avversari più il gregge: una battuta con tre spostamenti e `ladro`;
  - rivelazione con tre righe `punteggio` per giocatore: `giraCarte` più un solo `fumetti` con i totali;
  - Guaio meteo → attesa `{ massimo: 5000 }`; Guaio dei Drammi → attesa `fine`;
  - "Ultimo round!" una sola volta;
  - eventi da mettere solo in pari → `[]`;
  - in nessuna battuta compaiono id di carte di mani private (gli eventi della vista pubblica non li hanno; controllo su `pescate`).
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere `copione.ts` e i testi.**
- [ ] **Passo 4: lanciarle, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 2: Le animazioni nuove del teatro

**File:**
- Modificare: `client/src/scena/ordini.ts` (e, se serve, `tavolo/postazioni.ts`, `tavolo/coperta.ts`, `personaggi/pecora.ts`, `scena.css`)
- Prova: `client/src/scena/ordini.test.ts`

**Interfacce:**
- Consuma: `Ordini`/`OrdiniDelTeatro`, `postazioni`, `coperta`, `mano` (`trasf`, `posizioneMano`), `camera`, `meteo` del pezzo 1.
- Produce (aggiunte a `Ordini`, tutte avvolte da `regia.conEvento` come gli altri ordini):
  ```ts
  guaioRivelato(carta: IdCarta): Promise<void>;                       // la carta arriva sulla tovaglia e si gira (~700 ms)
  annuncio(testo: string): Promise<void>;                             // scritta grande al centro dell'interfaccia, 1200 ms
  giraCarte(carte: Partial<Record<IdGiocatore, IdCarta[]>>): Promise<void>;  // le carte coperte del round si girano, 150 ms tra un posto e l'altro
  fumetti(testi: Partial<Record<IdGiocatore, string>>, ms?: number): Promise<void>;   // un fumetto per pecora, si risolve dopo ms (predefinito 1200)
  volaCarta(daChi: IdGiocatore, carta: IdCarta, testo: string | null): Promise<void>; // dalla postazione al centro, fumetto, poi agli scarti (bozza `gioca`, righe 1928–1945, senza regole)
  eliminata(chi: IdGiocatore): Promise<void>;                         // reagisci 'svenuta' tenuta, targa aggiornata dalla fotografia dopo
  festa(vincitori: IdGiocatore[]): Promise<void>;                     // bozza `vittoria` (righe 2545–2554) senza il riquadro #finale: ~3000 ms; vibra('vittoria') se vince chi sta in basso
  guaio(carta: IdCarta, chi: IdGiocatore, o?: { liberaDopoMs?: number }): Promise<void>;
  // con liberaDopoMs il Promise si risolve dopo quel tempo (e la camera torna indietro) mentre il meteo continua; senza, come oggi
  ```
- I testi visibili restano in `T.scena` (nessun testo scritto dentro `ordini.ts`).
- `interrompi()` (ricostruzione) e `distruggi` fermano anche questi ordini: annunci, coriandoli, voli e fumetti tolti.

- [ ] **Passo 1: scrivere le prove che falliscono** (`ordini.test.ts`, jsdom, `creaTeatro` con ciclo manuale, `ambiente: false`, `giochi: false`):
  - ognuno dei nuovi ordini si risolve entro il suo tempo e lascia `eventoInCorso() === false`;
  - `giraCarte` mostra i nomi delle carte sullo sterrato;
  - `annuncio` mostra `T.scena.annunci.ultimoRound` e poi lo toglie;
  - `festa`: con chi sta in basso tra i vincitori `navigator.vibrate` riceve `[80, 60, 80, 60, 220]`;
  - **`guaio` con `liberaDopoMs: 5000`** su un avversario con un meteo lungo (nebbia):
    - il Promise si risolve a 5 s di scena (±100 ms);
    - in quel momento `stato().zoom === 1` e nessuna postazione nascosta;
    - `eventoInCorso()` resta vero finché la nebbia non finisce, poi falso;
  - `interrompi()` a metà di `festa` e di `volaCarta`: nessun elemento rimasto.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere i nuovi ordini.**
- [ ] **Passo 4: lanciare le prove di `client/src/scena`.** Atteso: PASS. Anche `meteo.test.ts` deve restare verde.
- [ ] **Passo 5: registro.**

### Compito 3: Il regista

**File:**
- Creare: `client/src/scena/regia/regista.ts`
- Modificare: `client/src/scena/teatro.ts`
- Prove: `client/src/scena/regia/regista.test.ts`, `client/src/scena/regia/conto.test.ts`

**Interfacce:**
- Consuma: `copione` (compito 1), ordini (compito 2), `allinea`, `ctx.regia` del teatro.
- Produce (aggiunte a `Teatro`):
  ```ts
  /** Recita gli eventi nuovi (seq > ultimo recitato) e poi mette in pari con `foto`. La prima chiamata, o un tavolo
   *  da ricostruire, mette in pari "subito" senza recitare. */
  recita(foto: Fotografia, vista: Vista): void;
  occupato(): boolean;
  ascoltaOccupato(cb: (occupato: boolean) => void): () => void;
  ```
- **Comportamento del regista:**
  - **Coda di battute.** Ogni chiamata a `recita` aggiunge le battute del copione e ricorda la fotografia più recente.
  - **"Occupato"** finché c'è una battuta che fa aspettare o la coda non è vuota. Gli ascoltatori sono avvisati solo ai cambi.
  - **Attesa `fine`:** si aspetta il Promise dell'ordine.
  - **Attesa `{ massimo: ms }`:**
    - per `guaio` l'ordine riceve `liberaDopoMs: ms`;
    - per `fumetti` e `annuncio` si aspetta il Promise, che dura `ms`.
  - **Tempo massimo per battuta:** `setTimeout` vero di 25000 ms. Allo scadere si passa alla battuta successiva e la messa in pari finale resta.
  - **Coda vuota:** `allinea(fotoPiùRecente, 'calmo')`, poi "libero".
  - **Più di 8 battute in coda**, oppure `allinea(_, 'subito')` chiamato da fuori (ritorno da un'altra scheda), oppure ricostruzione del tavolo:
    - si svuota la coda;
    - si interrompono gli ordini (`ordini.interrompi`);
    - `allinea(..., 'subito')`;
    - "libero".
  - **Prima chiamata:** `ultimoSeq` = seq più alto degli eventi, `allinea(foto, 'subito')`, nessuna recita.
  - **`distruggi`:** il regista si ferma, avvisa "libero" una volta, toglie gli ascoltatori.
- `teatro.allinea` resta pubblico e funziona come oggi (lo usano la pagina di sviluppo e le prove); `recita` è la via del gioco.

- [ ] **Passo 1: scrivere le prove che falliscono** (`regista.test.ts`, jsdom, ciclo manuale, `ambiente: false`, `giochi: false`, eventi da partite vere con `applica`):
  - **prima recita:** niente battute, `occupato() === false`, scena in pari;
  - **Pascolo:**
    - `recita` con `dado_lanciato` più `agnellini` → occupato subito;
    - dopo `avanza` sufficiente → libero;
    - gli agnellini coincidono con la fotografia;
    - l'ascoltatore ha ricevuto `[true, false]`;
  - **meteo** (Guaio nebbia su un avversario): libero dopo 5 s di scena (±100 ms), zoom 1, nebbia ancora in corso (`eventoInCorso()` vero) e poi finita;
  - **salto:** con una battuta lunga in corso, `salta()` → libero entro 1,5 s di scena;
  - **Animazioni veloci:** con `veloci` acceso il meteo libera dopo 2,5 s veri di ciclo (2 × velocità);
  - **tempo massimo** (timer finti di Vitest per il `setTimeout` vero): un ordine che non si risolve mai (sostituito con un Promise appeso) → dopo 25000 ms libero e scena in pari;
  - **troppe battute:** 9 battute in coda → messa in pari "subito", libero, nessuna animazione in corso;
  - **`allinea(foto, 'subito')` durante una recita** → coda svuotata, libero;
  - **ricostruzione** (punto 5 della revisione): durante il meteo sullo sfondo, `recita` con un altro `inBasso` → meteo fermato, libero, scena in pari;
  - **distruggi durante una recita** (punto 4): l'ascoltatore riceve `false`, nessun timer vero rimasto (`vi.getTimerCount()` a 0 dopo l'avanzamento dei timer finti).
- [ ] **Passo 2: scrivere la prova "conto giusto con la regia"** (`conto.test.ts`, punto 3):
  - 6 partite simulate (2, 3, 4 giocatori × strategie `semplice` e `casuale`, seme 1) con `giocaPartiteSimulate`;
  - dopo ogni mossa `teatro.recita(foto, vista)`; ogni 3 mosse un `salta()`, così si provano anche le recite saltate;
  - si avanza finché il teatro è libero e `eventoInCorso()` è falso (al più 60 s di scena), poi gli agnellini, recinto per recinto, coincidono con la fotografia;
  - tetto di durata del file: 120 s. Se lo supera, 3 partite (una per numero di giocatori), annotandolo nel registro.
- [ ] **Passo 3: lanciarle e vederle fallire.**
- [ ] **Passo 4: scrivere `regista.ts` e le aggiunte a `teatro.ts`.**
- [ ] **Passo 5: lanciare le prove di `client/src/scena` e `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 6: registro.**

### Compito 4: Il collegamento con il gioco

**File:**
- Modificare:
  - `client/src/scena/Scena.tsx`;
  - `client/src/partita/ScenaCaricata.tsx`;
  - `client/src/partita/Partita.tsx`;
  - `client/src/prova/PartitaProva.tsx`;
  - `sync/prova.ts`.
- Prove: `client/src/App.test.tsx` (e il suo teatro finto), `client/src/scena/Scena.test.tsx`, `sync/prova.test.ts`

**Interfacce:**
- Consuma: `Teatro.recita`, `occupato`, `ascoltaOccupato` (compito 3).
- Produce:
  - `Scena` riceve `vista: Vista` (la vista del tavolo) e `onOccupato?: (occupato: boolean) => void`. A ogni nuova fotografia chiama `teatro.recita(foto, vista)` invece di `allinea` "calmo". Al ritorno da un'altra scheda resta `allinea(..., 'subito')`. Smontandosi chiama `onOccupato(false)`.
  - `SessioneProva.pausa(attiva: boolean): void`. Con `true` annulla la mossa del bot in sospeso e non ne pianifica altre; con `false` ripianifica.
- **`Partita`:**
  - stato `scenaOccupata` (da `onOccupato`);
  - mentre è vero non mostra il cassetto né lo strato "Passa il dispositivo" (la mano resta coperta perché `passaggio` è già vero);
  - quando `sc.tipo === 'fine'`, finché la scena è occupata (festa) mostra ancora la scena; poi `FinePartita`;
  - se la scena non è montata (caricamento in corso o fallito), `scenaOccupata` è falso.
- **`PartitaProva`:** `onOccupato` → `sessione.pausa(occupata)`.
- Il teatro finto di `App.test.tsx` registra anche `recita`, ha `occupato()` e `ascoltaOccupato`, e la prova può dirgli quando essere occupato e quando liberarsi.

- [ ] **Passo 1: scrivere le prove che falliscono.**
  - `App.test.tsx`:
    - **attesa del pannello:** finto occupato dopo una mossa → nessun cassetto e nessun `.passaggio`; liberato → compaiono;
    - **niente sbirciate durante l'attesa** (punto 2): mentre il finto è occupato e un passaggio è in attesa, l'ultima fotografia passata a `recita` ha `mano === null`;
    - **fine partita:** con il finto occupato, a partita finita la classifica non c'è; liberato → compare;
    - **prova:** con il finto occupato i bot non muovono (nessun nuovo evento per 5 s di timer finti); liberato → muovono;
    - **smontaggio** (punto 4): andando alle Regole durante la prova con il finto occupato e tornando, il cassetto compare (nessuna attesa rimasta appesa).
  - `sync/prova.test.ts`: `pausa(true)` → nessuna mossa dei bot; `pausa(false)` → la mossa arriva dopo `pausaMs`.
  - `Scena.test.tsx` (teatro vero): una nuova fotografia con eventi di Pascolo → `onOccupato(true)`, poi `onOccupato(false)`; smontando durante l'occupato → `onOccupato(false)`.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere le modifiche.**
- [ ] **Passo 4: `npm run typecheck`, `npm test` intero, `npm run build`.** Atteso: tutto verde, build senza avvisi.
- [ ] **Passo 5: registro.**

### Compito 5: Prove nel browser e documenti (controllore)

- [ ] **Passo 1: browser** (gioco in anteprima, 390×844, finestra visibile, pilota automatico come nel pezzo 1):
  - partite intere a 2, 3 e 4 giocatori e la prova fino alla fine;
  - guardare a occhio dado, furto, Testata, Guai con meteo e Lupo, Beee-NO!, rivelazione, "Ultimo round!", eliminazione e festa;
  - un meteo su un avversario: zoom, ritorno a 5 s, pannello che compare mentre il meteo continua;
  - un tocco sul prato che salta;
  - nessun errore in console;
  - le 72 prove del meteo della pagina di sviluppo ancora verdi (`PROVE.provaCompleta('normale')`).
- [ ] **Passo 2: documenti.**
  - `bozze/da-fare.md`: pezzo 2 fatto.
  - `bozze/passaggio-di-consegne.md`: sezione "Scena nel gioco, pezzo 2".
  - `CLAUDE.md`: una riga per `client/src/scena/regia/`.
- [ ] **Passo 3: revisione finale** (revisore separato, impegno alto) e stop di fase.

---

## Copertura del progetto

| Progetto | Compito |
|---|---|
| tabella del § 1 (ogni momento) | 1 (copione), 2 (animazioni nuove) |
| meteo pieni, 5 s di attesa, camera indietro | 1 (attesa), 2 (`liberaDopoMs`), 3 |
| un meteo nuovo sostituisce il vecchio | pezzo 1 (già così), 3 (ricostruzione) |
| tocco per saltare, animazioni veloci | 3 |
| pannello e "Passa a" che aspettano, mano coperta | 4 |
| festa, poi classifica | 2, 4 |
| bot della prova che aspettano | 4 |
| tempo massimo 25 s veri, oltre 8 battute "subito", prima foto e ritorno senza recita | 3 |
| conto giusto con la regia | 3 |
| prove nel browser, documenti, revisione | 5 |
