# Scena nel gioco, pezzo 3: le scelte dentro la scena — piano di lavoro

> **Per chi esegue:** SOTTO-SKILL OBBLIGATORIA: superpowers:subagent-driven-development (o superpowers:executing-plans), compito per compito. I passi usano le caselle (`- [ ]`).

**Obiettivo:** nella partita su un dispositivo e nella prova si gioca solo toccando la scena: carte, bersagli, risposte, dado, furto e "Continua". I pannelli del cassetto restano solo come riserva se la scena non si carica.

**Architettura:**
- una parte **pura** (`client/src/scena/scelte/`) prepara "la domanda di adesso" dalle mosse permesse e trasforma i gesti in mosse del motore;
- il **teatro** mostra la domanda (pecore illuminate, pulsanti, carte sollevate, carte grandi, agnellini alzati, nuvoletta del pensiero) e restituisce i gesti, senza conoscere le regole;
- **`Partita`** fa da ponte: calcola la domanda a scena libera, tiene la scelta a metà, manda la mossa alla sessione.

**Tecnologie:** TypeScript, React 19, Vitest con jsdom.

**Progetto:** `bozze/scena-gioco-3-progetto.md` (approvato dall'utente il 19 ottobre). Regole dei pannelli di oggi da spostare: `client/src/partita/pannelli.tsx`. Bozza di riferimento per i gesti della mano: `bozze/scena/scena.src.html`, righe 1842–1895 e 2666–2669.

## Vincoli globali

- **Niente commit né push** senza richiesta dell'utente.
- In Bash: `export PATH="$PWD/.tools/bin:$PATH"`. Niente installazioni né server di sviluppo da Bash.
- Nomi, tipi e commenti in italiano. Tutti i testi visibili in `client/src/testi.ts`; si riusano i testi dei pannelli quando il senso è lo stesso, i nuovi vanno in `T.scena.scelte`.
- Il motore (`engine/`) non si tocca. Le stanze (`client/src/remoto/`, `sync/`) non si toccano. I pannelli (`pannelli.tsx`, `Testata.tsx`) restano com'erano: servono alle stanze e alla riserva.
- Regole del teatro: tempo della scena da `ctx.orologio` (`{ decorativo: true }` per ciò che non è evento); i gesti usano tempo vero, come la mano di oggi; API del browser da `piattaforma`; niente `id` nel DOM; CSS sotto `.teatro`; "Riduci movimento" (`ctx.ridotto`) senza saltelli.
- **Solo mosse permesse:** ogni mossa prodotta è uno degli oggetti di `azioniPossibili` (stesso oggetto, non ricostruito), tranne `scegliTrovata`, `completaEffetto`, `concludiConsolazione` e `dichiaraDado` con furto, che si confrontano per contenuto con una delle mosse permesse prima di mandarle (come fanno oggi i pannelli).
- **Regola anti-sbirciata:** carte della mano toccabili solo se la fotografia ha la mano scoperta; nelle domande pubbliche (dado, furto, Testata, "Chi risponde?", "Continua") la mano non è mai toccabile.
- **Nessuna domanda durante la recita** (pezzo 2) né sopra "Passa il dispositivo".
- **Comandi:** `npx vitest run <file>`, `npm test`, `npm run typecheck`, `npm run build`. I file di prova col DOM iniziano con `// @vitest-environment jsdom`.

## Punti da controllare in revisione

1. **Doppio gesto, doppia mossa:** due tocchi veloci su "Gioca", o trascinamento più tocco, mandano una mossa sola: dopo un esito "mossa" `Partita` ignora i gesti finché la domanda non cambia. → prova nel compito 6.
2. **Domanda tolta a metà gesto:** la scena diventa occupata (mossa di un bot) mentre una carta è trascinata o sollevata: il trascinamento si annulla, nessuna mossa parte, la carta torna nel ventaglio. → prova nel compito 3.
3. **Mosse permesse cambiate sotto le dita** (prova: un bot muove mentre l'umano ha sollevato le Gemelle): la chiave della domanda cambia, la scelta a metà riparte vuota, nessuna mossa illegale. → prova nel compito 6.
4. **Zone di tocco che si sovrappongono** con 4 giocatori (recinti stretti): le zone di due giocatori diversi non si intersecano; un tocco tra due recinti non sceglie nessuno. → prova nel compito 4.
5. **Mano coperta con una domanda privata** (passaggio appena fatto, `mano` ancora null per un fotogramma): nessuna carta toccabile finché la fotografia non ha la mano. → prova nel compito 4.

---

## Mappa dei file

```
client/src/scena/scelte/tipi.ts         Gesto, Domanda, Scelta, Momento, Esito, Pensiero (tipi condivisi)
client/src/scena/scelte/domanda.ts      domandaDi, avanza, sceltaVuota, chiaveDi (smista per momento)
client/src/scena/scelte/tavolo.ts       momenti senza mano: Continua, chi risponde, dado, furto, Testata
client/src/scena/scelte/carte.ts        momenti con la mano: carta del round, effetto, richiesta, reazione, punteggio,
                                        belato finale, salvataggio, consolazione
client/src/scena/mano.ts                + modo "comandato" (toccabili, più carte sollevate, trascinata sulla tovaglia)
client/src/scena/servizi/consigli.ts    + terzo consiglio "trascina"
client/src/scena/chiedi.ts              mostra la domanda nel teatro: zone di tocco, pulsanti, dado, Guai, carte grandi e al
                                        centro, agnellini del furto, nuvoletta del pensiero
client/src/scena/teatro.ts              + chiedi / smettiDiChiedere / pensa
client/src/scena/scheletro.ts           aria-hidden solo sul mondo disegnato (l'interfaccia resta leggibile)
client/src/scena/Scena.tsx              + domanda, suGesto, pensiero, onPronto
client/src/partita/ScenaCaricata.tsx    + le stesse props
client/src/partita/Partita.tsx          domanda al posto del cassetto, scritta nella striscia, Testata sopra la scena, riserva
client/src/prova/PartitaProva.tsx       consigli e fine prova come pensiero
client/src/testi.ts                     T.scena.scelte, T.scena.consigli.trascina
```

---

### Compito 1: Le domande, i tipi e i momenti senza mano

**File:**
- Creare: `client/src/scena/scelte/tipi.ts`, `client/src/scena/scelte/domanda.ts`, `client/src/scena/scelte/tavolo.ts`
- Prova: `client/src/scena/scelte/tavolo.test.ts`
- Modificare: `client/src/testi.ts`

**Interfacce:**
- Consuma: `Azione`, `IdCarta`, `IdGiocatore`, `Vista` da `engine/src`; `Scena` da `client/src/partita/regia.ts`; `ScenaProva` da `client/src/prova/regiaProva.ts`; `descriviVoce`, `nome`, `nomi` da `client/src/partita/descrizioni.ts`; `T`.
- Produce (`tipi.ts`):
  ```ts
  export type IdPulsante = 'gioca' | 'conferma' | 'continua' | 'nessuno' | 'passo' | 'annulla' | 'attiva' | 'rinuncia' | 'prendiGuaio' | 'nonScartare' | 'fatto';
  export type Gesto =
    | { tipo: 'carta'; carta: IdCarta }            // tocco su una carta della mano
    | { tipo: 'trascinata'; carta: IdCarta }       // carta rilasciata sulla tovaglia
    | { tipo: 'pecora'; chi: IdGiocatore }         // pecora, recinto o targa
    | { tipo: 'agnellino'; chi: IdGiocatore }      // agnellino alzato nel furto (lo rimette giù)
    | { tipo: 'dado' }
    | { tipo: 'guaio'; carta: IdCarta }            // Guaio del proprio angolo
    | { tipo: 'grande'; carta: IdCarta }           // carta grande sopra la tovaglia
    | { tipo: 'pulsante'; id: IdPulsante };
  export interface PulsanteDomanda { id: IdPulsante; testo: string; attivo: boolean; secondario?: boolean; sottoLaCarta?: boolean }
  export interface Domanda {
    /** Stessa chiave = stessa domanda: la scelta a metà si conserva. */
    chiave: string;
    scritta: string;
    avvisi: string[];
    carte: IdCarta[];          // carte della mano che rispondono al tocco
    sollevate: IdCarta[];
    trascinabili: IdCarta[];   // si giocano trascinandole sulla tovaglia
    pecore: IdGiocatore[];     // illuminate e toccabili
    dado: boolean;
    guai: IdCarta[];           // Guai del proprio angolo toccabili
    grandi: IdCarta[];         // carte grandi da toccare (Guarda le prime 2)
    centro: IdCarta | null;    // carta al centro, solo da guardare
    furto: { presi: Partial<Record<IdGiocatore, number>> } | null;
    pulsanti: PulsanteDomanda[];
    /** Il riquadro di mira della Testata (Testata.tsx) sopra la scena. */
    testata: boolean;
  }
  export interface Scelta { chiave: string; carte: IdCarta[]; carta: IdCarta | null; furto: Record<IdGiocatore, number>; guaio: IdCarta | null }
  export type Esito = { tipo: 'mossa'; azione: Azione } | { tipo: 'risponde'; chi: IdGiocatore } | { tipo: 'indietro' };
  export interface Momento {
    /** Vista di chi agisce (con la sua mano) per le schermate private; del tavolo per le altre. */
    vista: Vista;
    schermo: Scena | ScenaProva;
    azioni: Azione[];        // mosse permesse a chi agisce
    sistema: Azione[];       // mosse permesse al sistema (prosegui, scadenza)
    /** Dispositivo condiviso: "Annulla" torna a "Chi risponde?". Falso nella prova. */
    condiviso: boolean;
    /** La fotografia ha la mano scoperta (regola anti-sbirciata). */
    manoScoperta: boolean;
  }
  export interface Pensiero { titolo?: string; testo: string; pulsanti: Array<{ testo: string; secondario?: boolean; azione: () => void }> }
  ```
- Produce (`domanda.ts`):
  ```ts
  export function chiaveDi(m: Momento): string;           // schermo (tipo, giocatore, pannello/contesto, fase) + mosse permesse (JSON)
  export function sceltaVuota(chiave: string): Scelta;
  export function domandaDi(m: Momento, s: Scelta): Domanda | null;   // null: niente da chiedere (attesaBot, fine)
  export function avanza(m: Momento, s: Scelta, g: Gesto): { scelta: Scelta; esito: Esito | null };
  ```
  `domanda.ts` smista per momento verso `tavolo.ts` (questo compito) e `carte.ts` (compito 2; qui per i momenti con le carte `domandaDi` restituisce `null` e `avanza` non fa niente).
- **Momenti di questo compito** (regole da `pannelli.tsx`):
  - **`automatica`**: `centro` = Guaio del round nella fase `guaio`; scritta = titolo di `PannelloAutomatico` (per `guaio_al_peggiore` il suo messaggio); pulsante `continua` → mossa `prosegui` presa da `sistema`.
  - **`domanda`** (chi risponde): scritta = `descriviVoce` della cima della pila (se c'è) + `T.scena.scelte.chiRisponde` (reazione) o `T.scena.scelte.chiPunteggio` (punteggio); `pecore` = candidati; gesto `pecora` → esito `risponde`; pulsante `nessuno` → mossa `{ tipo: 'scadenza' }`.
  - **`pubblica` `lancio`**: `dado: true`, scritta `T.dado.tocca(nome)` (più `T.dado.pari` se più lanciatori); gesto `dado` → la mossa `lanciaDado`.
  - **`pubblica` `dichiarazione`, furto**: `pecore` = avversari con massimo > 0 (massimo per avversario = il più alto tra le mosse permesse, come `PannelloDichiarazione`); gesto `pecora` → +1 se sotto il massimo e sotto il totale; gesto `agnellino` → −1; scritta `T.scena.scelte.rubaAncora(n)` (n = totale da avversari − presi); `conferma` attivo solo se i presi coincidono con una mossa permessa → quella mossa; `annulla` azzera i presi.
  - **`pubblica` `dichiarazione`, Testata**: `pecore` = bersagli permessi; gesto `pecora` → quella mossa; scritta `T.dado.testataTitolo`.
  - **`pubblica` `testata`**: `testata: true`, nessun gesto (la mossa la manda `Testata.tsx`).
  - **`attesaBot`** e **`fine`**: `null`.
  - Ogni domanda di questo compito ha `carte`, `sollevate`, `trascinabili` vuote (mano mai toccabile).
- **Testi nuovi** in `T.scena.scelte`: `chiRisponde: 'Qualcuno risponde? Tocca la tua pecora'`, `chiPunteggio: 'Qualcuno gioca un Belato? Tocca la tua pecora'`, `rubaAncora: (n) => (n > 0 ? \`Ruba ancora ${n}\` : 'Tocca Conferma')`, `gioca: (totale) => \`Gioca · ${totale}\``, `scarta: (n) => \`Scarta (${n})\``, `passo: 'Passo'`, `fatto: 'Fatto'`. Gli altri pulsanti riusano `T.azioni` (`continua`, `conferma`, `nessuno`, `annulla`, `attiva`, `rinuncia`, `prendiGuaio`, `nonScartare`).

- [ ] **Passo 1: scrivere le prove che falliscono** (`tavolo.test.ts`, partite vere da `engine/test/aiuti.ts` come `copione.test.ts`):
  - per ogni momento sopra: la domanda attesa (scritta, `pecore`, `dado`, `centro`, pulsanti e se sono attivi, mano vuota);
  - furto: con massimi 2 e 1 e totale 2, i tocchi `pecora(g2)`, `pecora(g2)`, `pecora(g2)` lasciano 2 a g2 (il terzo non fa niente); `agnellino(g2)` torna a 1; `conferma` è attivo solo su una divisione permessa e dà **quella** mossa (`toBe` sull'oggetto di `azioni`); `annulla` azzera;
  - Testata bersaglio, dado, "Chi risponde?" (`risponde`, `nessuno` → `scadenza`), `continua` → `prosegui`;
  - un gesto su un elemento non illuminato (pecora non candidata, dado quando non serve) → nessun esito, scelta invariata;
  - `chiaveDi` cambia se cambiano le mosse permesse, non cambia ricalcolando lo stesso momento.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere `tipi.ts`, `domanda.ts`, `tavolo.ts` e i testi.**
- [ ] **Passo 4: lanciarle, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 2: Le domande con la mano

**File:**
- Creare: `client/src/scena/scelte/carte.ts`
- Prove: `client/src/scena/scelte/carte.test.ts`, `client/src/scena/scelte/partite.test.ts`
- Modificare: `client/src/scena/scelte/domanda.ts` (smistamento verso `carte.ts`)

**Interfacce:**
- Consuma: i tipi e `domandaDi`/`avanza` del compito 1; `nomeCarta`, `valoreCarta`, `nome` da `descrizioni.ts`; `tipiPericolosi`, `mancanti` (gli stessi calcoli di `Avvisi` in `componenti.tsx`: spostarli in una funzione pura `avvisiDi(v, id): string[]` in `descrizioni.ts`, usata anche da `Avvisi`).
- Produce: i casi `privata` di `domandaDi` e `avanza`. Con `manoScoperta` falso: `carte`, `sollevate`, `trascinabili` vuote e nessun gesto `carta`/`trascinata` produce esiti.
- **Momenti** (regole da `pannelli.tsx`):
  - **`scelta`**: `carte` = carte di almeno una opzione `scegliTrovata`; tocco = logica di `PannelloScelta` (deseleziona, coppia di Gemelle se permessa, altrimenti sola); `gioca` (sotto la carta) attivo se le sollevate sono un'opzione, testo `T.scena.scelte.gioca(totale)`; `trascinata(c)`: se le sollevate contengono `c` e sono un'opzione → quella, altrimenti `[c]` se è un'opzione, altrimenti niente; avvisi da `avvisiDi`; scritta `T.scelta.titolo(nome)` (+ `T.scelta.gemelleInsieme` se ci sono Gemelle).
  - **`effetto`**: `centro` = carta della voce; pulsanti `attiva`, `rinuncia`; se le mosse `attivaEffetto` hanno bersaglio, `attiva` accende `pecore` = bersagli (`scelta.carta` = carta della voce) e compare `annulla`; gesto `pecora` → quella mossa.
  - **`richiesta`**: `guarda_due` → `grandi` = `r.carte`, gesto `grande(c)` → `completaEffetto [c]`; `scarta_e_somma` → una carta sola, `conferma` testo `T.azioni.scarta` + nome; `scarta_fino_a_tre` → fino a 3 carte, pulsante `T.scena.scelte.scarta(n)` o `nonScartare` con 0. Mossa solo se il contenuto coincide con un'opzione.
  - **`reazione`**: `carte` = Beee-NO! giocabili; tocco solleva, `gioca` o `trascinata` → la `giocaBelato`; `passo` → la `passa`; `annulla` (solo `condiviso`) → esito `indietro`.
  - **`punteggio`**: `carte` = Belati giocabili; con una carta sollevata: se ha una sola mossa senza bersaglio, `gioca`/`trascinata` la mandano; se ha bersagli, `gioca` accende `pecore` = bersagli di quella carta e il gesto `pecora` manda la mossa; `passo`; `annulla` (solo `condiviso`) → `indietro`.
  - **`belato_finale`**: come `scelta` con una sola carta → `sceltaFinale`.
  - **`salvataggio`**: `centro` = Guaio del round; avvisi; `carte` = Belati giocabili; come `punteggio` (devia → `pecore`); `prendiGuaio` → la `passa`.
  - **`consolazione`**: `guai` = Guai curabili (`giocaBelato` con `guaio`); gesto `guaio(g)`: se c'è una sola cura per `g` la manda, altrimenti `scelta.guaio = g` e `carte` = carte di cura per `g` (tocco + `gioca`); senza Guaio scelto `carte` = carte scartabili (`concludiConsolazione` con `scarta`), una sola alla volta, e il pulsante `fatto` ha testo `T.azioni.scarta` + nome o `T.azioni.nonScartare` e manda `concludiConsolazione`.
  - Le carte già giocabili e trascinabili sono le stesse (`trascinabili` = carte che da sole completano una mossa).

- [ ] **Passo 1: scrivere le prove che falliscono.**
  - `carte.test.ts`: per ogni momento, domanda attesa e ogni percorso di `avanza` (Gemelle: tocco su una, sulla gemella, di nuovo su una; trascinata di una sola e della coppia; bersagli; scarti fino a tre con il quarto tocco ignorato; consolazione con una e con due cure per lo stesso Guaio; `annulla`/`indietro` solo se `condiviso`); con `manoScoperta: false` nessuna carta toccabile e nessun esito da `carta`/`trascinata`.
  - `partite.test.ts` (tetto 60 s): 30 partite (10 per 2, 3, 4 giocatori, semi fissi) giocate dal motore scegliendo **a caso tra gli elementi della domanda** (carte, pecore, dado, Guai, carte grandi, pulsanti attivi; per `testata` si manda un `esitoTestata` permesso): ogni esito "mossa" è accettato dal motore (`tentaApplica` ok), ogni domanda ha almeno un elemento attivo, ogni partita finisce entro 3000 gesti.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere `carte.ts`, `avvisiDi` e lo smistamento.**
- [ ] **Passo 4: lanciare le prove di `client/src/scena/scelte` e `client/src/partita`, più `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 3: La mano comandata

**File:**
- Modificare: `client/src/scena/mano.ts`, `client/src/scena/servizi/consigli.ts`, `client/src/scena/teatro.ts` (consiglio 3), `client/src/testi.ts`
- Prova: `client/src/scena/mano.test.ts` (esiste già: aggiungere le prove nuove, le vecchie restano verdi)

**Interfacce:**
- Produce in `Mano`:
  ```ts
  /** Con una domanda la mano non decide da sola: i tocchi vanno a `suTocco`, le carte sollevate le dice chi comanda. null: modo libero di oggi. */
  comanda(c: { toccabili: IdCarta[]; sollevate: IdCarta[]; trascinabili: IdCarta[]; suTocco(id: IdCarta): void; suTrascinata(id: IdCarta): void } | null): void;
  /** Dove stanno le carte sollevate (coordinate della scena): per il pulsante "Gioca". null se nessuna. */
  sollevateIn(): { x: number; y: number } | null;
  ```
- **Regole:**
  - in modo comandato il tocco non solleva da solo: chiama `suTocco`; le carte non toccabili hanno la classe `spenta` e non rispondono al tocco (si leggono ancora tenendole premute);
  - carte sollevate: 1 al centro come oggi (195, 470, k 0,66); 2 affiancate (x 195 ± 62, y 480, k 0,5); 3 (x 195 − 110, 195, 195 + 110, y 490, k 0,42);
  - trascinamento: solo le `trascinabili` diventano `trascinata` (le altre tornano subito); rilascio con il dito sopra la linea y = 640 della scena (y < 640, nelle coordinate della scena come il punto del dito di oggi) → `suTrascinata`, altrimenti torna nel ventaglio. Nel modo libero il trascinamento resta com'è oggi (torna sempre);
  - `comanda(null)` o una `comanda` nuova durante un trascinamento lo annulla: la carta torna nel ventaglio, nessun `suTrascinata` (punto di revisione 2);
  - consiglio 3: `CONSIGLI = [solleva, leggi, trascina]`, testo `T.scena.consigli.trascina = 'Trascina una carta sulla tovaglia per giocarla'`; si supera con la prima carta giocata trascinandola (`nascondi(3)`), o dopo 7 s come oggi l'ultimo.

- [ ] **Passo 1: scrivere le prove che falliscono** (`mano.test.ts`): tocco in modo comandato → `suTocco`, nessun sollevamento da solo; `sollevate` di 1, 2, 3 carte nelle pose sopra; carta non toccabile: tocco senza effetto, tenuta apre la lettura; trascinata di una trascinabile rilasciata sopra y 640 → `suTrascinata`, sotto → niente; trascinata di una non trascinabile → niente; `comanda(null)` a metà trascinamento → niente e carta nel ventaglio; modo libero invariato (le prove di oggi restano verdi); consigli: terzo consiglio dopo il secondo.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere le modifiche.**
- [ ] **Passo 4: lanciare le prove di `client/src/scena`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 4: Il teatro chiede (zone, pulsanti, dado, attesa)

**File:**
- Creare: `client/src/scena/chiedi.ts`
- Modificare: `client/src/scena/teatro.ts`, `client/src/scena/scheletro.ts`, `client/src/scena/scena.css`
- Prova: `client/src/scena/chiedi.test.ts`

**Interfacce:**
- Consuma: `Domanda`, `Gesto`, `Pensiero` (compito 1); `Mano.comanda`, `sollevateIn` (compito 3); `Palco`, `camera.inScenaDaMondo`, `Disposizione`.
- Produce in `Teatro`:
  ```ts
  /** Mostra la domanda appena la scena è libera (subito, se lo è) e la toglie mentre recita; una domanda nuova sostituisce la vecchia. */
  chiedi(d: Domanda, suGesto: (g: Gesto) => void): void;
  smettiDiChiedere(): void;
  /** La nuvoletta del pensiero della pecora in basso (null la toglie); anche lei aspetta la scena libera. */
  pensa(p: Pensiero | null): void;
  ```
- `creaChiedi(ctx, palco, mano, camera)` in `chiedi.ts` restituisce `{ mostra(d, suGesto), togli(), riposiziona(), pensa(p), distruggi() }`; il teatro lo usa così:
  - `chiedi` memorizza; mostra solo se `!regista.occupato()`; un ascoltatore interno di `occupato` toglie (true) e rimostra (false) l'ultima domanda e il pensiero;
  - dopo una ricostruzione del tavolo e dopo `adatta`, `riposiziona()` rimette zone e pulsanti (punto 5 del progetto, "Ricostruzione").
- **Cosa mostra in questo compito:**
  - **zone di tocco** per `pecore`: un `div.zona` per giocatore nello strato `.ui`, posizionato con `camera.inScenaDaMondo` sul rettangolo che contiene recinto, pecora e targa del posto (dalla `Disposizione`), ritagliato perché non tocchi quello di un altro giocatore (punto di revisione 4); `role="button"`, `tabindex="0"`, `aria-label` = nome; Invio e Spazio come il tocco; classe `illuminata` su `.pecora[data-chi]` e `.recinto[data-chi]` (saltello in CSS, niente con `ctx.ridotto`);
  - **dado**: con `dado: true` `.dado-pos` illuminato, `tabindex="0"`, tocco/Invio → gesto `dado`;
  - **pulsanti**: veri `<button>` nello strato `.ui`; quelli con `sottoLaCarta` sotto `mano.sollevateIn()` (o nascosti se nessuna carta è sollevata), gli altri in fila sopra il ventaglio, centrati;
  - **mano**: `mano.comanda({ toccabili: d.carte, sollevate: d.sollevate, trascinabili: d.trascinabili, … })` (e `comanda(null)` quando la domanda si toglie);
  - la tovaglia con una domanda: il tocco sul prato non salta niente (la scena è libera) e abbassa le carte come oggi.
- **Accessibilità:** `aria-hidden="true"` passa da `.teatro` (in `Scena.tsx`, compito 6) alla sola `.camera` (qui in `scheletro.ts`); lo strato `.ui` resta leggibile.

- [ ] **Passo 1: scrivere le prove che falliscono** (`chiedi.test.ts`, jsdom, ciclo manuale, `ambiente: false`, `giochi: false`, fotografie con 2, 3, 4 giocatori):
  - `chiedi` con `pecore` → zone e `illuminata` solo per quelle; tocco e Invio su una zona → `suGesto({ tipo: 'pecora', chi })`; tocco fuori dalle zone → niente;
  - con 4 giocatori nessuna coppia di zone si interseca (punto 4);
  - `dado: true` → tocco su `.dado-pos` → `{ tipo: 'dado' }`; con `dado: false` niente;
  - pulsanti: testo, `disabled` se non attivi, clic → `{ tipo: 'pulsante', id }`;
  - con la scena occupata (`recita` di un Pascolo) `chiedi` non mostra niente; a recita finita compare; una nuova recita la toglie e poi la rimostra;
  - `smettiDiChiedere` toglie tutto e libera la mano;
  - fotografia con `mano: null` e domanda con `carte` non vuote → nessuna carta toccabile (punto 5);
  - ricostruzione (fotografia con un altro giocatore in basso) con domanda in corso → zone rimesse sui posti nuovi.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere `chiedi.ts` e le aggiunte a teatro, scheletro e CSS.**
- [ ] **Passo 4: lanciare le prove di `client/src/scena` e `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 5: Il teatro chiede (carte grandi, furto, Guai, pensiero)

**File:**
- Modificare: `client/src/scena/chiedi.ts`, `client/src/scena/scena.css`
- Prova: `client/src/scena/chiedi.test.ts`

**Interfacce:** quelle del compito 4.

- **Cosa si aggiunge:**
  - **`centro`**: la carta grande al centro della tovaglia (come `volaCarta` ferma, `cartaSVG`), solo da guardare; tenendola premuta si legge;
  - **`grandi`**: due (o più) carte grandi affiancate sopra la tovaglia, toccabili (`role="button"`, nome della carta) → gesto `grande`; tenuta → lettura;
  - **`guai`**: le carte dell'angolo della pecora in basso (`.mini[data-chi]` di `postazioni.ts`) illuminate e toccabili → gesto `guaio`; oggi il tocco su una mini apre la lettura: con una domanda che la vuole, il tocco è il gesto e la tenuta legge;
  - **`furto`**: per ogni avversario, `presi[chi]` agnellini del suo recinto alzati sopra la staccionata (decorazione: non cambiano recinto, il branco li rimette a posto quando la domanda si toglie); tocco su un agnellino alzato → gesto `agnellino`; tocco sulla zona → `pecora` come nel compito 4;
  - **`pensa`**: nuvoletta a pallini (tre pallini che salgono dalla pecora in basso, poi la nuvola) sopra il ventaglio, con titolo, testo e pulsanti (`role="status"`); i pulsanti chiamano `azione`.

- [ ] **Passo 1: scrivere le prove che falliscono** (`chiedi.test.ts`):
  - `centro` mostra la carta e non manda gesti;
  - `grandi` → due carte toccabili → `grande` con la carta giusta; tenuta → lettura aperta;
  - `guai` → mini illuminate → `guaio`; senza domanda la mini apre la lettura come oggi;
  - `furto: { presi: { g2: 2 } }` → 2 agnellini alzati nel recinto di g2; tocco su uno → `agnellino(g2)`; domanda tolta → nessun agnellino resta alzato e i conti del branco coincidono con la fotografia;
  - `pensa` → nuvoletta con testo e pulsanti; clic → `azione`; `pensa(null)` la toglie; con la scena occupata aspetta.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere le aggiunte.**
- [ ] **Passo 4: lanciare le prove di `client/src/scena` e `npm run typecheck`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 6: Il collegamento con il gioco

**File:**
- Modificare: `client/src/scena/Scena.tsx`, `client/src/partita/ScenaCaricata.tsx`, `client/src/partita/Partita.tsx`, `client/src/prova/PartitaProva.tsx`, `client/src/stile.css` (scritta nella striscia, riquadro della Testata)
- Prove: `client/src/App.test.tsx` (teatro finto e aiuti `passo`/`passoProva`), `client/src/scena/Scena.test.tsx`, `client/src/partita/ScenaCaricata.test.tsx`

**Interfacce:**
- Consuma: `chiaveDi`, `sceltaVuota`, `domandaDi`, `avanza` (compiti 1–2); `Teatro.chiedi`, `smettiDiChiedere`, `pensa` (compiti 4–5).
- Produce:
  - `Scena` e `ScenaCaricata` ricevono anche `domanda?: Domanda | null`, `suGesto?: (g: Gesto) => void`, `pensiero?: Pensiero | null`, `onPronto?: (pronto: boolean) => void`. `Scena` chiama `chiedi`/`smettiDiChiedere`/`pensa` in un effetto di layout quando cambiano (confronto per contenuto della domanda, così un rendering uguale non la rimostra); `onPronto(true)` dopo il montaggio del teatro, `onPronto(false)` smontando. `aria-hidden` non sta più su `.teatro`.
  - **`Partita`:**
    - stato `scenaPronta` (da `onPronto`): con la scena pronta niente cassetto; senza (caricamento o errore) il cassetto con i pannelli di oggi, invariato;
    - `momento`: dallo schermo di adesso (`sc`), con `vista` = `sessione.vista(sc.giocatore)` per le schermate private, altrimenti il tavolo; `azioni` = `sessione.azioni(giocatore)`; `sistema` = `sessione.azioni('sistema')`; `condiviso` = `!p.umano`; `manoScoperta` = `scoperta` di oggi;
    - stato `scelta`: se `chiaveDi(momento)` cambia, riparte da `sceltaVuota` (punto di revisione 3); la domanda si passa alla scena solo con `conAzioni` (scena libera, niente passaggio, niente fine);
    - `suGesto`: `avanza`; esito `mossa` → `invia` e da lì gesti ignorati finché la chiave non cambia (punto 1); `risponde` → `setScelto(chi)`; `indietro` → `setScelto(null)`;
    - la **scritta** della domanda (con gli avvisi e l'eventuale errore di `invia`) sta nella striscia `.testata-scena` al posto della `Cronaca`, con `role="status"`; un errore rimette la `scelta` vuota;
    - con `domanda.testata` monta `Testata` (stesse props di oggi) in un riquadro `.riquadro-testata` sopra la scena, sotto la striscia;
    - prop `testa` sostituita da `pensiero?: Pensiero | null`; con `sc.tipo === 'attesaBot'` e nessun pensiero dalla prova, il pensiero è `{ testo: T.prova.pensa(nome) , pulsanti: [] }`; senza scena pronta il pensiero si mostra nel riquadro di oggi (`.testa-scena`).
  - **`PartitaProva`:** consiglio → `{ titolo: T.prova.consiglioTitolo, testo, pulsanti: [{ testo: T.prova.hoCapito, azione }] }`; fine prova → `{ titolo, testo, pulsanti: [continua, home (secondario)] }`.
  - **Teatro finto di `App.test.tsx`:** registra `chiedi` (ultima domanda e `suGesto`), `smettiDiChiedere`, `pensa`; gli aiuti `passo()` e `passoProva()` giocano toccando la domanda (stesse preferenze di oggi: "Sono io", Continua, Nessuno, prima carta giocabile, primo bersaglio, conferma del furto, esito permesso per la Testata) invece dei pulsanti dei pannelli.

- [ ] **Passo 1: scrivere le prove che falliscono.**
  - `App.test.tsx`:
    - partite intere a 2, 3 e 4 giocatori e la prova fino a "Ora sai come si gioca!" e poi alla fine, giocate solo con i gesti: nessun `.cassetto` montato in tutta la partita;
    - doppio gesto: due `pulsante gioca` di fila → una sola mossa (punto 1);
    - prova: Gemelle sollevate, poi un bot muove e le mosse permesse cambiano → scelta vuota, nessuna mossa (punto 3);
    - nessuna domanda con "Passa il dispositivo" a schermo né mentre il finto è occupato; nessuna domanda con carte toccabili quando l'ultima fotografia ha `mano === null`;
    - "Chi risponde?" → tocco su una pecora → "Passa il dispositivo a …"; `annulla` dopo "Sono io" → di nuovo "Chi risponde?";
    - errore del motore (sessione finta che rifiuta) → scritta d'errore nella striscia, scelta vuota;
    - riserva: con `caricaScena` che fallisce, la partita si gioca con i pannelli di oggi (le prove dei pannelli di oggi passano a questo caso);
    - le prove di oggi che restano valide (anti-sbirciata, attese della regia, classifica dopo la festa) restano verdi, adattate ai gesti.
  - `Scena.test.tsx` (teatro vero): `domanda` passata → zone nella scena; cambio di domanda uguale per contenuto → nessun nuovo `chiedi`; `onPronto(true)` al montaggio e `false` smontando.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere le modifiche.**
- [ ] **Passo 4: `npm run typecheck`, `npm test` intero, `npm run build`.** Atteso: tutto verde.
- [ ] **Passo 5: registro.**

### Compito 7: Prove nel browser, documenti e revisione (controllore)

- [ ] **Passo 1: browser** (gioco in anteprima, 390×844, finestra visibile, pilota automatico che tocca la scena):
  - partite intere a 2, 3 e 4 giocatori e la prova fino alla fine, solo toccando la scena;
  - ogni momento della tabella del § 1 del progetto guardato a occhio (Gemelle, effetto con bersaglio, Guarda le prime 2, scarti, Beee-NO! con "Chi risponde?", Belati di punteggio, dado, furto, Testata, salvataggio, consolazione, Continua, nuvoletta della prova);
  - trascinare una carta sulla tovaglia; tenere premuta per leggere;
  - la scritta in alto non copre le targhe con 2, 3 e 4 giocatori;
  - tastiera: Tab e Invio arrivano alle pecore e ai pulsanti;
  - nessun errore in console; i 72 casi della pagina di sviluppo ancora verdi.
- [ ] **Passo 2: documenti.** `bozze/da-fare.md` (pezzo 3 fatto), `bozze/passaggio-di-consegne.md` (sezione "Scena nel gioco, pezzo 3"), `CLAUDE.md` (una riga per `client/src/scena/scelte/`).
- [ ] **Passo 3: revisione finale** (revisore separato, impegno alto) e stop di fase.

---

## Copertura del progetto

| Progetto | Compito |
|---|---|
| § 1 regole comuni (scritta, illuminazioni, lettura, pulsanti) | 1, 4, 6 |
| § 1 tabella, momenti senza mano (Continua, chi risponde, dado, furto, Testata) | 1, 4, 5 |
| § 1 tabella, momenti con la mano | 2, 3, 5 |
| Testata nel riquadro sopra la scena | 6 |
| consigli della prova e bot come pensiero | 5, 6 |
| consiglio "trascina" | 3 |
| § 2.1 le domande pure, solo mosse permesse | 1, 2 |
| § 2.2 la scena (chiedi, mano, tastiera, Riduci movimento, ricostruzione) | 3, 4, 5 |
| § 2.3 collegamento, errore, cassetto di riserva | 6 |
| § 3 casi particolari | 4, 5, 6 (punti di revisione 1–5) |
| § 4 prove nel browser, documenti, revisione | 7 |
