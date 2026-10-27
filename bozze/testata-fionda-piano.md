# Testata a fionda — piano di lavoro

> **Per chi esegue:** SOTTO-PROCEDURA OBBLIGATORIA: superpowers:subagent-driven-development (consigliata) o superpowers:executing-plans, compito per compito. I passi usano le caselle (`- [ ]`).

**Scopo:** la Testata del Montone si gioca sul prato come una fionda (tiri indietro il Montone, lo lasci, vola ad arco sul recinto dell'avversario, i tre cerchi decidono quanti agnellini cadono), al posto del riquadro di mira sopra la scena.

**Architettura:** una parte pura (`client/src/scena/fionda/tiro.ts`) calcola dal tiro il punto d'arrivo, dal punto il risultato e, per gli altri telefoni, un punto d'arrivo coerente con il risultato. La domanda della scena porta i dati della fionda; un nuovo modulo della scena (`fionda/mira.ts`) mostra Montone, elastico, scia e cerchi e manda un gesto `fionda` che `avanza` trasforma nella mossa `esitoTestata`. La regia fa volare il Montone ad arco verso il punto vero (su chi tira) o verso il punto di scena (sugli altri). Motore, regole delle stanze e `sync/` non cambiano.

**Tecnologia:** TypeScript, React 19, Vitest + jsdom, scena in DOM/SVG con Web Animations.

**Progetto:** `bozze/testata-fionda-progetto.md` (approvato dall'utente il 21 ottobre 2026). Leggerlo prima di cominciare.

## Vincoli generali

- Motore e `sync/` non si toccano: l'azione resta `{ tipo: 'esitoTestata'; giocatore; esito }` con esito 0–3, mai più degli agnellini del bersaglio.
- Tutti i testi visibili in `client/src/testi.ts`, in italiano. Nomi, tipi e commenti in italiano come nel resto del codice.
- Numeri della fionda (cerchi, forza, scia) in un file di dati: `client/src/scena/fionda/fionda.json`, non nel codice.
- Il riquadro di oggi (`client/src/partita/Testata.tsx`) resta solo per i pannelli di riserva (`Partita.tsx`, `Stanza.tsx`).
- Durante il lavoro solo prove mirate (`npx vitest run <file>`); la suite intera una volta sola prima di pubblicare. Niente commit né push senza richiesta dell'utente.
- Node non è installato: in Bash sempre `export PATH="$PWD/.tools/bin:$PATH"` dalla radice. Non usare `prettier --write` su file interi.
- Movimento ridotto: con `ctx.ridotto` le animazioni durano 1 ms come le altre battute; il risultato si manda lo stesso.

## Da guardare in revisione

1. **Doppio invio:** due rilasci di fila, o un nuovo disegno della pagina durante il volo, devono dare un solo `esitoTestata` (la guardia "una risposta per domanda" di `GiocoInScena`). Prova nel compito 3 e in `Stanza.test.tsx` (compito 6).
2. **Bersaglio con meno di 3 agnellini:** cerchi con i numeri già limitati (1,1,1 con un agnellino) e risultato mai oltre gli agnellini. Prove nei compiti 1 e 4.
3. **Scena occupata o pagina ridimensionata mentre si mira:** la domanda viene tolta e rimessa; il recinto deve tornare normale quando si toglie e i cerchi devono ridisegnarsi su `riposiziona`. Prova nel compito 4.
4. **Tiro locale che non corrisponde:** se il punto ricordato da chi tira non è per quel bersaglio o quel risultato (il motore ha limitato l'esito), la regia usa il punto di scena. Prova nel compito 5.
5. **Tocco per sbaglio:** rilascio con l'elastico quasi a riposo → nessun gesto, si può riprovare. Prove nei compiti 1 e 4.

---

### Compito 1: calcolo puro del tiro e dati della fionda

**File:**
- Crea: `client/src/scena/fionda/fionda.json`, `client/src/scena/fionda/tiro.ts`
- Prova: `client/src/scena/fionda/tiro.test.ts`

**Interfacce:**
- Produce (da `tiro.ts`):
  - `interface Punto { x: number; y: number }` (coordinate del mondo della scena, 390×844)
  - `interface Rett { x0: number; y0: number; x1: number; y1: number }` (il recinto, come `Area` di `personaggi/aree.ts`)
  - `const FIONDA` = contenuto tipizzato di `fionda.json`
  - `puntoArrivo(partenza: Punto, tiro: Punto, gittata: number): Punto | null`
  - `gittataMassima(partenza: Punto, recinti: Rett[]): number`
  - `zonaDi(p: Punto, r: Rett): 3 | 2 | 1 | 0`
  - `esitoTiro(arrivo: Punto, r: Rett, massimo: number): number`
  - `valoriCerchi(massimo: number): [number, number, number]`
  - `puntoDiScena(r: Rett, esito: number, seq: number): Punto`
  - `scia(partenza: Punto, arrivo: Punto): Punto[]`
  - `posizioneInVolo(partenza: Punto, arrivo: Punto, t: number): Punto & { alto: number }`

`fionda.json`:

```json
{
  "cerchi": { "centro": 0.25, "mezzo": 0.55 },
  "tiroMinimo": 14,
  "tiroMassimo": 150,
  "oltre": 1.2,
  "scia": 0.4,
  "puntiScia": 7,
  "altezzaArco": 0.35,
  "fuori": 18
}
```

Significato (in un commento in testa a `tiro.ts`): `cerchi.*` = diametro dell'ellisse in frazione di larghezza e altezza del recinto; `tiroMinimo` = sotto questa lunghezza dell'elastico (unità del mondo) il tiro non parte; `tiroMassimo` = elastico alla forza piena; `oltre` = la gittata massima è `oltre` × la distanza dall'angolo più lontano del recinto più lontano; `scia` = frazione del percorso mostrata dai puntini; `altezzaArco` = altezza dell'arco in frazione della distanza; `fuori` = quanto fuori dal bordo atterra un colpo a vuoto di scena.

- [ ] **Passo 1: scrivere le prove**

```ts
describe('fionda: dal tiro al punto d\'arrivo', () => {
  const P0 = { x: 195, y: 360 };
  it('elastico quasi a riposo: il tiro non parte', () => {
    expect(puntoArrivo(P0, { x: 0, y: 13 }, 300)).toBeNull();
  });
  it('direzione opposta al tiro, distanza proporzionale alla forza', () => {
    expect(puntoArrivo(P0, { x: 0, y: 75 }, 300)).toEqual({ x: 195, y: 210 }); // metà forza → metà gittata, verso l'alto
    expect(puntoArrivo(P0, { x: 0, y: 150 }, 300)).toEqual({ x: 195, y: 60 });
  });
  it('oltre la forza piena non va più lontano', () => {
    expect(puntoArrivo(P0, { x: 0, y: 400 }, 300)).toEqual({ x: 195, y: 60 });
  });
  it('gittata massima: oltre × distanza dall\'angolo più lontano', () => {
    expect(gittataMassima(P0, [{ x0: 95, y0: 100, x1: 195, y1: 160 }])).toBeCloseTo(1.2 * Math.hypot(100, 260));
  });
});

describe('fionda: i tre cerchi', () => {
  const R = { x0: 100, y0: 100, x1: 300, y1: 180 }; // centro (200, 140), 200×80
  it('zone', () => {
    expect(zonaDi({ x: 200, y: 140 }, R)).toBe(3);
    expect(zonaDi({ x: 200 + 0.2 * 200, y: 140 }, R)).toBe(2);   // fuori dal centro (raggio 25), dentro il mezzo (raggio 55)
    expect(zonaDi({ x: 290, y: 175 }, R)).toBe(1);               // nel recinto, fuori dai cerchi
    expect(zonaDi({ x: 310, y: 140 }, R)).toBe(0);
  });
  it('mai più degli agnellini del bersaglio', () => {
    expect(esitoTiro({ x: 200, y: 140 }, R, 1)).toBe(1);
    expect(esitoTiro({ x: 310, y: 140 }, R, 3)).toBe(0);
  });
  it('numeri sui cerchi già limitati', () => {
    expect(valoriCerchi(3)).toEqual([3, 2, 1]);
    expect(valoriCerchi(1)).toEqual([1, 1, 1]);
    expect(valoriCerchi(2)).toEqual([2, 2, 1]);
  });
});

describe('fionda: punto di scena per gli altri telefoni', () => {
  const R = { x0: 100, y0: 100, x1: 300, y1: 180 };
  it.each([3, 2, 1, 0])('esito %i: il punto cade nella sua zona, per ogni seq', (esito) => {
    for (let seq = 1; seq <= 40; seq++) expect(zonaDi(puntoDiScena(R, esito, seq), R)).toBe(esito);
  });
  it('stesso seq, stesso punto', () => {
    expect(puntoDiScena(R, 2, 17)).toEqual(puntoDiScena(R, 2, 17));
  });
});

describe('fionda: scia e volo', () => {
  it('la scia copre il primo 40% e ha 7 puntini', () => {
    const s = scia({ x: 0, y: 0 }, { x: 0, y: -100 });
    expect(s).toHaveLength(7);
    expect(Math.min(...s.map((p) => p.y))).toBeCloseTo(-40);
  });
  it('il volo parte e arriva nei punti giusti, più alto a metà', () => {
    const a = { x: 0, y: 0 }, b = { x: 0, y: -100 };
    expect(posizioneInVolo(a, b, 0)).toMatchObject({ x: 0, y: 0, alto: 0 });
    expect(posizioneInVolo(a, b, 1)).toMatchObject({ x: 0, y: -100, alto: 0 });
    expect(posizioneInVolo(a, b, 0.5).alto).toBeCloseTo(35);
  });
});
```

- [ ] **Passo 2: lanciare le prove e vederle fallire**

`npx vitest run client/src/scena/fionda/tiro.test.ts` → FAIL (modulo inesistente).

- [ ] **Passo 3: scrivere `tiro.ts` e `fionda.json`**

Le zone usano ellissi centrate al centro del recinto con semiassi `cerchi.centro × larghezza / 2` e `× altezza / 2` (idem per `mezzo`); 1 se dentro il rettangolo; 0 fuori. `valoriCerchi(m)` = `[min(3,m), min(2,m), min(1,m)]`. `puntoDiScena`: angolo e raggio ricavati in modo fisso da `seq` (per esempio `angolo = (seq × 137.5)°`, raggio al centro della corona della zona: 3 → metà del cerchio centrale; 2 → a metà tra centro e mezzo; 1 → dentro il rettangolo e fuori dal cerchio di mezzo, verso l'angolo dato dall'angolo; 0 → `fuori` oltre il bordo alto o basso secondo `seq` pari o dispari). `scia`: `puntiScia` punti equidistanti da `partenza` fino al `scia` del percorso, il primo escluso. `posizioneInVolo`: interpolazione lineare in pianta più `alto = altezzaArco × distanza × 4t(1−t)`.

- [ ] **Passo 4: lanciare le prove e vederle passare**

`npx vitest run client/src/scena/fionda/tiro.test.ts` → PASS.

---

### Compito 2: il recinto bersaglio che si ingrandisce sul posto

**File:**
- Modifica: `client/src/scena/camera.ts` (interfaccia `Camera` ~L45–71, `cambiaRecinto` ~L178–205)
- Prova: `client/src/scena/camera.test.ts` (se non esiste, crearlo sul modello delle prove di `teatro.test.ts` con il ciclo manuale)

**Interfacce:**
- Produce: `Camera.ingrandisciRecinto(chi: IdGiocatore | null): Promise<void>`: con un id ingrandisce il recinto di quell'avversario sul posto (lo stesso `cambiaRecinto(chi, 'vicino', 1.15)` di `inquadra`, **senza** spostare la camera e senza sfumare gli altri); con `null` lo riporta normale. Se c'è già un recinto ingrandito diverso, prima lo rimette normale.

- [ ] **Passo 1: prove**: `ingrandisciRecinto('g2')` → `palco.area('g2')` diventa più grande (larghezza `x1−x0` maggiore) e `camera.zoom()` resta 1; `ingrandisciRecinto(null)` → l'area torna alla misura di partenza (±0.5); durante `inquadra` di un altro, `ingrandisciRecinto(null)` non disturba l'inquadratura.
- [ ] **Passo 2:** lanciarle → FAIL.
- [ ] **Passo 3:** implementare riusando `cambiaRecinto`/`recintoVicino` privati.
- [ ] **Passo 4:** `npx vitest run client/src/scena/camera.test.ts` → PASS.

---

### Compito 3: la domanda e il gesto della fionda

**File:**
- Modifica: `client/src/scena/scelte/tipi.ts` (`Gesto` L…, `Domanda.testata` L70)
- Modifica: `client/src/scena/scelte/tavolo.ts` (`vuota` L17–35, `testataMira` L178–182, `avanzaTavolo` L206–235)
- Modifica: `client/src/scena/chiedi.test.ts` (default `testata: false` L45, prova L1738)
- Modifica: `client/src/scena/scelte/partite.test.ts` (L101–106, L163)
- Prova: `client/src/scena/scelte/tavolo.test.ts` (`describe('pubblica: Testata')` L430)

**Interfacce:**
- Consuma: niente dei compiti precedenti.
- Produce:
  - in `Gesto`: `| { tipo: 'fionda'; esito: number }`
  - in `Domanda`, al posto di `testata: boolean`: `fionda: { bersaglio: IdGiocatore; massimo: number } | null` (dati semplici: `Scena.tsx` confronta le domande con `JSON.stringify`)
  - `avanzaTavolo` con schermo `pubblica`/`testata` e gesto `fionda` → `{ tipo: 'mossa', azione }` dove `azione` è l'`esitoTestata` permesso con `esito = min(g.esito, massimo)`; nessuna azione permessa → nessun esito.

- [ ] **Passo 1: prove** (sostituiscono `'il riquadro di mira: testata acceso, niente gesti nella scena'`):
  - `'la mira: fionda con bersaglio e massimo, niente pecore né pulsanti'`: `d.fionda` = `{ bersaglio: 'g2', massimo: 2 }` (bersaglio da `vista.fase.dichiarazione.bersaglio`, massimo = esito più alto tra le azioni permesse), `d.pecore` vuoto, `d.scritta === T.testata.fionda.scritta('Bea')`.
  - `'gesto fionda: la mossa esitoTestata con l\'esito, limitato al massimo'`: gesto `{tipo:'fionda', esito: 3}` con massimo 2 → mossa `{ tipo:'esitoTestata', giocatore:'g1', esito: 2 }`.
  - `'fuori dalla mira il gesto fionda non fa niente'`: con la domanda della dichiarazione → nessun esito.
  - In `partite.test.ts`: dove oggi c'è `if (d.testata)`, mandare un gesto `fionda` con esito a caso tramite `avanza` (così la partita passa dalla stessa strada dei telefoni).
- [ ] **Passo 2:** `npx vitest run client/src/scena/scelte/tavolo.test.ts` → FAIL.
- [ ] **Passo 3:** implementare; aggiornare `vuota()`, i valori predefiniti in `chiedi.test.ts` (`fionda: null`) e la prova L1738 (passa `fionda: { bersaglio: 'g2', massimo: 3 }`). Aggiungere a `testi.ts`, sotto `testata`: `fionda: { scritta: (nome: string) => \`Tira indietro il Montone e lascialo andare verso l'Ovile di ${nome}\`, etichetta: 'Montone: trascina indietro e lascia andare. Frecce per mirare, Invio per lanciare.' }`.
- [ ] **Passo 4:** `npx vitest run client/src/scena/scelte/ client/src/scena/chiedi.test.ts` → PASS; `npm run typecheck` → 0 errori (ci saranno errori in `GiocoInScena.tsx` sul vecchio `domanda.testata`: correggerli qui sostituendo la condizione con `domanda?.fionda && !scenaPronta` solo per la riserva, il compito 6 rifinisce).

---

### Compito 4: la mira sul prato

**File:**
- Crea: `client/src/scena/fionda/mira.ts`
- Modifica: `client/src/scena/chiedi.ts` (`NON_PRATO` L55–56, `creaChiedi` L128, `applica` L700–714, `togli`, `riposiziona`)
- Modifica: `client/src/scena/teatro.ts` (creazione di `creaChiedi` L226; nuovo campo in `Contesto.regia`, vedi sotto)
- Modifica: `client/src/scena/contesto.ts` (tipo di `ctx.regia`)
- Modifica: `client/src/scena/scena.css` (stili `.fionda-*`)
- Prova: `client/src/scena/fionda/mira.test.ts`

**Interfacce:**
- Consuma: compito 1 (`puntoArrivo`, `gittataMassima`, `esitoTiro`, `valoriCerchi`, `scia`, `FIONDA`), compito 2 (`camera.ingrandisciRecinto`), compito 3 (`Domanda.fionda`, `Gesto` `fionda`).
- Produce:
  - `creaMira(ctx: Contesto, palco: Palco, camera: Camera): Mira` con `interface Mira { mostra(f: { bersaglio: IdGiocatore; massimo: number }, suGesto: (g: Gesto) => void): void; togli(): void; riposiziona(): void }`
  - `ctx.regia.tiroLocale: { bersaglio: IdGiocatore; esito: number; arrivo: Punto } | null` (scritto da `mira` al lancio, letto e azzerato dalla regia nel compito 5)
  - partenza del Montone: `PARTENZA_FIONDA = { x: 195, y: 360 }` in `mira.ts` (lo stesso `CENTRO_TAVOLO` di `ordini.ts:88`; esportarlo da lì e riusarlo, non duplicarlo una terza volta)

Comportamento di `mostra`:
- `camera.ingrandisciRecinto(bersaglio)`; disegna in `ctx.el.mondo` il Montone fermo alla partenza (stesso `<use href="#montone"/>` di `ordini.ts`, classe `fionda-montone`), l'elastico (`fionda-elastico`, una linea dal Montone alla partenza), i cerchi sul recinto (`fionda-cerchi`, SVG con due ellissi e tre numeri da `valoriCerchi(massimo)`, ricalcolati da `palco.area(bersaglio)`).
- In `ctx.el.ui` una zona di tocco sopra il Montone, `.zona-fionda` (aggiunta a `NON_PRATO`), `tabIndex=0`, `role="button"`, `aria-label = T.testata.fionda.etichetta`.
- Trascinando (pointerdown sulla zona, poi move/up sulla finestra, solo tasto 0): il vettore del tiro in unità del mondo = spostamento del dito diviso la scala della scena (`larghezza rettangolo .scena / W`; con misure a zero, come in jsdom, scala 1); Montone ed elastico seguono il dito, la scia (`fionda-scia`, `puntiScia` puntini) mostra `scia(partenza, arrivo)`.
- Al rilascio: `arrivo = puntoArrivo(...)` con `gittata = gittataMassima(partenza, aree di tutti gli avversari)`. Se `null`: Montone torna a riposo, nessun gesto. Altrimenti: `ctx.regia.tiroLocale = { bersaglio, esito, arrivo }`, si toglie la zona di tocco (niente secondo tiro), il Montone resta fermo dov'è, e si manda `{ tipo: 'fionda', esito: esitoTiro(arrivo, area, massimo) }`.
- Tastiera sulla zona: frecce sinistra/destra ruotano la direzione di 5°, su/giù cambiano la forza di un decimo di `tiroMassimo` (si parte da metà forza verso il centro del recinto), Invio/Spazio lancia (ignorare `e.repeat`). La scia si aggiorna a ogni freccia.
- `togli()`: rimuove tutti gli elementi `.fionda-*` e `.zona-fionda`, `camera.ingrandisciRecinto(null)`. `riposiziona()`: ridisegna i cerchi e riposiziona la zona.
- `chiedi.applica` chiama `mira.mostra` quando `d.fionda` c'è e `mira.togli` quando sparisce; `togli()` e `riposiziona()` di `chiedi` le inoltrano.

- [ ] **Passo 1: prove** (`mira.test.ts`, con il teatro di prova come in `chiedi.test.ts`):
  - `'mostra: Montone alla partenza, cerchi sul recinto del bersaglio con i numeri limitati, recinto ingrandito'` (con `massimo: 1` i numeri sono 1, 1, 1).
  - `'trascinare e lasciare: un solo gesto fionda con l\'esito della zona; tiroLocale ricordato'`: pointerdown sulla zona, pointermove di (0, +150) unità, pointerup → un gesto con esito uguale a `esitoTiro` del punto calcolato; un secondo pointerup non manda niente.
  - `'elastico quasi a riposo: nessun gesto, si può riprovare'`.
  - `'tasto destro: niente'`.
  - `'tastiera: frecce e Invio lanciano, Invio tenuto premuto non ripete'`.
  - `'togli: niente elementi della fionda, recinto tornato normale'` e `'riposiziona: i cerchi seguono il recinto'`.
  - `'un tocco sulla zona non è un tocco sul prato'` (nessun gesto `prato`).
- [ ] **Passo 2:** `npx vitest run client/src/scena/fionda/mira.test.ts` → FAIL.
- [ ] **Passo 3:** implementare.
- [ ] **Passo 4:** `npx vitest run client/src/scena/fionda/ client/src/scena/chiedi.test.ts client/src/scena/teatro.test.ts` → PASS.

---

### Compito 5: il volo ad arco nella regia

**File:**
- Modifica: `client/src/scena/regia/copione.ts` (battuta `testata` L29, produzione L231–233)
- Modifica: `client/src/scena/regia/regista.ts` (chiamata L152–153)
- Modifica: `client/src/scena/ordini.ts` (`Ordini.testata` L56, implementazione L372–402)
- Modifica: `client/src/scena/regia/durate.json` (`testata`)
- Prova: `client/src/scena/regia/copione.test.ts`, `client/src/scena/regia/durate.test.ts`, `client/src/scena/ordini.test.ts` (o `teatro.test.ts` dove oggi si provano gli ordini), `client/src/scena/meteo/meteo.test.ts` L87

**Interfacce:**
- Consuma: compito 1 (`puntoDiScena`, `posizioneInVolo`, `FIONDA`), compito 4 (`ctx.regia.tiroLocale`, `CENTRO_TAVOLO` esportato).
- Produce:
  - battuta: `{ tipo: 'testata'; chi: IdGiocatore; bersaglio: IdGiocatore; quanti: number; seq: number; attesa: Attesa }` (`seq` dall'evento `testata`)
  - `Ordini.testata(chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number, seq = 0): Promise<void>`

Comportamento del nuovo `ordini.testata`:
- Punto d'arrivo: se `ctx.regia.tiroLocale` ha lo stesso `bersaglio` e lo stesso esito (`quanti`), quello; altrimenti `puntoDiScena(area, quanti, seq)`. In ogni caso azzera `tiroLocale`. Toglie il Montone fermo della mira, se c'è (`.fionda-montone`).
- Il Montone (stesso elemento `.abs.montone` di oggi, in `ELEMENTI_ORDINI`) parte da `CENTRO_TAVOLO`, vola con `posizioneInVolo` (scala dalla profondità di `palco.profondita(y)`, più grande a metà volo) in circa 800 ms con un "beee" alla partenza.
- Esito > 0: all'arrivo come oggi (`tonfo`, `reagisci(bersaglio,'paura')`, scossa del mondo 260 ms, `branco()?.sposta(quanti, bersaglio, 'gregge', 'vola')`), poi rimbalza ed esce di lato.
- Esito 0: atterra fuori dal recinto con un `tonfo` più leggero, niente paura né scossa, si scuote ed esce.
- `durate.json`: aggiornare `testata` al nuovo valore misurato (deve stare tra la durata misurata e il doppio, multiplo di 100).

- [ ] **Passo 1: prove**:
  - `copione.test.ts`: `'Testata: la battuta porta il seq dell\'evento'`.
  - ordini: `'il Montone vola dalla tovaglia al punto di scena della zona del risultato'` (per 3 e per 0: l'ultima posizione dell'animazione del volo cade nella zona giusta di `zonaDi`).
  - ordini: `'su chi tira usa il tiro ricordato e poi lo azzera'` e `'tiro ricordato per un altro bersaglio o un altro esito: punto di scena'`.
  - `meteo.test.ts` L87: resta vera (gli agnellini del bersaglio volano verso il gregge); aggiornare solo se cambia il nome o l'ordine delle chiamate.
  - `durate.test.ts`: le prove esistenti con il nuovo `MISURE.testata: (t) => finoAllaFine(t, t.ordini.testata('g1', 'g2', 2, 5))`.
- [ ] **Passo 2:** lanciarle → FAIL.
- [ ] **Passo 3:** implementare; aggiornare `durate.json`.
- [ ] **Passo 4:** `npx vitest run client/src/scena/regia/ client/src/scena/ordini.test.ts client/src/scena/meteo/meteo.test.ts` → PASS (se `ordini.test.ts` non esiste, il file delle prove scelto al passo 1).

---

### Compito 6: il gioco usa la fionda; testi, prove dei telefoni, note

**File:**
- Modifica: `client/src/partita/GiocoInScena.tsx` (L18 import, L264–269 riquadro)
- Modifica: `client/src/testi.ts` (`T.prova.consigli.testata` L55, `REGOLE` L502)
- Modifica: `client/src/App.test.tsx` (aiuto `tiraTestata` L197 e prove L880, L1386), `client/src/remoto/Stanza.test.tsx` (aiuto `tiraTestata` L273, prove L895, L911), `client/src/partita/Testata.test.ts` (solo se cambia il CSS del riquadro)
- Modifica: `bozze/da-fare.md` (voce "Testata a fionda"), `bozze/passaggio-di-consegne.md` (due righe sulla fionda), `CLAUDE.md` (cartella `client/src/scena/fionda/` nella struttura)

**Interfacce:**
- Consuma: compiti 3–5.

Cosa cambia:
- `GiocoInScena`: con la scena caricata la Testata è una domanda della scena come le altre; il `riquadro-testata` non si mostra più. Il componente `Testata` resta importato solo dove serve alla riserva (`Partita.tsx`, `Stanza.tsx`); se `GiocoInScena` non lo usa più, togliere l'import e lo stato `spazioAlto` solo se non serve ad altro.
- Testi:
  - `T.prova.consigli.testata`: `'Tira indietro il Montone e lascialo andare verso il recinto: più sei vicina al centro dei cerchi, più agnellini cadono.'`
  - `REGOLE`, Dado del Pastore: `'Testata del Montone (2 facce): scegli un avversario, tira indietro il Montone come una fionda e lascialo andare verso il suo Ovile. Centro dei cerchi 3 agnellini, anello di mezzo 2, bordo del recinto 1, fuori nessuno (mai più di quanti ne ha).'`
- Prove dei telefoni: i due aiuti `tiraTestata` diventano un trascinamento sulla `.zona-fionda` (pointerdown, pointermove di +150 in basso, pointerup) e l'attesa del volo; le prove sul riquadro sopra la scena (`App.test.tsx` L880) diventano `'nel tiro del montone la mira è sul prato: niente riquadro sopra la scena, zona della fionda presente'`; quelle a tutta altezza nel cassetto (L1386) restano per la riserva.
- Note: `da-fare.md` spunta la fionda con il rimando al progetto e al piano; `passaggio-di-consegne.md` e `CLAUDE.md` citano `client/src/scena/fionda/` (calcolo puro in `tiro.ts`, mira in `mira.ts`, numeri in `fionda.json`).

- [ ] **Passo 1: prove**: aggiornare le prove elencate; aggiungere in `Stanza.test.tsx` `'Testata a fionda: chi tira manda un solo esito; gli altri telefoni vedono il volo e gli agnellini cadere'`.
- [ ] **Passo 2:** lanciarle → FAIL dove si aspetta ancora il riquadro.
- [ ] **Passo 3:** implementare.
- [ ] **Passo 4:** `npx vitest run client/src/App.test.tsx client/src/remoto/Stanza.test.tsx client/src/partita/ client/src/prova/ client/src/testi.test.ts` → PASS; `npm run typecheck` → 0 errori.
- [ ] **Passo 5: controllo a occhio nel browser** (anteprima "gioco", 375×812): partita di prova fino alla Testata; il recinto si ingrandisce, i cerchi si leggono, la scia sale, il Montone vola e gli agnellini cadono; riprovare un tiro a vuoto e uno con la tastiera. Foto da mostrare all'utente.
