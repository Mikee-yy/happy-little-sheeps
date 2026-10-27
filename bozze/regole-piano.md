# Schermata delle Regole (fase 6) — piano di lavoro

> **Per chi esegue:** SOTTO-PROCEDURA OBBLIGATORIA: superpowers:subagent-driven-development, compito per compito (un esecutore e un revisore per compito). I passi usano le caselle (`- [ ]`).

**Scopo:** la schermata Regole di oggi (un elenco di punti uguali) diventa otto sezioni a fisarmonica con le carte vere disegnate (animate come in primo piano, ferme con "Riduci movimento"), i disegni del pacchetto grafico, le facce del dado, un disegno del recinto con le tre zone della Testata e tre esempi con i nomi dei giocatori della partita in corso. Chi non ha mai giocato deve capire in 3-4 minuti.

**Architettura:** i testi e la struttura delle sezioni stanno in `client/src/testi.ts` (`regole(nomi, setup)`, numeri letti da `setup.json` e dal catalogo delle carte); la schermata nuova sta in `client/src/regole/` (`Regole.tsx` la fisarmonica, `recinto.tsx` il disegno delle zone, `alternativi.ts` i testi alternativi). Le carte disegnate (`cartaSVG` di `client/src/scena/carte/`, con le loro animazioni CSS) arrivano con un import dinamico (`regole/carte.tsx`), così la pagina iniziale resta leggera come oggi; i disegni del pacchetto (pecore, agnellino, Montone, dado, facce, icone) sono i simboli dello sprite già nella pagina (`client/src/grafica.tsx`). Motore, `sync/` e regole di Firebase non cambiano.

**Tecnologia:** TypeScript, React 19, Vite, Vitest + jsdom.

