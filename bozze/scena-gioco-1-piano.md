# Scena nel gioco, pezzo 1 — piano di lavoro

> **Per chi esegue:** SOTTO-SKILL OBBLIGATORIA: superpowers:executing-plans (o superpowers:subagent-driven-development), compito per compito. I passi usano le caselle (`- [ ]`).

**Obiettivo:** nella partita su un dispositivo e nella partita di prova si gioca dentro la scena 2,5D della bozza. La scena è smontata in moduli TypeScript, mostra sempre lo stato vero della partita, e le scelte si fanno ancora con i pannelli di oggi in un cassetto.

**Architettura:**
- La bozza `bozze/scena/scena.src.html` diventa un "teatro" in `client/src/scena/`: codice che lavora direttamente sul DOM con un solo ciclo di animazione, senza React a ogni fotogramma.
- Una funzione pura (`fotografia`) traduce la vista del motore in ciò che la scena deve mostrare. `teatro.allinea(foto, modo)` mette in pari la scena, e la verità è sempre il motore.
- React monta il teatro (`Scena.tsx`) e gli passa una fotografia a ogni aggiornamento.

**Tecnologie:** TypeScript, React 19, Vite, Vitest con jsdom, Web Animations API, canvas 2D, WebAudio.

**Progetto:** `bozze/scena-gioco-1-progetto.md` (approvato dall'utente il 14 ottobre). La bozza di riferimento è `bozze/scena/scena.src.html`; i numeri di riga sotto sono i suoi. Il banco di prova è `bozze/scena/prove.js`.

## Vincoli globali

- **Niente commit né push** (regola dell'utente: si pubblica solo quando si gioca con la nuova grafica, dopo i pezzi 1–3). Al posto dei passi "Commit" si aggiorna il registro.
- **Node:** in Bash, sempre `export PATH="$PWD/.tools/bin:$PATH"` prima di `npx`/`npm`. Niente installazioni né dipendenze nuove.
- **Lingua:** nomi, tipi e commenti in italiano, come nel resto del codice.
- **Testi:** tutti i testi visibili ai giocatori vanno in `client/src/testi.ts`, nella nuova sezione `T.scena`. I testi del solo pannello di sviluppo restano nel modulo di sviluppo.
- **Motore e stanze:** `engine/` e `sync/` non si toccano. Le stanze (`client/src/remoto/`) restano col `Tavolo` di oggi.
- **Fedeltà alla bozza:** stessi valori di tempi, misure, colori e comportamenti, salvo dove questo piano dice altro.
  - Ogni modulo indica le righe della bozza da cui viene.
  - Le regole finte della bozza non si portano: `st`, `CODA_PESCATE`, `CODA_GUAI`, `MANO_INIZIALE`, `pesca`, `gioca`, `effettoCarta`, `dopoArrivo`→`vittoria`, `tiraDado` con faccia a caso, `furto` goloso, `testata` automatica, `rubaA` con ladro a caso.
- **Tempo:** dentro `client/src/scena/` niente `setTimeout`, `setInterval`, `requestAnimationFrame` o `performance.now`. Si usano `ctx.orologio.dopo`/`ogni`/`attesa` (tempo della scena). Fanno eccezione:
  - `ciclo.ts` (il motore del ciclo);
  - i gesti dell'interfaccia in `mano.ts` e `lettura.ts`, che usano tempo vero;
  - il campanaccio periodico di `suoni.ts`.

  I `setTimeout` dei giochi tra agnellini e del meteo della bozza diventano `ctx.orologio.dopo`. Così con il ciclo manuale tutta la scena avanza a comando.
- **API del browser:** passano tutte da `client/src/scena/piattaforma.ts`, che ha un ripiego quando manca (jsdom). Riguarda `el.animate`, `canvas.getContext`, `DOMMatrix`, `matchMedia`, `navigator.vibrate`, `AudioContext`, `document.fonts`, la misura del testo e `getBoundingClientRect` a zero. Il teatro deve girare in jsdom senza errori.
- **Caso:** niente `Math.random` diretto nella scena. Si usa `ctx.caso()`, che di base vale `Math.random` e nelle prove si sostituisce.
- **CSS:** gli stili della bozza (righe 5–262) vanno in `client/src/scena/scena.css`.
  - Ogni selettore sta sotto la classe radice `.teatro`.
  - Niente `id` nel DOM della scena (le prove possono avere più teatri): gli `id` della bozza diventano classi con lo stesso nome (`#mondo` → `.mondo`).
  - Colori e caratteri vengono da `design/design-tokens.css` (`--colore-*`, `--font-titoli`, `--font-testo`). La tavolozza `P` della bozza (riga 329) diventa la costante `TAVOLOZZA`, con gli stessi esadecimali, solo dove serve un valore dentro un SVG generato.
- **Sprite:** i simboli vengono da `design/svg/sprite.svg`, già inserito da `Sprite` in `client/src/grafica.tsx`. La pagina di sviluppo lo inserisce allo stesso modo.
- **Animazioni con velocità:** al posto della modifica di `Element.prototype.animate` (righe 385–404) si usa `ctx.anima(el, fotogrammi, opzioni)`. Registra l'animazione e le dà la velocità della scena. `ctx.animaInterfaccia(...)` resta a velocità 1 (mano, lettura, consigli).
- **Comandi:**
  - un file di prove: `export PATH="$PWD/.tools/bin:$PATH" && npx vitest run <file>`;
  - tutto: `npm test`, `npm run typecheck`, `npm run build`.
  - I file di prova che toccano il DOM iniziano con `// @vitest-environment jsdom`.

## Punti da controllare in revisione

1. **Niente sbirciate.** Le carte in mano di chi sta in basso si vedono scoperte solo quando la schermata è privata per lui ed è lui ad avere il telefono. Durante "Passa a …", nelle schermate pubbliche e nelle domande a tutti la mano resta coperta (dorsi). È la regola anti-trucco già decisa dall'utente. → prova nel compito 11 (fotografie registrate) e nel compito 2 (`mano` null).
2. **Doppio montaggio e smontaggio di React.** `distruggi()` non lascia cicli di animazione, timer, ascoltatori su `window`/`document` o audio da sbloccare. Un secondo `creaTeatro` sulla stessa radice riparte pulito. → prove nei compiti 8 e 11 (StrictMode).
3. **Fotografia nuova a metà movimento**, anche con cambio di chi sta in basso: nessun agnellino perso o duplicato, cartelli giusti a fine movimento. → prova nel compito 8.
4. **Ritorno da un'altra scheda.** Fotogramma lunghissimo: niente raffiche, orologio al massimo +250 ms. La scena si rimette in pari "subito". → prove nei compiti 1 e 8 e in `Scena.tsx` (compito 11).
5. **Conti estremi:** gregge a 0, Ovile pieno, eliminato con 0 agnellini, 2 giocatori. Allineare a questi valori non lascia agnellini fuori posto né cartelli sbagliati. → prova nel compito 5.

---

## Mappa dei file

```
client/scena.html                     pagina di sviluppo (come client/prova.html, non entra nel sito)
client/src/scena/
  piattaforma.ts                      API del browser con ripiego
  orologio.ts                         orologio della scena (puro)
  misure.ts                           390×844, misuraDito, mano↔scena (puro)
  disposizioni.json, disposizioni.ts  geometria per posto, 2/3/4 giocatori
  fotografia.ts                       dalla vista a ciò che si mostra (puro)
  contesto.ts                         Contesto condiviso dai moduli (DOM, orologio, aree, servizi)
  scheletro.ts                        DOM della scena (righe 264–320)
  scena.css
  servizi/opzioni.ts, regia.ts, risparmio.ts, suoni.ts, consigli.ts
  ambiente/paesaggio.ts, flora.ts, particelle.ts, cielo.ts
  personaggi/aree.ts, agnello.ts, giochi.ts, branco.ts, pecora.ts
  carte/carte.ts, illustrazioni.ts
  tavolo/recinti.ts, postazioni.ts, coperta.ts
  mano.ts, lettura.ts
  camera.ts
  meteo/comune.ts, grandine.ts, pioggia.ts, vento.ts, nebbia.ts, fulmine.ts, gelata.ts, pozzanghera.ts, lupo.ts, indice.ts
  ordini.ts                           dado, testata, beeeNo, guaio, voli di carte
  ciclo.ts                            ciclo di animazione (automatico o manuale)
  teatro.ts                           creaTeatro: unico punto d'accesso
  Scena.tsx                           componente React
  OpzioniScena.tsx                    interruttori delle Opzioni (menu del gioco e pagina di sviluppo)
  sviluppo/sviluppo.tsx, eventi.ts, prove.ts, varianti.json
  aiuti-prova.ts                      contesto finto e partite simulate per le prove
```

---

### Compito 1: Basi pure — piattaforma, orologio, misure, disposizioni

**File:**
- Creare: `client/src/scena/piattaforma.ts`, `orologio.ts`, `misure.ts`, `disposizioni.json`, `disposizioni.ts`
- Prove: `client/src/scena/orologio.test.ts`, `misure.test.ts`, `disposizioni.test.ts`

**Interfacce:**
- Produce:
  ```ts
  // orologio.ts (righe 361–384)
  export class Orologio {
    ms: number; velocita: number;
    dopo(fn: () => void, ms?: number): number;
    ogni(fn: () => void, ms: number): number;      // passo minimo 4 ms
    annulla(id: number): void;
    attesa(ms: number): Promise<void>;
    avanza(msReali: number): void;                 // al più 250 ms reali × velocita per chiamata
    inSospeso(): number;                           // timer ancora da eseguire
    svuota(): void;                                // toglie tutti i timer (nuova partita, distruggi)
  }
  // misure.ts (righe 325, 335–359)
  export const W = 390, H = 844;
  export function misuraDito(w: number, h: number): { S: number; D: number };
  export function manoInScena<T extends { x: number; y: number; k: number }>(p: T, KD: number): T;
  export function scenaInMano<T extends { x: number; y: number }>(p: T, KD: number): T;
  // disposizioni.ts (righe 1076–1119), dati in disposizioni.json
  export type Rett = [number, number, number, number];            // x0, y0, x1, y1
  export interface PostoDisp {
    x: number; y: number; w: number; targa: [number, number]; fumetto: [number, number];
    recinto: [number, number, number, number, number];            // x, yDietro, yDavanti, larghezza, k
    area: Rett; guai: [number, number];
    tappetino?: [number, number, number, number]; ventaglio?: [number, number]; specchia?: boolean; // solo avversari
  }
  export interface Disposizione {
    posti: PostoDisp[];                                            // 0 = in basso, poi gli avversari da sinistra a destra
    gregge: { area: Rett; evita: Rett[]; cartello: [number, number] };
    liberoDaPiante: Rett[]; prospettiva: [number, number];
  }
  export function disposizione(n: 2 | 3 | 4): Disposizione;
  // piattaforma.ts
  export const piattaforma: {
    anima(el: Element, f: Keyframe[], o: KeyframeAnimationOptions): Animation;   // senza WAAPI: oggetto con finished già risolto
    contesto2d(c: HTMLCanvasElement): CanvasRenderingContext2D | null;
    matriceDi(el: Element): DOMMatrixReadOnly | null;
    movimentoRidotto(): boolean;
    puoVibrare(): boolean; vibra(ritmo: number[]): void;
    audio(): AudioContext | null;
    caratteriPronti(ms: number): Promise<void>;
    larghezzaTesto(testo: string, font: string): number;          // senza canvas: 0,55 × dimensione × caratteri
  };
  ```
- In `disposizioni.json`, il posto 0 è `DISPOSIZIONI.verticale.io` con in più `guai: [10, 626]` (riga 1812). Gli avversari sono quelli di `2`, `3` e `4` senza `id`, `nome`, `pecora`, `agnelli`, `mano` e `angolo`. Non ci sono `posti` né `agnelli` (vengono dalla partita).

- [ ] **Passo 1: scrivere le prove che falliscono**
  - `orologio.test.ts`, dalle prove di `provaOrologio` (prove.js 90–123):
    - `dopo(500)` a velocità 2 scatta dopo 250 ms reali (tolleranza ±30);
    - `ogni(100)` in 1000 ms reali dà 10 colpi (±1);
    - `annulla` ferma `ogni`;
    - un buco di 10 s fa avanzare l'orologio di al più 250 ms a velocità 1;
    - un timer che lancia un errore non ferma gli altri;
    - `svuota()` porta `inSospeso()` a 0;
    - `attesa(300)` si risolve solo dopo 300 ms di scena.
  - `misure.test.ts`: i casi di `provaDito (a)` (prove.js 327–332, copiare la tabella `casi`), più `scenaInMano(manoInScena(p, 1.2), 1.2)` = `p`.
  - `disposizioni.test.ts`, per n = 2, 3, 4:
    - `posti.length === n`;
    - ogni `area`, `recinto`, `targa`, `tappetino` dentro 0..390 × 0..844;
    - le aree dei recinti non si sovrappongono tra loro né con l'area del gregge;
    - `liberoDaPiante` presente;
    - i valori coincidono con la bozza: per esempio `disposizione(3).posti[2].recinto` = `[206, 146, 184, 94, 0.62]` e `specchia: true`.
- [ ] **Passo 2: lanciarle e vederle fallire.** Atteso: FAIL per moduli mancanti.
- [ ] **Passo 3: scrivere i moduli** con la logica delle righe indicate. `piattaforma` legge da `globalThis` a ogni chiamata, così le prove possono sostituire `navigator.vibrate` o `matchMedia`.
- [ ] **Passo 4: lanciare le tre prove.** Atteso: PASS.
- [ ] **Passo 5: registro** (nessun commit).

### Compito 2: La fotografia

**File:**
- Creare: `client/src/scena/fotografia.ts`
- Prova: `client/src/scena/fotografia.test.ts`

**Interfacce:**
- Consuma: `Vista`, `IdGiocatore`, `IdCarta`, `IdPecora` da `engine/src`; `tipiPericolosi(v, id)` e `mancanti(v, id)` da `client/src/partita/descrizioni.ts`.
- Produce:
  ```ts
  export type OraDelGiorno = 'giorno' | 'pomeriggio' | 'tramonto' | 'sera';
  export interface PostoFoto {
    id: IdGiocatore; nome: string; pecora: IdPecora;
    agnellini: number; angolo: IdCarta[]; carteInMano: number;
    eliminato: boolean; fuoriDalRound: boolean; deveAgire: boolean;
    giocata: { coperta: true } | { coperta: false; carte: IdCarta[] } | null;
    unGuaioAllEliminazione: boolean;      // tipiPericolosi(v, id).length > 0
    quasiPieno: boolean;                  // !eliminato && mancanti(v, id) <= 3
  }
  export interface Fotografia {
    posti: PostoFoto[];                   // 0 = in basso, poi gli altri nell'ordine dei posti dopo di lui
    gregge: number; postiOvile: number; totaleAgnellini: number;
    mano: IdCarta[] | null;               // null = coperta (si vedono solo i dorsi)
    mazzo: number; mazzoGuai: number; scarti: IdCarta[];   // ultimi 6, la cima per ultima
    guaioRound: IdCarta | null; dado: string | null;       // id della faccia
    round: number; ultimoRound: boolean; ora: OraDelGiorno;
  }
  export function fotografia(tavolo: Vista, inBasso: IdGiocatore, mano: IdCarta[] | null): Fotografia;
  export function inBassoIniziale(tavolo: Vista): IdGiocatore;   // primo in attesa nell'ordine dei posti dal primo giocatore, altrimenti giocatori[0]
  export function riassuntoTestuale(f: Fotografia): string[];    // una riga per posto + gregge, testi da T.scena.riassunto
  ```
- Regole:
  - **`fuoriDalRound`:** non eliminato e `datiRound.partecipanti` non vuoto e non lo contiene.
  - **`giocata`:**
    - `null` se non partecipa o non ha ancora scelto;
    - coperta se ha scelto (stesso criterio di `StatoScelta` in `componenti.tsx`) e `datiRound.giocate` è vuoto;
    - scoperta con `datiRound.giocate[id]` dopo la rivelazione.
  - **`deveAgire`:** `tavolo.attesa.giocatori` lo contiene.
  - **`dado`:** la faccia dell'ultimo `dado_lanciato` dopo l'ultimo `round_iniziato` negli eventi, altrimenti `null`.
  - **`ora`:** rapporto massimo `agnellini / postiOvile` tra i non eliminati. ≥ 0,86 sera, ≥ 0,7 tramonto, ≥ 0,5 pomeriggio, altrimenti giorno (riga 1979). Con `ultimoRound` almeno `tramonto`.
  - **`totaleAgnellini`:** somma degli agnellini dei giocatori più il gregge.

- [ ] **Passo 1: scrivere le prove che falliscono** (partite da `nuovaPartita` e dagli aiuti di `engine/test/aiuti.ts`: `scenario`, `prosegui`, `scegli`, `avanza`):
  - `posti ruotati`: con 3 giocatori g1, g2, g3 e `inBasso = 'g2'` i posti sono `['g2', 'g3', 'g1']`;
  - `segnalini`: un angolo a un Guaio dall'eliminazione dà `unGuaioAllEliminazione`; 12 agnellini su 15 danno `quasiPieno`, 11 no;
  - `carte del round`:
    - prima della scelta `giocata` è null;
    - dopo `scegli` per g1 soltanto, g1 coperta e gli altri null;
    - dopo la rivelazione le carte vere;
    - **mai id di carte prima della rivelazione** (controllo su `JSON.stringify(foto)`, con la mano non passata);
  - `mano`: `fotografia(v, 'g1', null).mano === null`; con la mano passata la restituisce uguale;
  - `ora del giorno`:
    - 7/15 giorno, 8/15 pomeriggio, 11/15 tramonto, 13/15 sera;
    - con `ultimoRound` e 2/15 tramonto;
  - `eliminati e fuori dal round`: un eliminato ha `eliminato: true` e non è `fuoriDalRound`;
  - `inBassoIniziale`: nella fase di scelta, il primo in attesa a partire da `primoGiocatore`;
  - `conservazione`: `totaleAgnellini` = 45 con 3 giocatori a inizio partita.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere `fotografia.ts`** e i testi `T.scena.riassunto` in `client/src/testi.ts`:
  - `posto`: (nome, agnellini, posti, guai) => `${nome}: ${agnellini} agnellini su ${posti}, ${guai} Guai`;
  - `eliminata`: (nome) => `${nome}: eliminata`;
  - `gregge`: (n) => `Gregge: ${n} agnellini`.
- [ ] **Passo 4: lanciarla.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 3: Contesto, scheletro, CSS e servizi

**File:**
- Creare: `client/src/scena/contesto.ts`, `scheletro.ts`, `scena.css`, `servizi/opzioni.ts`, `servizi/regia.ts`, `servizi/risparmio.ts`, `servizi/suoni.ts`, `servizi/consigli.ts`, `aiuti-prova.ts`
- Prove: `client/src/scena/servizi/servizi.test.ts`

**Interfacce:**
- Consuma: `Orologio`, `piattaforma` (compito 1).
- Produce:
  ```ts
  // scheletro.ts: costruisce sotto `radice` (classe .teatro) il DOM delle righe 264–320, con classi al posto degli id.
  // Del #hud tiene solo i contenitori, senza i pulsanti Opzioni/Prova eventi (che stanno nel gioco o nella pagina di sviluppo).
  export interface ElementiScena { schermo: HTMLElement; scena: HTMLElement; camera: HTMLElement; mondo: HTMLElement; ui: HTMLElement;
    cieloSvg: SVGSVGElement; sole: SVGGElement; nuvoleSvg: SVGSVGElement; paesaggio: SVGSVGElement; flora: SVGSVGElement;
    coperta: HTMLElement; mazzo: HTMLElement; scarti: HTMLElement; mazzoGuai: HTMLElement; dicMazzo: HTMLElement; dicGuai: HTMLElement;
    dado: HTMLElement; dadoPos: HTMLElement; nebbiaSvg: SVGSVGElement; mano: HTMLElement; scoppio: SVGSVGElement; consiglio: HTMLElement; }
  export function creaScheletro(radice: HTMLElement): ElementiScena;
  // contesto.ts
  export interface Contesto {
    el: ElementiScena; orologio: Orologio; caso: () => number; ridotto: boolean;
    T: number;                       // tempo della scena in secondi (riga 941)
    sera: number;                    // 0..1 (riga 1192)
    S: number; KD: number;           // scala e ingrandimento della mano (misure)
    anima(el: Element, f: Keyframe[], o: KeyframeAnimationOptions): Animation;
    animaInterfaccia(el: Element, f: Keyframe[], o: KeyframeAnimationOptions): Animation;
    regia: Regia; risparmio: Risparmio;
    suona(nome: NomeSuono, ...a: number[]): void;   // NomeSuono: i metodi di Suono (servizi/suoni.ts)
    vibra(nome: 'guaio' | 'beeeNo' | 'vittoria'): void;
    pulizie: Array<() => void>;      // eseguite da distruggi
  }
  export function creaContesto(el: ElementiScena, o: { caso?: () => number }): Contesto;
  // servizi/opzioni.ts (righe 409–421, 2582–2606): uno solo per pagina, è una preferenza del telefono
  export interface Opzioni { suoni: boolean; vibrazione: boolean; veloci: boolean }
  export function leggiOpzioni(): Opzioni;           // predefinite { suoni: false, vibrazione: true, veloci: false } se il salvataggio è bloccato o rotto
  export function opzioni(): Opzioni;
  export function cambiaOpzione(k: keyof Opzioni): void;   // salva in 'hls-opzioni', avvisa gli ascoltatori
  export function ascoltaOpzioni(cb: () => void): () => void;
  export function preparaSbloccoAudio(): () => void;       // righe 2591–2599; restituisce la pulizia
  // servizi/regia.ts (righe 406–435, 453–462)
  export interface Regia { aperti: number; salto: boolean; inViaggio: Set<unknown>;
    apriEvento(nome: string): () => void; conEvento<A extends unknown[], R>(nome: string, fn: (...a: A) => R): (...a: A) => R;
    eventoInCorso(): boolean; velocita(): 1 | 2 | 6; salta(): void; }
  export function creaRegia(c: { orologio: Orologio; meteoAttivo: () => boolean; inViaggioValido: (g: unknown) => boolean }): Regia;
  // servizi/risparmio.ts (righe 436–452): misuraFluidita(ora, dtReale), limiteParticelle(), riposo/leggero come nella bozza
  // servizi/suoni.ts (righe 467–561): Suono, suona (tace durante il salto tranne 'pioggiaFine'), RITMI, vibra
  // servizi/consigli.ts (righe 2562–2580): CONSIGLI = [T.scena.consigli.solleva, T.scena.consigli.leggi], chiave 'hls-consigli-visti', rivediSuggerimenti()
  // aiuti-prova.ts
  export function contestoFinto(o?: { caso?: () => number }): Contesto;   // jsdom: scheletro in un div staccato, caso con seme fisso
  ```
- Testi nuovi in `T.scena`:
  - `consigli`: `solleva: 'Tocca una carta per sollevarla'`, `leggi: 'Tieni premuta una carta per leggerla'`;
  - `opzioni`: `suoni: 'Suoni'`, `vibrazione: 'Vibrazione'`, `veloci: 'Animazioni veloci'`, `rivedi: 'Rivedi i suggerimenti'`, `si: 'sì'`, `no: 'no'`;
  - `scoppio: 'BEEE-NO!'`.

- [ ] **Passo 1: scrivere le prove che falliscono** in `servizi.test.ts` (jsdom), dalle prove `provaOpzioni`, `provaSalto (f, g)`, `provaRisparmio` e `provaVibrazione`:
  - `opzioni`:
    - `cambiaOpzione('veloci')` cambia e salva in `hls-opzioni`;
    - con `localStorage.getItem` che lancia valgono le predefinite e `cambiaOpzione` non lancia;
    - con JSON rotto valgono le predefinite;
  - `regia`:
    - senza eventi `velocita() === 1`;
    - con un evento aperto e `veloci` acceso `2`;
    - dopo `salta()` `6`;
    - chiudere l'evento due volte non porta `aperti` sotto 0;
    - `conEvento` chiude anche su promessa rifiutata;
  - `suoni`: durante il salto `suona('pop')` non suona e `suona('pioggiaFine')` sì (con un `Suono` finto);
  - `vibrazione`:
    - `vibra('guaio')` chiama `navigator.vibrate([60, 50, 60])`;
    - con vibrazione spenta non chiama niente;
    - senza `navigator.vibrate` non lancia;
  - `risparmio`:
    - 5 secondi di fila sotto i 30 fotogrammi accendono `leggero` e la classe `leggero` su `.scena`;
    - il primo fotogramma non conta come secondo lento;
    - `limiteParticelle()` dà 140, e 60 in leggero;
  - `consigli`: `rivediSuggerimenti()` toglie `hls-consigli-visti` e mostra il primo consiglio; finiti i consigli la chiave vale `'1'`;
  - `scheletro`: `creaScheletro` crea `.mondo`, `.ui`, `.mano` e `.mazzo` dentro la radice, e nessun elemento con `id`.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere i moduli e `scena.css`** (righe 5–262, con i selettori sotto `.teatro` e gli id resi classi). `aiuti-prova.ts` crea un contesto completo su un `div` staccato.
- [ ] **Passo 4: lanciare la prova e `npm run typecheck`.** Atteso: PASS, nessun errore di tipo.
- [ ] **Passo 5: registro.**

### Compito 4: Ambiente — paesaggio, flora, particelle, cielo

**File:**
- Creare: `client/src/scena/ambiente/paesaggio.ts` (righe 704–724), `flora.ts` (725–847), `particelle.ts` (848–938), `cielo.ts` (939–1074: sole, luce, vento, nuvole, `tempesta`)
- Prova: `client/src/scena/ambiente/ambiente.test.ts`

**Interfacce:**
- Consuma: `Contesto`, `Disposizione.liberoDaPiante`.
- Produce:
  - `creaAmbiente(ctx, disp): Ambiente` con `passo(dt)`, `passo30(dt)` (erba e nuvole), `impostaOra(ora: OraDelGiorno)` (le classi `ora-*` su `.schermo`, `ctx.sera`, `SOLE.meta`; righe 1977–1982), `ridisponiFlora(disp)` e `distruggi()`;
  - `ventoIn(x): number`;
  - `LUCE` (`dx`, `lung`) e `vettoreOmbra(h)`;
  - `particella(tipo, x, y, o)`;
  - `aggiornaParticelle(dt)` con al più `limiteParticelle()` particelle;
  - `fumata`, `zeta` e `decoro`, spostati qui da 1399 e 1505 perché li usano personaggi e meteo.
- Se `contesto2d` restituisce null le particelle si contano ma non si disegnano.

- [ ] **Passo 1: scrivere la prova che fallisce** (jsdom, `contestoFinto`):
  - `creaAmbiente` disegna paesaggio, flora e nuvole senza errori;
  - 300 passi da 33 ms senza errori;
  - nessuna pianta dentro i rettangoli `liberoDaPiante`;
  - dopo 1000 `particella` ce ne sono al più 140 (60 in leggero);
  - `impostaOra('sera')` mette `ora-sera` e `ctx.sera === 1`;
  - `distruggi` svuota gli SVG.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere i moduli** dalle righe indicate.
- [ ] **Passo 4: lanciarla.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 5: Gli agnellini — aree, cervello e corpo, giochi, branco

**File:**
- Creare: `client/src/scena/personaggi/aree.ts`, `agnello.ts`, `giochi.ts`, `branco.ts`
- Prove: `client/src/scena/personaggi/agnello.test.ts`, `branco.test.ts`

**Interfacce:**
- Consuma: `Contesto`, `Disposizione`, `profondita`, `ventoIn`, `LUCE`, `fumata`, `zeta`, `particella`.
- Produce:
  ```ts
  // aree.ts (righe 1122–1124, 1188–1210): le aree hanno il nome del Luogo del motore (id giocatore o 'gregge')
  export interface Area { nome: Luogo; x0: number; y0: number; x1: number; y1: number; posti: number;   // Infinity per il gregge
    agnelli: Agnello[];    // assegnati, compresi quelli in viaggio verso quest'area
    mostrati: number;      // arrivati (è il numero sul cartello)
    evita?: Rett[]; sfumata?: boolean; recinto?: unknown; recinto0?: unknown; area0?: Rett; cartello: HTMLElement | null; }
  export function profondita(y: number, prospettiva: [number, number]): number;
  export function puntoLibero(a: Area, io: Agnello | null, caso: () => number): { x: number; y: number };
  // agnello.ts (righe 1212–1381): stessa logica, ma il disegno passa da un CorpoAgnello
  export type StatoAgnello = 'fermo' | 'cammina' | 'corre' | 'vola' | 'bruca' | 'dorme' | 'salta' | 'guarda' | 'atterra' | 'regia' | 'parte';
  export interface CorpoAgnello { disegna(g: Agnello): void; togli(): void }
  export class Agnello { x: number; y: number; a: Area; stato: StatoAgnello; regia: boolean; intrappolato: boolean; /* … come la bozza */
    constructor(ctx: Contesto, a: Area, corpo?: CorpoAgnello);   // senza corpo: crea quello DOM
    vaiIn(a: Area, modo?: 'corre' | 'vola', ritardoS?: number): void;
    passo(dt: number, ora: number): void; togli(): void; /* salta, guarda, fulmina, respingi, annullaRegia, passoRegia */ }
  // giochi.ts (righe 1382–1503): GIOCHI, muovi, effetto, perDurata, saltello, prendi, rilascia, ancora, pianificaGiochi(dt); setTimeout → ctx.orologio.dopo
  // branco.ts
  export class Branco {
    aree: Map<Luogo, Area>; agnelli: Set<Agnello>;
    constructor(ctx: Contesto);
    costruisci(aree: Area[], conti: Map<Luogo, number>): void;          // toglie tutti e crea gli agnellini già al loro posto
    allinea(obiettivo: Map<Luogo, number>): number;                    // muove (corre) quelli che servono, restituisce quanti partono
    sposta(n: number, da: Luogo, a: Luogo, modo?: 'corre' | 'vola'): number;   // riga 1964: limitato dai posti liberi e da chi c'è
    conti(): Map<Luogo, { assegnati: number; mostrati: number }>;
    inViaggio(): number; intrappolati(): number;
    passo(dt: number, ora: number): void; togli(): void;
  }
  ```
- **Correzione rispetto alla bozza** (necessaria per la verità del motore):
  - in `vaiIn` l'appartenenza cambia **subito**: l'agnellino va tolto da `da.agnelli` e messo in `a.agnelli`;
  - la partenza visiva si ritarda con lo stato `'parte'`, che attende `ritardoS` (gli scaglioni da 230 ms di `sposta`, riga 1969) e poi va in `'corre'` o `'vola'`;
  - `da.mostrati--` solo se l'agnellino era arrivato, cioè non era in `'parte'`, `'corre'` o `'vola'`. Così un agnellino rimandato altrove a metà strada non toglie due volte;
  - un agnellino in `'parte'` conta come "in viaggio" per la regia.
- **`Branco.allinea`:**
  - calcola per ogni luogo la differenza tra `agnelli.length` e l'obiettivo;
  - per ogni luogo in eccesso sceglie prima gli agnellini arrivati e non intrappolati, poi gli altri;
  - li manda verso i luoghi in difetto, dando la precedenza al gregge come origine e come destinazione;
  - nessun limite di posti: l'obiettivo è già valido perché viene dal motore;
  - i ritardi sono a scaglioni come `sposta`.

  Il totale degli agnellini non cambia mai dopo `costruisci`. Un obiettivo con un totale diverso è un errore: si scrive in console e si ricostruisce con `costruisci`.
- L'agnellino toccato salta e bela, come alla riga 1223.

- [ ] **Passo 1: scrivere le prove che falliscono.**
  - `agnello.test.ts` (jsdom, `contestoFinto`, corpo finto):
    - `arriva a destinazione`: `vaiIn(b)` e 120 passi da 33 ms portano `stato` a `fermo`/`atterra`, la posizione dentro `b` e `b.mostrati === 1`;
    - `aggira il cartello`: nell'area del gregge di `disposizione(3)`, partendo sotto la zona `evita`, dopo 600 passi da fermo non è mai dentro `evita`;
    - `resta nel recinto`: dopo 2000 passi di vita libera sta dentro `[x0, x1] × [y0, y1]`;
    - `rete di sicurezza`: in regia con `muovi` verso un punto irraggiungibile, finisce entro 8,1 s di scena;
    - `intrappolato`: `muovi` senza `trappola` si risolve subito e l'agnellino non si sposta;
    - `rimandato a metà strada`: `vaiIn(b)`, 5 passi, `vaiIn(c)`, poi fino all'arrivo. Atteso: `a.mostrati` sceso di 1 una volta sola, `b.mostrati` invariato, `c.mostrati` +1.
  - `branco.test.ts` (jsdom):
    - `allinea minimo`: da `{g1: 3, g2: 3, gregge: 39}` a `{g1: 6, g2: 3, gregge: 36}` partono esattamente 3 agnellini, tutti dal gregge;
    - `conservazione`: dopo qualsiasi `allinea` la somma degli assegnati resta 45;
    - `metà movimento`: `allinea` A, 3 passi, `allinea` B, poi fino a `inViaggio() === 0`. Ogni luogo ha `assegnati === mostrati ===` obiettivo B;
    - **`conti estremi`** (punto 5 della revisione): obiettivi con gregge 0, un recinto a `posti` pieni, un luogo a 0, 2 giocatori con 36. A fine movimento tutto coincide e nessun agnellino è fuori dalla sua area;
    - **`conto giusto`**: con `giocaPartiteSimulate` (in `aiuti-prova.ts`) giocare 24 partite intere: n = 2, 3, 4 × strategie `semplice` e `casuale` × semi 1–4. Le mosse sono quelle dei bot di `sync/prova.ts`: `semplice.scegli` o scelta a caso, `esitoTestataCasuale` per la Testata, e `prosegui`/`scadenza` per il sistema. Dopo ogni mossa `allinea(obiettivo dalla vista)`: gli assegnati coincidono subito. Ogni 10 mosse e a fine partita si avanza fino a `inViaggio() === 0` e anche `mostrati` coincide;
  - `giochi` (in `agnello.test.ts`): con `caso` fisso, 60 s di `pianificaGiochi` più passi senza errori, e alla fine nessun agnellino è ancora in regia oltre 8 s.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere i moduli** dalle righe indicate, con la correzione di `vaiIn` descritta sopra. Il corpo DOM è la parte di `disegna` e `creaExtra` (righe 1241–1251, 1358–1380). `giocaPartiteSimulate(o: { n; politica: 'semplice' | 'casuale'; seme; dopoMossa(v: Vista): void })` sta in `aiuti-prova.ts`.
- [ ] **Passo 4: lanciarle.** Atteso: PASS. Se `conto giusto` supera i 60 s, ridurre a semi 1–2 e annotarlo nel registro.
- [ ] **Passo 5: registro.**

### Compito 6: Carte, lettura e mano

**File:**
- Creare: `client/src/scena/carte/carte.ts` (righe 563–703 senza `CARTE`), `carte/illustrazioni.ts`, `lettura.ts` (2533–2544), `mano.ts` (1842–1907)
- Prove: `client/src/scena/carte/carte.test.ts`, `client/src/scena/mano.test.ts`

**Interfacce:**
- Consuma: `defCarta`, `CATALOGO` da `engine/src` (nome, valore, testo, famiglia, tipo, gemella, quando); `piattaforma.larghezzaTesto`.
- Produce:
  ```ts
  export function cartaSVG(id: IdCarta, animata?: boolean): string;   // accetta anche gli id d'istanza 'carta#2'
  export function retroSVG(guai: boolean): string;
  export function illustrazioneDi(id: IdCarta): { tipo: 'sprite'; simbolo: string } | { tipo: 'meteo'; svg: string } | { tipo: 'ripiego'; simbolo: string };
  export interface Lettura { apri(id: IdCarta, tenuta: boolean): void; chiudi(): void; aperta(): boolean }
  export function creaLettura(ctx: Contesto): Lettura;
  export interface Mano { mostra(carte: IdCarta[] | null, dorsi: number): void; attiva(): IdCarta | null; distruggi(): void }
  export function creaMano(ctx: Contesto, lettura: Lettura): Mano;
  ```
- **Illustrazioni:**
  - sprite: `sasso-comodo`→`c-sasso`, `calzino-gemello`→`c-calzino`, `ombrello-bucato`→`c-ombrello`, `campanaccio-stonato`→`c-campanaccio`, `beee-no`→`b-beeeno`, `belato-di-gruppo`→`b-gruppo`, `finta-svenuta`→`b-svenuta`, `grandine-a-sorpresa`→`g-grandine`, `lupo-vegetariano`→`g-lupo`;
  - meteo disegnati: `ILL_METEO` per `pioggia-di-traverso`, `vento-dispettoso`, `nebbia-fitta`, `fulmine-curioso`, `gelata-di-agosto`, `pozzanghera-senza-fondo` (righe 643–669).
  - Il controllo di copertura è sul **tipo di carta**, cioè l'id senza `#n`.
- **Ripieghi** (deciso nel progetto): simbolo in grande sul colore della famiglia.
  - Guai: `ico-<tipo>` (`meteo`, `predatori`, `drammi`, `tosatura`);
  - Trovate: `agnello`;
  - Belati: un fumetto "Beee!" disegnato in `illustrazioni.ts` (SVG originale semplice, tratto `notte` come `nuvolaIll`, riga 638). Il testo "Beee!" viene da `T.scena.carte.beee`.
- I nomi dei tipi e "QUANDO" (righe 581–582) vanno in `T.scena.carte`.
- **Mano** (riga 1849 e seguenti):
  - con `carte` mostra il ventaglio scoperto;
  - con `null` mostra `dorsi` carte coperte. Ai dorsi non rispondono né tocco né lettura;
  - tocco: solleva o abbassa (`attiva`);
  - tenuta di 430 ms: lettura, che si chiude al rilascio;
  - trascinamento oltre 9 px: la carta segue il dito e al rilascio **torna nel ventaglio**. Niente `gioca` in questo pezzo;
  - con il puntatore del mouse, sollevamento al passaggio;
  - i pulsanti `#rimetti`/`#gioca` della bozza non si portano;
  - l'ingrandimento `--kd` resta come nella bozza.
- Testo della lettura: `T.scena.lettura.lascia` ('Lascia per chiudere') e `T.scena.lettura.tocca` ('Tocca per chiudere').

- [ ] **Passo 1: scrivere le prove che falliscono.**
  - `carte.test.ts`:
    - per **ogni** tipo di carta del catalogo, `cartaSVG` contiene il nome della carta e, se c'è, il valore;
    - `illustrazioneDi` dà `sprite` per i 9 tipi elencati, `meteo` per i 6 e `ripiego` per tutti gli altri;
    - un Guaio dei Drammi senza disegno usa `ico-drammi`, una Trovata `agnello`, un Belato il fumetto;
    - gli id d'istanza (`'beee-no#2'`) danno la stessa carta di `'beee-no'`;
    - nessun testo di carta copiato nel modulo: il nome viene da `defCarta`. Controllo: il sorgente di `carte.ts` non contiene `'Sasso comodo'`.
  - `mano.test.ts` (jsdom):
    - `mostra(['sasso-comodo#1', 'beee-no#1'], 0)` crea 2 carte con `role="button"` e `aria-label` uguale al nome;
    - `mostra(null, 4)` crea 4 dorsi senza nomi di carte nel DOM;
    - un tocco (pointerdown e pointerup senza movimento) attiva la carta, un secondo tocco la disattiva;
    - una tenuta di 430 ms (timer finti) apre la lettura e il rilascio la chiude;
    - un trascinamento di 60 px seguito dal rilascio lascia la mano con le stesse 2 carte.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere i moduli.** `cartaSVG` tiene la cache di `cacheCarte` (riga 674).
- [ ] **Passo 4: lanciarle.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 7: Tavolo e pecore — recinti, postazioni, coperta

**File:**
- Creare:
  - `client/src/scena/tavolo/recinti.ts` (righe 1145–1187);
  - `personaggi/pecora.ts` (1549–1773: `Pecora`, `reagisci`, fumetti);
  - `tavolo/postazioni.ts` (targhe da 1731–1739; angoli e sterrati da 1805–1840; carte del round; segnalini);
  - `tavolo/coperta.ts` (pile e scarti da 1784–1803; dado 3D fermo da 1984–1997, righe di `creaDado` e `FACCE`).
- Prova: `client/src/scena/tavolo/tavolo.test.ts`

**Interfacce:**
- Consuma: `Contesto`, `Disposizione`, `Area`, `cartaSVG`, `retroSVG`, `PostoFoto`, `Fotografia`.
- Produce:
  ```ts
  export function creaRecinto(ctx: Contesto, a: Area, r: PostoDisp['recinto']): void;   // + disegnaRecinto, aggiornaOmbreRecinti
  export function aggiornaCartello(a: Area, postiOvile: number): void;   // 'n/posti' o T.scena.gregge(n); classe 'quasi' quando posti − mostrati ≤ 3
  export class Pecora { constructor(ctx: Contesto, chi: IdGiocatore, pecora: IdPecora, p: PostoDisp); passo(dt: number): void; fai(tipo: string, forte?: boolean): void; togli(): void; /* fulmina, brina… come la bozza */ }
  export interface Postazioni { aggiorna(f: Fotografia): void; distruggi(): void }   // targhe, segnalini, angoli, sterrati, ventagli coperti, carte del round
  export function creaPostazioni(ctx: Contesto, disp: Disposizione, lettura: Lettura): Postazioni;
  export interface Coperta { aggiorna(f: Fotografia): void; dado(faccia: string | null): void; distruggi(): void }
  export function creaCoperta(ctx: Contesto): Coperta;
  export function simboloFaccia(f: FacciaDado): string;   // pascolo q → 'd-p'+q, furto q → 'd-f'+q, testata → 'd-testata'
  ```
- **Targhe:**
  - il nome del giocatore, con `max-width` ed ellissi per i nomi lunghi;
  - classe `turno` se `deveAgire`;
  - segnalini: `T.scena.segnalini.unGuaio` ('1 Guaio all\'eliminazione', con l'icona di avviso) e `T.scena.segnalini.quasiPieno(n)` (`Mancano ${n}`);
  - eliminato: targa `T.tavolo.eliminata` (testo che esiste già), recinto vuoto, pecora nella posa `svenuta` tenuta ferma (ultimo fotogramma di `reagisci('svenuta')`);
  - fuori dal round: `T.scena.fuoriDalRound` ('Fuori dal round').
- **Carte del round:**
  - sullo sterrato di ogni avversario (`tappetino`) e, per chi sta in basso, a sinistra della mano, vicino all'angolo (x 10..120, y 560);
  - un dorso se coperta, le carte scoperte in piccolo se rivelate;
  - toccandone una si apre la lettura.
- **Ventagli degli avversari:** `carteInMano` dorsi.
- **Angoli:** come la bozza. Toccando una carta si apre la lettura.
- **Coperta:**
  - pile con `mazzo` e `mazzoGuai`;
  - diciture `T.scena.mazzo(n)` (`Mazzo ${n}`), `T.scena.guai(n)` (`Guai ${n}`), `T.scena.scarti` ('Scarti');
  - scarti con le ultime 6 carte (`f.scarti`), con angolo e spostamento a caso ma stabili per carta (seme dall'id);
  - il Guaio del round scoperto accanto al mazzo dei Guai;
  - il dado fermo sulla faccia di `f.dado`, o sulla prima se null.
- Il mazzo, il dado e il mazzo dei Guai **non reagiscono ai tocchi** in questo pezzo.

- [ ] **Passo 1: scrivere la prova che fallisce** (jsdom, `contestoFinto`, fotografie costruite a mano):
  - **cartelli**: '7/15' e 'Gregge 32'; classe `quasi` a 12/15 e non a 11/15;
  - **targhe**:
    - il nome giusto per ogni posto;
    - `turno` solo su chi deve agire;
    - segnalino `unGuaio` presente/assente secondo la fotografia;
    - eliminata con il testo `T.tavolo.eliminata`;
  - **carte del round**:
    - coperta → un dorso e nessun nome di carta nello sterrato;
    - scoperta → i nomi delle carte;
  - **angoli**: 2 Guai nella fotografia danno 2 mini-carte; una nuova fotografia con 1 ne lascia 1;
  - **coperta**:
    - diciture 'Mazzo 40' e 'Guai 21';
    - 6 scarti al massimo;
    - il dado con `furto_grande` mostra `d-f4`;
  - **pecore**: 4 pecore con 4 giocatori, la terza specchiata come `specchia`; 100 passi senza errori.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere i moduli** e i testi `T.scena` elencati.
- [ ] **Passo 4: lanciarla.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 8: Il teatro — ciclo, allineamento, distruzione

**File:**
- Creare: `client/src/scena/ciclo.ts` (righe 1510–1547), `teatro.ts`
- Prova: `client/src/scena/teatro.test.ts`

**Interfacce:**
- Consuma: tutto quanto sopra.
- Produce:
  ```ts
  export interface OpzioniTeatro { ciclo?: 'automatico' | 'manuale'; ambiente?: boolean; caso?: () => number }   // ambiente false: niente erba, nuvole, particelle (prove veloci)
  export interface StatoMostrato {
    n: number; inBasso: IdGiocatore | null;
    agnellini: Record<Luogo, { assegnati: number; mostrati: number }>;
    inViaggio: number; intrappolati: number; inRegia: number;
    zoom: number; postazioniNascoste: number; recintiAlterati: number;   // per le prove di camera e meteo (compito 9)
    angoli: Record<IdGiocatore, IdCarta[]>; mano: IdCarta[] | null;
  }
  export interface Teatro {
    allinea(f: Fotografia, modo: 'calmo' | 'subito'): void;
    avanza(ms: number): void;               // solo con ciclo manuale: passi da 33 ms (orologio + scena)
    eventoInCorso(): boolean; salta(): void;
    // `ordini: Ordini` si aggiunge nel compito 9
    stato(): StatoMostrato;
    distruggi(): void;
  }
  export function creaTeatro(radice: HTMLElement, o?: OpzioniTeatro): Teatro;
  ```
- **`allinea`:**
  - **Prima volta, numero di giocatori diverso o `inBasso` diverso:** ricostruzione `subito`, qualunque sia il modo richiesto, perché il cambio di chi sta in basso avviene dietro "Passa a …". Si usa `disposizione(n)`. I posti della fotografia vanno ai posti della disposizione nello stesso ordine. Si costruiscono aree, recinti, pecore, postazioni, flora e `Branco.costruisci` con i conti della fotografia. Prima si fermano meteo, camera e voli in corso.
  - **Stesso tavolo, `subito`:** come sopra, ma senza ricreare ambiente e flora.
  - **Stesso tavolo, `calmo`:** `Branco.allinea(obiettivo)`; `postazioni.aggiorna(f)`; `coperta.aggiorna(f)`; `mano.mostra(f.mano, f.posti[0].carteInMano)`; `ambiente.impostaOra(f.ora)`. Le carte che compaiono o spariscono hanno una dissolvenza di 200 ms con `animaInterfaccia`.
  - Un agnellino che arriva aggiorna il cartello (`aggiornaCartello`).
- **`ciclo.ts`:**
  - in automatico è `requestAnimationFrame` come alle righe 1511–1534, con riposo, misura della fluidità, velocità della regia, `orologio.avanza`, passi da al più 50 ms e `aggiornaFumetti`;
  - in manuale `avanza(ms)` esegue lo stesso corpo con `dtReale = 0,033` finché non ha consumato `ms`;
  - `visibilitychange` riallinea l'istante dell'ultimo fotogramma (riga 2709).
- **Tocchi:**
  - un tocco sul prato durante un evento lo salta, con le stesse esclusioni della bozza (riga 2676): tovaglia e pile, carta sollevata, interfaccia;
  - qualsiasi tocco sveglia dal riposo;
  - un tocco sulla scena abbassa la carta sollevata.
- **`distruggi`:**
  - ferma il ciclo e svuota l'orologio;
  - toglie gli ascoltatori su `window`/`document` (`resize`, `pointerdown` in cattura, `visibilitychange`, sblocco audio);
  - ferma meteo e animazioni ed esegue `ctx.pulizie`;
  - svuota la radice.

  Dopo `distruggi` gli altri metodi non fanno niente.

- [ ] **Passo 1: scrivere la prova che fallisce** (jsdom, ciclo manuale, `ambiente: false`, fotografie da `fotografia(vistaPer(nuovaPartita(...), null), …)`):
  - `prima fotografia`: con 3 giocatori `stato().agnellini` coincide con la fotografia (assegnati e mostrati) e `inBasso` è giusto;
  - `calmo`: dopo una fotografia con 3 agnellini dal gregge a g1, gli assegnati cambiano subito. Dopo `avanza(4000)` anche i mostrati, e `inViaggio === 0`;
  - **`metà movimento e cambio di chi sta in basso`** (punto 3 della revisione): fotografia A calma, `avanza(300)`, fotografia B con un altro `inBasso`. Dopo `avanza(4000)` tutto coincide con B e il totale è invariato;
  - **`ritorno da un'altra scheda`** (punto 4): con ciclo automatico e `requestAnimationFrame` finto, un fotogramma 10 s dopo il precedente fa avanzare l'orologio di al più 250 ms (× velocità) senza errori;
  - **`distruggi`** (punto 2):
    - si contano con spie `addEventListener`/`removeEventListener` di `window` e `document`: dopo `distruggi` ogni ascoltatore aggiunto è stato tolto;
    - con rAF finto nessuna richiesta resta in sospeso;
    - la radice è vuota;
    - `allinea` dopo `distruggi` non lancia;
  - `due teatri di fila`: `creaTeatro`, `distruggi`, `creaTeatro` sulla stessa radice. Il secondo funziona e c'è un solo `.mondo`;
  - `mano coperta`: una fotografia con `mano: null` e 5 carte mostra 5 dorsi e nessun nome di carta nella `.mano`;
  - `tocco sul prato`: con un evento aperto (`regia.apriEvento`), un pointerdown su `.mondo` accende il salto; su `.coperta` no.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere `ciclo.ts` e `teatro.ts`.**
- [ ] **Passo 4: lanciare la prova e tutte quelle di `client/src/scena`.** Atteso: PASS.
- [ ] **Passo 5: registro.**

### Compito 9: Camera, meteo e ordini

**File:**
- Creare:
  - `client/src/scena/camera.ts` (righe 2129–2224: `animaCamera`, `inquadra`, `sgancia`, `lineeZoom`, tween e `recintoVicino`/`cambiaRecinto`/`sfuma`);
  - `meteo/comune.ts` (2106–2128 e 2225–2335: `avviaMeteo`, `fermaMeteo`, `METEO`, `tempesta`, `rannicchia`, `ARRIVO_RIPARO`, `pozza`, `fumata`, `saetta`, `stalattiti`);
  - un file per ogni effetto di `EFFETTI_GUAIO` (2336–2525): `grandine.ts`, `pioggia.ts`, `vento.ts`, `nebbia.ts`, `fulmine.ts`, `gelata.ts`, `pozzanghera.ts`, `lupo.ts`;
  - `meteo/indice.ts` con la tabella da id del Guaio a effetto;
  - `ordini.ts` (dado 1998–2033 senza la scelta a caso; testata 2042–2058 con bersaglio e quantità dati; `beeeNo`/`beeeNoDi` 2060–2082; `guaio` 2083–2105 senza la consolazione né `st`; `volante`/`vola`/`cimaDi` 1897–1907).
- Prova: `client/src/scena/meteo/meteo.test.ts`

**Interfacce:**
- Produce:
  ```ts
  export interface Ordini {
    spostaAgnellini(n: number, da: Luogo, a: Luogo, modo?: 'corre' | 'vola'): number;
    meteo(carta: IdCarta, chi: IdGiocatore): Promise<void>;   // solo l'effetto (con lo zoom se chi non sta in basso); niente se il Guaio non ha effetto
    guaio(carta: IdCarta, chi: IdGiocatore): Promise<void>;   // carta in volo dal mazzo dei Guai, meteo, carta nell'angolo di chi
    fermaMeteo(): void;
    dado(faccia: string): Promise<void>;                      // lancio animato che si ferma su quella faccia (righe 1998–2033)
    testata(chi: IdGiocatore, bersaglio: IdGiocatore, quanti: number): Promise<void>;   // montone e `quanti` agnellini in volo verso il gregge
    beeeNo(chi: IdGiocatore): Promise<void>;
    inquadra(chi: IdGiocatore): Promise<void>; sgancia(): Promise<void>;
    fumetto(chi: IdGiocatore, testo: string, ms?: number): void;
    reagisci(chi: IdGiocatore, tipo: 'salto' | 'paura' | 'scossa' | 'svenuta' | 'festa'): void;
  }
  ```
- `Teatro` riceve il campo `ordini: Ordini`.
- Gli ordini che durano sono avvolti da `regia.conEvento` come alla riga 463.
- La vibrazione segue la bozza:
  - `guaio` su chi sta in basso: `vibra('guaio')`;
  - `beeeNo`: `vibra('beeeNo')`.
- `guaio` aggiunge la carta all'angolo mostrato. La fotografia successiva lo conferma, perché `postazioni.aggiorna` è idempotente.
- I testi dei fumetti degli ordini vanno in `T.scena.fumetti`, uguali alla bozza (per esempio `furto: (q) => \`Furto ${q}!\``).

- [ ] **Passo 1: scrivere la prova che fallisce.** È `provaCompleta` di `prove.js` resa prova automatica, in jsdom con ciclo manuale e `ambiente: false`.
  - Per n = 2, 3, 4, per ogni posto come `chi` e per ognuno degli 8 Guai con effetto (7 meteo più `lupo-vegetariano`):
    - `ordini.guaio(carta, chi)`, poi `avanza` a passi di 1 s finché `eventoInCorso()` è falso, al più 40 s;
    - atteso: l'evento finisce;
    - atteso, con `stato()`: agnellini assegnati e mostrati uguali a prima per ogni luogo, `inViaggio`, `intrappolati` e `inRegia` a 0, zoom 1, nessuna postazione nascosta né recinto alterato, la carta nell'angolo di `chi`.

    Sono 72 casi in un `describe.each`.
  - `salto`: un Guaio nebbia, `salta()` dopo 1 s; l'evento finisce entro 4 s di scena.
  - `vibrazione`: `guaio` su chi sta in basso vibra `[60, 50, 60]`, su un avversario no; `beeeNo` vibra `[140]`.
  - `dado`: `ordini.dado('testata')` finisce e il dado resta sulla faccia `d-testata`.
  - `spostaAgnellini`: 5 dal gregge a un recinto con 3 posti liberi ne sposta 3.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere i moduli.** Dove la bozza legge la matrice della camera (`inScenaDaMondo`, riga 2132) si usa `piattaforma.matriceDi`. Senza matrice vale l'identità.
- [ ] **Passo 4: lanciarla.** Atteso: 72 casi PASS più gli altri. Se il file supera i 120 s, si tiene in Vitest solo il bersaglio "in basso" e il primo avversario (48 casi), e i 72 completi restano alla pagina di sviluppo (compito 10). Annotarlo nel registro.
- [ ] **Passo 5: registro.**

### Compito 10: La pagina di sviluppo, le prove nel browser e la sosta

**File:**
- Creare:
  - `client/scena.html` (come `client/prova.html`);
  - `client/src/scena/sviluppo/sviluppo.tsx`;
  - `sviluppo/eventi.ts` (il pannello "Prova eventi", righe 2641–2654 e 2696–2708);
  - `sviluppo/prove.ts` (il banco di `prove.js`, con `avanza` del ciclo manuale al posto dell'orologio finto);
  - `sviluppo/varianti.json`;
  - `client/src/scena/OpzioniScena.tsx`.
- Modificare: `.claude/launch.json` (configurazione "scena-gioco": `npm run dev`, che apre `client/scena.html`).
- Prova: `client/src/scena/OpzioniScena.test.tsx`

**Interfacce:**
- **La pagina:**
  - una partita vera del motore (`nuovaPartita` con 2, 3 o 4 giocatori e seme fisso), passata con `fotografia` al teatro a schermo intero;
  - pulsanti in alto: "Opzioni" (che apre `OpzioniScena`) e "Prova eventi";
  - nel pannello:
    - chip "A chi?" sui posti;
    - Furto 2: `fumetto` e `spostaAgnellini(2, chi, ladro)`;
    - "Prende il Lupo" e i 7 meteo con `guaio`;
    - "Gioca Beee-NO!", "Pascolo da 5", 2/3/4 giocatori, "Ricomincia";
    - "Passa il telefono", che allinea con l'`inBasso` successivo;
    - "Prossima mossa", che fa giocare un bot con la strategia `semplice` e allinea in modo calmo.
- **Varianti dei recinti:** `varianti.json` contiene 2–3 varianti per 3 e 4 giocatori, con sostituzioni parziali delle disposizioni. Un selettore "Recinti: base / A / B" le applica e ricostruisce.
  - **A, "recinti più profondi":** recinti e aree più alti verso il basso. Il gregge scende e si stringe.
  - **B, "agnellini più piccoli lontano":** `prospettiva` con k0 più basso del 15%, così stanno più agnellini nello stesso recinto.
  - Ogni variante passa le prove di `disposizioni.test.ts` (si aggiunge un caso per variante).
- **`OpzioniScena`:** interruttori `role="switch"` per Suoni, Vibrazione (solo se `piattaforma.puoVibrare()`) e Animazioni veloci, più il pulsante "Rivedi i suggerimenti". Il punto della tastiera resta sull'interruttore toccato. Esc chiude, come alle righe 2600–2606 e 2684.
- `prove.ts` espone `window.PROVE` con:
  - `provaCompleta(modo: 'normale' | 'veloci' | 'salto')` sui 72 casi;
  - `provaDito` (b, d, f);
  - `provaRisparmio`;
  - `carteFuori()`: misura con `getBoundingClientRect` ogni testo di ogni carta disegnata in grande e restituisce quelle che escono dalla cornice.

- [ ] **Passo 1: scrivere la prova che fallisce** `OpzioniScena.test.tsx`:
  - gli interruttori mostrano `aria-checked` e il testo 'Animazioni veloci: no';
  - un clic cambia l'opzione salvata e il punto resta sull'interruttore;
  - senza `navigator.vibrate` la riga Vibrazione manca;
  - "Rivedi i suggerimenti" chiama `rivediSuggerimenti`.
- [ ] **Passo 2: lanciarla e vederla fallire.**
- [ ] **Passo 3: scrivere la pagina, il pannello, il banco e le varianti.** Più un caso in `disposizioni.test.ts` per ogni variante.
- [ ] **Passo 4: lanciare le prove e `npm run build`.** Atteso:
  - PASS;
  - in `client/dist` non ci sono `scena.html` né `prova.html`;
  - `grep -r "Prova eventi" client/dist` non trova niente.
- [ ] **Passo 5: prove nel browser** (`preview_start` "scena-gioco", scheda in primo piano, una prova alla volta):
  - `PROVE.provaCompleta('normale')`, `'veloci'` e `'salto'`, più `'normale'` col modo leggero acceso: 72 casi ciascuna, `falliti: []`;
  - `provaDito`, `provaRisparmio`, `carteFuori()`: tutto `[]`;
  - a 360×640 e a 430×932: niente fuori dallo schermo;
  - un nome di 14 lettere sulla targa non esce dalla scena;
  - il confronto a occhio con la bozza su prato, recinti, carte e dado ha lo stesso aspetto. Foto di confronto nel registro.
- [ ] **Passo 6: SOSTA. Mostrare all'utente le varianti dei recinti (3 e 4 giocatori) e i simboli delle carte senza disegno** (Trovata, Belato, un Guaio per tipo), con le foto. Aspettare la sua scelta.
  - La variante scelta si copia in `disposizioni.json` e il selettore delle varianti si toglie. Si tengono i casi di prova della variante scelta.
  - Se chiede di cambiare i simboli, si cambiano qui.
- [ ] **Passo 7: registro**, con la scelta dell'utente.

### Compito 11: La scena nel gioco

**File:**
- Creare: `client/src/scena/Scena.tsx`
- Modificare:
  - `client/src/partita/Partita.tsx`;
  - `client/src/prova/PartitaProva.tsx`, solo se serve per la posizione di `testa`;
  - `client/src/stile.css` (cassetto, intestazione sopra la scena, passaggio sopra la scena);
  - `client/src/testi.ts`.
- Prove: `client/src/scena/Scena.test.tsx`; modificare `client/src/App.test.tsx`.

**Interfacce:**
- Consuma: `creaTeatro`, `fotografia`, `inBassoIniziale`, `riassuntoTestuale`, `OpzioniScena`.
- Produce:
  ```ts
  export function Scena(p: { foto: Fotografia; nascosta?: boolean }): JSX.Element;
  ```
  - Monta il teatro in un `div.teatro` a tutto schermo, con `aria-hidden="true"`.
  - Accanto mette un elenco nascosto alla vista (classe `solo-lettori`) con `riassuntoTestuale(foto)`.
  - Alla prima fotografia chiama `allinea(foto, 'subito')`, poi `'calmo'` a ogni nuova fotografia.
  - Su `visibilitychange` verso visibile chiama `allinea(ultimaFoto, 'subito')`.
  - Smontando chiama `distruggi`.
- **`Partita.tsx`:**
  - Nuovo stato `inBasso: IdGiocatore | null`:
    - all'inizio `inBassoIniziale(tavolo)`;
    - nella prova sempre `p.umano`;
    - cambia solo quando `setDetentore(g)` riceve un giocatore (tocco su "Sono io"). Le schermate pubbliche **non** lo cambiano.
  - **Mano scoperta** solo se `sc.tipo === 'privata' && sc.giocatore === inBasso && !passaggio`. Allora si passa `sessione.vista(inBasso).giocatori[...].mano`, altrimenti `null`.
  - **La scena resta montata** in ogni schermata tranne la fine partita. `PassaDispositivo` diventa uno strato opaco sopra la scena (classe `passaggio sopra-scena`), senza smontarla.
  - **Disposizione:**
    - in alto `Intestazione`, e sotto `Cronaca` piccola;
    - poi `p.testa` (consiglio della prova o riquadro finale) in cima alla scena;
    - in basso la sezione `cassetto` con i pannelli, l'errore e la maniglia.
  - **Cassetto:**
    - un pulsante maniglia (`T.scena.cassetto.abbassa` 'Guarda il prato' / `T.scena.cassetto.alza` 'Torna alle scelte') con `aria-expanded`;
    - abbassato lascia visibile solo la maniglia;
    - torna su da solo quando cambia `chiaveScena`;
    - con `senzaAzioni` non c'è.
  - **Menu:** `Menu` riceve come figli `<OpzioniScena />` e il titolo `T.scena.opzioni.titolo` ('Opzioni').
  - Il ritorno di `Tavolo` e `RigaOvile` resta solo nelle stanze.
- **`App.test.tsx`:**
  - si aggiunge `vi.mock('./scena/teatro', …)` con un teatro finto che registra ogni chiamata `allinea(foto, modo)` in un elenco accessibile alla prova. Il teatro vero è provato nei compiti 4–9 e in `Scena.test.tsx`;
  - le prove che leggevano le righe del tavolo leggono il riassunto `.solo-lettori`.

- [ ] **Passo 1: scrivere le prove che falliscono.**
  - `Scena.test.tsx` (jsdom, teatro vero con ciclo automatico e rAF finto):
    - montare in `StrictMode`, cambiare fotografia, smontare: nessun errore, nessun rAF in sospeso, la radice svuotata (punto 2 della revisione);
    - il riassunto contiene 'Gregge: ' e una riga per ogni giocatore;
    - `visibilitychange` porta un `allinea` 'subito' (spia sul teatro).
  - `App.test.tsx`:
    - **`niente sbirciate`** (punto 1 della revisione): nella partita a 3 esistente, per ogni fotografia registrata, `foto.mano` è non nullo solo quando a schermo c'è il pannello privato di `foto.posti[0].id`. Mentre è mostrato "Passa a" l'ultima fotografia ha `mano === null`;
    - `in basso chi ha il telefono`: dopo "Sono io" di Bea l'ultima fotografia ha `posti[0].id` di Bea. Dopo una schermata pubblica (lancio del dado) resta Bea;
    - `cassetto`: la maniglia abbassa il cassetto (`aria-expanded="false"`); dopo un'azione che cambia schermata è di nuovo su;
    - `prova`: nella partita di prova tutte le fotografie hanno `posti[0].id === 'g1'`;
    - `menu`: il menu della partita contiene l'interruttore 'Animazioni veloci';
    - le prove esistenti restano verdi, adattate dove leggevano il tavolo.
- [ ] **Passo 2: lanciarle e vederle fallire.**
- [ ] **Passo 3: scrivere `Scena.tsx`, le modifiche a `Partita.tsx`, CSS e testi.**
- [ ] **Passo 4: lanciare `npm test` e `npm run typecheck`.** Atteso: tutto verde.
- [ ] **Passo 5: prova nel browser** (`preview_start` del gioco, schermo 390×844):
  - una partita a 3 dall'inizio alla fine: passaggi, mano scoperta solo nel proprio turno, cassetto, agnellini che camminano dopo il Pascolo, ora del giorno che cambia;
  - una partita di prova fino a "Ora sai come si gioca!";
  - nessun errore in console;
  - foto nel registro.
- [ ] **Passo 6: registro.**

### Compito 12: Chiusura

**File:**
- Modificare: `CLAUDE.md` (struttura: `client/src/scena/` e `client/scena.html`), `bozze/passaggio-di-consegne.md`, `bozze/da-fare.md`.

- [ ] **Passo 1: aggiornare i documenti.**
  - `CLAUDE.md`:
    - una riga per `client/src/scena/` ("teatro della scena 2,5D: moduli dalla bozza, fotografia, allineamento");
    - una riga per `client/scena.html` ("solo sviluppo, non pubblicata: scena da sola, Prova eventi, banco di prova").
  - `da-fare.md`: spuntare il pezzo 1 e scrivere i pezzi 2–4 come voci.
  - `passaggio-di-consegne.md`: sezione "Scena nel gioco, pezzo 1".
- [ ] **Passo 2: verifica finale.** `npm test`, `npm run typecheck`, `npm run build`. Atteso: tutto verde, build senza pagine di sviluppo.
- [ ] **Passo 3: registro**, poi revisione finale secondo la skill di esecuzione.

---

## Copertura del progetto

| Progetto | Compito |
|---|---|
| quattro pezzi, scelte dell'utente | (contesto, nessun codice) |
| scena al posto del tavolo, partita e prova | 11 |
| prato, cielo, sole, nuvole, vento | 4 |
| pecore, recinti, agnellini veri, gregge con cartello | 5, 7 |
| tovaglia: mazzi, scarti, Guaio del round, dado fermo | 7 |
| angoli, sterrati, carte coperte e scoperte del round | 7 |
| mano: tocca, tieni premuto, trascinare non gioca | 6 |
| cartelli e targhe, segnalini, eliminati, fuori dal round | 7 |
| ora del giorno (anche ultimo round) | 2, 4 |
| in alto: intestazione e cronaca | 11 |
| menu unico con Opzioni | 10, 11 |
| cassetto con maniglia | 11 |
| mettersi in pari con calma o subito, verità del motore | 5, 8 |
| passaggio: ridisposizione dietro "Passa a" | 8, 11 |
| Riduci movimento | 1, 3 (`ridotto`) |
| varianti dei recinti e sosta | 10 |
| teatro a moduli, regole finte non portate | 1–9 |
| disposizioni come dati per posto | 1 |
| fotografia | 2 |
| agnellini in registro, cervello e corpo | 5 |
| carte dal catalogo, illustrazioni, ripieghi | 6 |
| `Scena.tsx`, stanze invariate, accessibilità, testi | 11 |
| pagina di sviluppo e Prova eventi, bozza lasciata com'è | 10 |
| ordini per la regia | 9 |
| prove automatiche, prove nel browser, revisione | ogni compito, 10, 11, 12 |