**Progetto:** `bozze/regole-progetto.md` (approvato dall'utente con le risposte del 26 ottobre 2026). Leggerlo prima di cominciare, insieme alle correzioni qui sotto, che valgono sopra il progetto.

**Correzioni al progetto (decise dopo la sua scrittura):**
- Sezione 4: niente anelli. La riga della Testata è esattamente quella di oggi in `REGOLE` (Dado del Pastore): "Centro del recinto 3 agnellini, dentro il recinto 2, sulla staccionata o appena fuori 1, più in là nessuno (mai più di quanti ne ha)." La figura è un recinto visto dall'alto con le tre zone (centro, interno, staccionata e fascia appena fuori), non tre anelli.
- Eliminazione come D46 di `docs/motore.md`: 3–4 giocatori 3 uguali o 4 diversi, 2 giocatori 4 uguali o 4 diversi; la Tosatura è un jolly (D29) e nei "diversi" conta come un tipo in più.
- Parità al primo posto (sezione 7 ed esempio a): lanciano tutti, **prima chi ha meno agnellini, a parità a caso** (D19 di `docs/motore.md`). Il progetto dice "ordine a caso (D10)", ma D10 riguarda l'ordine degli effetti, non dei lanciatori: vale il motore.
- Le carte nelle Regole si muovono (`cartaSVG(id, true)`), ferme solo con "Riduci movimento"; Belato Finale e parità stanno nella sezione 7; più sezioni aperte insieme; negli esempi i nomi dei giocatori della partita in corso, nomi di esempio fuori da una partita.

## Vincoli generali

- Motore, `sync/` e `database.rules.json` non si toccano.
- Tutti i testi visibili in `client/src/testi.ts`, in italiano; nomi, tipi e commenti in italiano. Numeri del gioco (posti dell'Ovile, regole di eliminazione, facce e copie del dado, mano di 5, finestra di 6 secondi, valori delle carte) letti da `engine/data/setup.json` (`SETUP`) e dal catalogo (`defCarta`), mai scritti a mano. Fanno eccezione i numeri delle zone della Testata, che stanno nella riga fissata sopra.
- `design/` non si modifica; colori solo dai token (`design/design-tokens.css`), tratto Notte come da `design/guida-stile.md` (al massimo 3 pastelli per oggetto).
- Telefono 375 px: una colonna, margini 16 px, nessuno scorrimento orizzontale della pagina.
- Dalla pagina iniziale nessun import statico arriva a `scena/carte/carte.ts`, `scena/carte/illustrazioni.ts`, `scena/carte/animazioni.css` (oltre ai file già vietati dalla prova di `client/src/partita/caricaScena.test.ts`).
- I nomi dei giocatori non finiscono mai in `innerHTML` o `dangerouslySetInnerHTML`: solo testo React.
- Node non è installato: in Bash sempre `export PATH="$PWD/.tools/bin:$PATH"` dalla radice. Durante il lavoro solo prove mirate (`npx vitest run <file>`); niente `prettier --write` su file interi. Niente commit né push.

## Da guardare in revisione

1. **Carte degli altri a metà partita:** la schermata riceve solo una lista di nomi, mai la vista o una mano; tornando dalle Regole nel "Passa il telefono" durante una fase segreta ricompare la copertura "Passa a…" e nessuna mano è visibile. Prova nel compito 4.
2. **Partita ferma mentre si leggono:** nella prova i bot non muovono con le Regole aperte e riprendono al ritorno (le due prove di oggi in `App.test.tsx` restano verdi); nella partita su un dispositivo lo stato al ritorno è lo stesso di prima. Prova nel compito 4.
3. **Riduci movimento:** con `prefers-reduced-motion: reduce` nessuna carta della schermata ha la classe `anima` (si usa `cartaSVG(id, false)`) e il CSS ferma comunque ogni `.anima .an`. Prova nel compito 2.
4. **Nomi lunghi o strani negli esempi:** un nome di 16 lettere senza spazi va a capo a 375 px senza far scorrere la pagina di lato; un nome con `<b>` si vede come testo; con 2 giocatori o con nomi ripetuti gli esempi restano coerenti (tre nomi diversi). Prove nei compiti 1 e 3, controllo a occhio nel compito 5.
5. **Molte carte animate su un telefono economico:** le sezioni chiuse non montano nessuna figura; le figure di una sezione aperta ma fuori dallo schermo hanno le animazioni in pausa. Prove nei compiti 3 e 2; controllo a occhio con tutte le sezioni aperte nel compito 5.
6. **Tastiera e lettore di schermo:** ogni titolo è un `<button>` dentro un `<h2>`, con `aria-expanded` e `aria-controls` che punta sempre a un elemento presente; Tab passa da un titolo all'altro; la fila scorrevole delle figure si raggiunge con Tab e ha un nome; ogni carta ha il suo testo alternativo. Prova nel compito 3.

---

### Compito 1: testi e struttura delle Regole, numeri dai dati

**File:**
- Modifica: `client/src/testi.ts` (al posto di `REGOLE`, che sparisce in questo compito insieme al suo unico uso in `client/src/schermate.tsx`, sostituito per ora da un semplice elenco dei paragrafi di `regole(null)`, con lo stesso `.regole h1` e lo stesso pulsante "Indietro", così le prove di `App.test.tsx` restano verdi fino al compito 3)
- Prova: `client/src/testi.test.ts` (nuovo `describe('regole')`)

**Interfacce prodotte (da `testi.ts`):**

```ts
export type DisegnoRegole =
  | { tipo: 'carta'; id: IdTipoCarta }
  | { tipo: 'pecora'; pecora: IdPecora }
  | { tipo: 'agnellino' }
  | { tipo: 'montone' }
  | { tipo: 'dado' }
  | { tipo: 'faccia'; faccia: string }        // id della faccia in setup.json (pascolo_piccolo, …, testata)
  | { tipo: 'guaio'; guaio: TipoGuaioCarta }  // icona del tipo di Guaio
  | { tipo: 'recinto' };                       // le tre zone della Testata (compito 2)
export interface FiguraRegole { disegno: DisegnoRegole; didascalia?: string }
export interface BloccoRegole { testo: string; figure: FiguraRegole[] }
export type IdSezioneRegole = 'scopo' | 'round' | 'carte' | 'dado' | 'guai' | 'beeeno' | 'fine' | 'esempi';
export interface SezioneRegole { id: IdSezioneRegole; titolo: string; blocchi: BloccoRegole[] }

/** I tre nomi degli esempi: quelli della partita nell'ordine dei posti, completati con i nomi di esempio che non ci sono già (senza badare alle maiuscole). */
export function nomiPerEsempi(nomi: readonly string[] | null): [string, string, string];
/** Le otto sezioni. `nomi` null: fuori da una partita. L'esempio di eliminazione usa la regola di `nomi.length` giocatori (2 → dueGiocatori), altrimenti quella normale. */
export function regole(nomi: readonly string[] | null, setup: typeof SETUP = SETUP): SezioneRegole[];
```

e in `T.regole`: `titolo: 'Regole'`, `indietro: 'Indietro'`, `nomiEsempio: ['Ada', 'Bea', 'Cleo', 'Dario']`, `stanzaVaAvanti` (vedi decisione aperta 1 in fondo), `valore: (n) => \`valore ${n}\``, `guaioDi: (tipo) => \`Guaio ${T.tipiGuaio[tipo]}\``, `carta: (nome, dettaglio: string | null, testo) => string` (es. "Cannocchiale, valore 7. Guarda le prime 2 carte del mazzo: tienine 1, scarta l'altra."), `figure: (n) => string` (nome della fila scorrevole, es. "3 figure, scorri di lato").

**Contenuto delle sezioni:** i testi in bozza del progetto, con le correzioni in cima a questo piano. Titoli, nell'ordine: "Lo scopo", "Un round in 5 passi", "Le carte", "Il dado", "Guai ed eliminazione", "Il Beee-NO!", "Come finisce la partita", "Tre esempi". Figure per blocco:
- scopo: agnellino e Montone; le quattro pecore con didascalia del tratto letta da `SETUP.pecore` (es. "Ricciolo · +1 Meteo · −1 Predatori").
- round, un blocco per passo: (1) carta `fulmine-curioso`; (2) carta `carriola`; (3) nessuna; (4) dado; (5) agnellino. "Fino a 5" da `manoIniziale`.
- carte: Trovate con effetto `fischietto-da-richiamo`, `cannocchiale`; senza effetto `carriola`, `balla-di-fieno`; Gemelle `calzino-gemello`, `pantofola-gemella`; Belati `belato-di-gruppo`, `pernacchia`, `visita-di-garzina`; Guai `grandine-a-sorpresa`, `volpe-gentile`, `crisi-esistenziale`, `tosatura-a-sorpresa`. Valori e +2/−2 da `defCarta`; "da 0 a 9" dal minimo e massimo dei valori delle Trovate del catalogo.
- dado: le facce nell'ordine di `SETUP.dado` (una per id); "Sei facce: quattro numeri e due Testate" con 6 = somma delle `copie` e 2 = copie della Testata; Pascolo e Furto con le `quantita`; la riga fissata della Testata seguita dalla figura `recinto`; "gli agnellini oltre l'ultimo posto libero non si prendono".
- guai: icone dei 4 tipi; Ricciolo con il suo tratto; tre Guai uguali (`grandine-a-sorpresa`, `fulmine-curioso`, `pioggia-di-traverso`) e quattro diversi (`grandine-a-sorpresa`, `volpe-gentile`, `crisi-esistenziale`, `tosatura-a-sorpresa`); numeri da `SETUP.eliminazione`.
- beeeno: due `beee-no` e la faccia `testata`; esempio con `nomiPerEsempi(nomi)[0]` e `[1]`; "6 secondi" da `finestraReazioneSecondi`.
- fine: i quattro modi (Ovile pieno anche con l'agnellino di consolazione, ultima pecora, mazzo finito con un round in più, poi più agnellini, poi meno Guai), parità al primo posto (D19), Belato Finale (conta solo il valore stampato), tutti pari (il Guaio torna in fondo, nessuno lancia). Nessuna figura.
- esempi: (a) nomi [0], [1], [2] con 7, 7 e 4: [0] e [1] lanciano, prima chi ha meno agnellini; [2] prende il Guaio, 1 agnellino e può scartare una carta; figure `fulmine-curioso`, dado, `cannocchiale`. (b) [0] ha nell'Angolo (uguali − 1) Meteo e una Tosatura (con 3 uguali: Meteo, Meteo e Tosatura): la Tosatura vale come Meteo, sono `uguali` uguali, è fuori; figure i Meteo e `tosatura-a-sorpresa` (con 3 uguali: `grandine-a-sorpresa`, `fulmine-curioso`, `tosatura-a-sorpresa`; con 4 si aggiunge `pioggia-di-traverso`). (c) Beee-NO! contro Beee-NO! come nella sezione 6, figure come la sezione 6.

- [ ] **Prove (scritte prima):**
  - `regole(null).map((s) => s.id)` è `['scopo','round','carte','dado','guai','beeeno','fine','esempi']` e i titoli sono quelli sopra.
  - Lo scopo contiene "18", "15" e "12"; con `setup` clonato e `perNumeroGiocatori['3'].postiOvile = 20` contiene "20" e non "15".
  - Il dado contiene esattamente la riga fissata della Testata; ha 5 figure `faccia` con gli id di `SETUP.dado` in ordine e una figura `recinto` dopo la riga della Testata.
  - I Guai contengono "3 Guai uguali" e "4 diversi" e, per due giocatori, "4 uguali"; con `eliminazione.normale` clonata a `uguali 5` il testo dice 5.
  - Le carte nominano i valori di `defCarta` (2, 7, 8, 5); ogni figura `carta` di tutte le sezioni ha un id del catalogo (`defCarta` non lancia) e ogni `faccia` esiste in `SETUP.dado`.
  - Il round contiene "fino a 5", il Beee-NO! "6 secondi"; la fine contiene "meno agnellini" e "Belato Finale".
  - `nomiPerEsempi(null)` è `['Ada','Bea','Cleo']`; `(['Tu','Bea','Leo'])` resta uguale; `(['Bea','Zoe'])` è `['Bea','Zoe','Ada']`; `(['ada','Ugo','Ivo','Eva'])` è `['ada','Ugo','Ivo']`; `(['ADA','Bea'])` dà un terzo nome diverso da entrambi.
  - Con `regole(['Zoe','Ugo'])` l'esempio (b) ha 4 figure (3 Meteo + Tosatura) e nomina "Zoe"; con `regole(['Zoe','Ugo','Ivo'])` ne ha 3.
  - Nessuna frase dei testi delle Regole ha due volte i due punti (stessa regola dei consigli della prova).
- [ ] **Esegui:** `npx vitest run client/src/testi.test.ts` (prima rosse, poi verdi) e `npm run typecheck`.

---

### Compito 2: le figure — carte animate fuori dalla scena, disegni del pacchetto, recinto con le zone

**File:**
- Modifica: `client/src/scena/carte/animazioni.css` (riceve da `client/src/scena/scena.css` le regole `.teatro .anima .an…` delle carte e i fotogrammi `@keyframes an-…` che usano; tutte le regole delle carte passano da `.teatro .anima` a `.anima`, il movimento ridotto diventa `.anima .an { animation: none !important; }`; `.teatro .cm.una-volta .anima .an` resta com'è), `client/src/scena/scena.css` (togliere ciò che si è spostato; `an-palpebra`, usato anche dagli occhi del lupo nella pozza, si sposta lo stesso: la scena carica entrambi i file), `client/src/scena/carte/carte.test.ts` (la prova delle classi cerca `.anima .${cls} {`)
- Modifica: `client/src/grafica.tsx` (+ `Montone`)
- Crea: `client/src/regole/carte.tsx` (caricato solo con import dinamico), `client/src/regole/caricaCarte.ts`, `client/src/regole/alternativi.ts`, `client/src/regole/recinto.tsx`
- Prova: `client/src/regole/figure.test.tsx`, `client/src/regole/recinto.test.ts`, `client/src/partita/caricaScena.test.ts` (aggiungere i tre file delle carte all'elenco dei vietati dalla pagina iniziale)

**Interfacce:**
- Consuma: `DisegnoRegole`, `T.regole.carta/valore/guaioDi` (compito 1); `cartaSVG(id, animata)` di `client/src/scena/carte/carte.ts`; `piattaforma.movimentoRidotto()`; `FIONDA`, `valoriCerchi` di `client/src/scena/fionda/tiro.ts`; `SETUP.testata.esitoMassimo`.
- Produce:
  - `Montone({ size }: { size?: number })` in `grafica.tsx` (simbolo `montone`, viewBox `0 0 220 160`).
  - `testoAlternativo(d: DisegnoRegole): string` in `alternativi.ts`: per le carte `T.regole.carta(nome, dettaglio, testo)` con dettaglio "valore N" (Trovate), "Belato", o "Guaio Meteo"; per gli altri disegni il nome (pecora dal catalogo, "Agnellino", "Montone", "Dado del Pastore", il nome della faccia, il tipo di Guaio, la descrizione delle zone del recinto). Tutti i testi da `T.regole`.
  - `CartaRegole({ id }: { id: IdTipoCarta }): JSX.Element` in `regole/carte.tsx`: `<span className="figura-carta" role="img" aria-label={testoAlternativo(...)} dangerouslySetInnerHTML={{ __html: cartaSVG(id, !piattaforma.movimentoRidotto()) }} />`; il file importa `../scena/carte/animazioni.css`.
  - `caricaCarte(): Promise<typeof import('./carte')>` (una volta sola; se fallisce, la richiesta dopo riprova, come `caricaScena`) e `useCarte(): typeof import('./carte') | null` in `caricaCarte.ts`.
  - `geometriaRecinto(): { recinto: Rett; centro: { rx: number; ry: number }; fascia: { x: number; y: number } }` e `RecintoZone(): JSX.Element` in `recinto.tsx`: recinto visto dall'alto in un viewBox fisso, interno Menta, ellisse del centro Limone con raggi `FIONDA.cerchi.centro` × i semiassi, staccionata Fango, fascia appena fuori larga `FIONDA.fasciaBordo` × lato (tratteggiata, angoli tondi), tratto Notte; su ogni zona il numero da `valoriCerchi(SETUP.testata.esitoMassimo)` e "0" fuori. `aria-hidden`: il testo alternativo lo mette chi la mostra.

- [ ] **Prove (scritte prima):**
  - `figure.test.tsx`: `CartaRegole` per `cannocchiale` ha `aria-label` "Cannocchiale, valore 7. …" e contiene `svg.anima`; con `matchMedia` finto che risponde `reduce` non c'è nessun `.anima`; per `grandine-a-sorpresa` il testo dice "Guaio Meteo"; `testoAlternativo` non è mai vuoto per nessun disegno usato da `regole(null)`.
  - `animazioni.css` contiene `@media (prefers-reduced-motion: reduce)` con `.anima .an { animation: none !important; }`, e nessuna regola delle carte comincia più con `.teatro .anima` (tranne `.teatro .cm.una-volta`); `carte.test.ts` aggiornata e verde.
  - `recinto.test.ts`: per punti scelti in ogni zona disegnata (centro, interno vicino alla staccionata, staccionata, dentro la fascia appena fuori, oltre la fascia) `zonaDi(p, geometriaRecinto().recinto)` dà 3, 2, 1, 1, 0: il disegno è lo stesso delle regole della fionda; i numeri scritti nel disegno sono `valoriCerchi(3)` e "0".
  - `caricaScena.test.ts`: dalla pagina iniziale nessun import statico arriva a `scena/carte/carte.ts`, `scena/carte/illustrazioni.ts`, `scena/carte/animazioni.css`; `regole/caricaCarte.ts` contiene `import('./carte')`.
- [ ] **Esegui:** `npx vitest run client/src/regole client/src/scena/carte client/src/partita/caricaScena.test.ts client/src/scena/Scena.test.tsx client/src/modalitaChiara.test.ts`, poi `npm run typecheck`.

---

### Compito 3: la schermata a fisarmonica e l'accessibilità

**File:**
- Crea: `client/src/regole/Regole.tsx`
- Modifica: `client/src/schermate.tsx` (togliere `Regole` e l'import di `REGOLE`), `client/src/App.tsx` (import da `./regole/Regole`; per ora `nomi={null}`), `client/src/stile.css` (sezione "Regole" al posto delle regole `.regole` e `.legenda` di oggi, se `.legenda` non serve più altrove)
- Prova: `client/src/regole/Regole.test.tsx`

**Interfacce:**
- Consuma: `regole`, `T.regole` (compito 1); `useCarte`, `testoAlternativo`, `RecintoZone`, `Montone` e i simboli di `grafica.tsx` (compito 2).
- Produce: `Regole(p: { nomi: readonly string[] | null; inStanza?: boolean; onIndietro: () => void })`.

**Come è fatta:**
- `<main className="regole">` con `<h1 tabIndex={-1}>` (al montaggio la pagina torna in cima e il punto della tastiera va sull'h1); otto `<section>`, ognuna `<h2><button aria-expanded aria-controls={id-pannello}>` con il numero e il titolo; il pannello `<div id role="region" aria-labelledby>` è sempre presente ma `hidden` da chiuso, e da chiuso **non monta le figure**. All'apertura è aperta solo "Lo scopo"; più sezioni aperte insieme; lo stato non si ricorda tra un'apertura e l'altra.
- Un blocco con al massimo 2 figure: figure a sinistra (carte larghe 90 px), testo a destra. Con più di 2: fila scorrevole sopra il testo (`overflow-x: auto`, `tabIndex={0}`, `role="group"`, `aria-label={T.regole.figure(n)}`), senza far scorrere la pagina di lato. Didascalie sotto la figura.
- Le figure `carta` usano `CartaRegole` quando `useCarte()` ha caricato il modulo; prima (o se il caricamento fallisce) un segnaposto delle stesse misure con `role="img"` e `testoAlternativo`. Gli altri disegni sono subito disponibili.
- Ogni pannello aperto è osservato con `IntersectionObserver` (se c'è): fuori dallo schermo prende la classe `fuori-vista`, e in `stile.css` `.regole .fuori-vista .anima .an { animation-play-state: paused; }`.
- "Indietro" (`T.regole.indietro`) fisso in fondo (`position: sticky; bottom: 0`, con margine sicuro in basso), e l'ultima sezione aperta non resta coperta. Testo, contrasto e misure con i token di oggi (`--testo-m`, colori della carta e dell'inchiostro); nomi e parole lunghe vanno a capo (`overflow-wrap: anywhere`).
- Con `inStanza` una riga `T.regole.stanzaVaAvanti` sotto il titolo.

- [ ] **Prove (scritte prima):**
  - Otto `h2 > button`; solo il primo ha `aria-expanded="true"`; ogni `aria-controls` punta a un elemento che esiste; il pannello chiuso è `hidden` e non contiene `.figura-carta` né segnaposti.
  - Clic su "Le carte" la apre, clic su "Il dado" apre anche quella (due aperte); un nuovo clic la richiude.
  - Il punto della tastiera va sull'h1 al montaggio; i titoli sono pulsanti veri (`type="button"`), quindi Invio e Spazio vengono dal browser: basta controllarne il tipo e l'ordine nel documento.
  - Aprendo "Le carte", dopo che `caricaCarte` si risolve compaiono 11 `.figura-carta` con il loro `aria-label`; con `caricaCarte` finto che fallisce restano 11 segnaposti con lo stesso testo e la schermata funziona.
  - La fila delle figure con più di 2 figure ha `tabIndex` 0 e un nome.
  - Con `nomi={['Wwwwwwwwwwwwwwww', '<b>Ugo</b>']}` e "Tre esempi" aperta: il testo contiene i due nomi letterali e nessun elemento `b` nato dal nome.
  - "Indietro" chiama `onIndietro`; con `inStanza` c'è la riga dell'avviso, senza non c'è.
- [ ] **Esegui:** `npx vitest run client/src/regole client/src/App.test.tsx -t "Riassunto e regole"` e `npm run typecheck`.

---

### Compito 4: da dove si apre, nomi della partita e ritorno al punto di prima

**File:**
- Modifica: `client/src/App.tsx` (`regole(da, nomi)` ricorda anche i nomi; `<Regole nomi={…} inStanza={…} />`), `client/src/partita/Partita.tsx` (`onRegole: (nomi: readonly string[]) => void`, chiamata dal menu con i nomi di `tavolo.giocatori` nell'ordine dei posti), `client/src/prova/PartitaProva.tsx` (stessa firma, passa avanti), `client/src/remoto/Stanza.tsx` (`onRegole: (nomi: readonly string[] | null) => void`: menu e velo di pausa di `PartitaRemota` con i nomi di `pub.giocatori`; sala d'attesa e `Riassunto` con `null`, sempre con una funzione che lo dice esplicitamente, mai `onClick={p.onRegole}`), `client/src/prova.tsx` se la firma lo chiede.
- Prova: `client/src/App.test.tsx`, `client/src/remoto/Stanza.test.tsx`

**Regole di apertura:**
- Home, preparazione (link "Leggi tutte le regole" in fondo) e sala d'attesa: `nomi = null` (nomi di esempio).
- Menu della partita su un dispositivo, della prova e della stanza in corso: i nomi dei giocatori della partita. `inStanza` solo dalla stanza in corso.
- Il ritorno resta quello di oggi (`dopoRegole`); le scelte della preparazione restano intatte.

- [ ] **Prove (scritte prima):**
  - Home → Regole → apri "Tre esempi": ci sono "Ada", "Bea" e "Cleo".
  - Partita su un dispositivo con "Zoe" e "Ugo": menu → Regole → "Tre esempi" nomina Zoe e Ugo, e l'esempio di eliminazione usa la regola dei 2 giocatori; nessun elemento della mano o del pannello della partita è nella pagina mentre le Regole sono aperte; "Indietro" durante la scelta segreta riporta alla copertura "Passa a …" (nessuna mano visibile) e lo stato della sessione (`vista(null)`) è uguale a prima di aprire.
  - Prova: Regole dal menu nomina "Tu", "Bea" e "Leo"; le due prove di oggi sui bot fermi con le Regole aperte restano verdi.
  - Preparazione → "Leggi tutte le regole" → Indietro: la prova di oggi resta verde e gli esempi usano i nomi di esempio, non quelli scritti nei campi.
  - `Stanza.test.tsx`: in partita, menu → Regole chiama `onRegole` con i nomi della stanza; dal velo di pausa lo stesso; dalla sala d'attesa con `null` (la prova "la sala d'attesa mostra il riassunto e il collegamento alle Regole" controlla anche l'argomento).
  - In tutto `client/src` non resta nessun `REGOLE` (`grep`).
- [ ] **Esegui:** `npx vitest run client/src/App.test.tsx client/src/remoto/Stanza.test.tsx client/src/regole client/src/testi.test.ts` e `npm run typecheck`.

---

### Compito 5: insieme, prova a occhio a 375×812, note

**File:** note in `bozze/da-fare.md` (Fase 6: schermata delle regole fatta, con rimando a questo piano) e `bozze/passaggio-di-consegne.md`; in `CLAUDE.md`, sezione Struttura, una riga per `client/src/regole/` (schermata delle Regole; le carte arrivano a parte da `regole/carte.tsx`). Correzioni solo se la prova a occhio trova qualcosa.

- [ ] **Prova a occhio** nel pannello del browser con il server `gioco` di `.claude/launch.json`, finestra 375×812; foto in `.superpowers/confronti/regole-*.png` (nessun dato personale nelle foto):
  - Home → Regole: titolo, sezione 1 aperta con agnellino, Montone e le quattro pecore con i tratti; "Indietro" fisso in fondo che non copre l'ultima riga.
  - Ogni sezione aperta una per una (una foto ciascuna): carte a 90 px leggibili nel valore e nel disegno, file scorrevoli che non fanno scorrere la pagina di lato, recinto con le tre zone e i numeri, facce del dado.
  - Le carte si muovono (sezione 3) e tutte le sezioni aperte insieme scorrono senza scatti evidenti; scorrendo, le carte fuori dallo schermo sono in pausa (`getAnimations()` dal pannello degli strumenti, solo per controllo).
  - Partita su un dispositivo con un nome di 16 lettere: menu → Regole → "Tre esempi" con quel nome che va a capo; Indietro → di nuovo la copertura "Passa a…".
  - Partita di prova: menu → Regole con "Tu", "Bea" e "Leo"; Indietro e la prova riprende.
  - Se il pannello non può simulare "Riduci movimento" basta la prova del compito 2; scriverlo nel resoconto.
- [ ] **Prove mirate finali:** `npx vitest run client/src/regole client/src/testi.test.ts client/src/App.test.tsx client/src/remoto/Stanza.test.tsx client/src/scena/carte client/src/scena/Scena.test.tsx client/src/partita/caricaScena.test.ts client/src/modalitaChiara.test.ts`; `npm run typecheck`; `npm run build` e nel resoconto la misura del pacchetto iniziale prima e dopo (deve restare quasi uguale: le carte stanno nel pacchetto a parte).

---

## Decisioni aperte per l'utente

1. **Regole aperte in una stanza a metà partita:** la partita non può fermarsi per tutti senza toccare `sync/`; il piano la lascia andare avanti come oggi (le scadenze di chi legge continuano a scorrere) e mostra in cima alle Regole la riga `T.regole.stanzaVaAvanti`, per esempio "Nella stanza la partita va avanti: torna presto." Da confermare o cambiare prima del compito 3.

## Decisioni prese durante l'esecuzione (27 ottobre)

- **Regole aperte in una stanza a metà partita (scelta dell'utente: "Avviso e richiamo"):** la partita va avanti e i tempi corrono; in cima alle Regole una riga lo dice ("Nella stanza la partita va avanti: torna presto."), e quando tocca a te fare una scelta compare in cima alle Regole un richiamo che riporta alla partita (testo in `testi.ts`). Compiti 3 e 4.
- **Carte nelle figure:** 13, come l'elenco del compito 1; la prova del compito 3 che ne contava 11 va portata a 13.
