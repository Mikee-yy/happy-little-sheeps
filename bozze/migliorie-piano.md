# Migliorie A e B: piano di lavoro

> **Per chi esegue:** sotto-skill richiesta: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un compito alla volta. I passi usano le caselle (`- [ ]`).

**Obiettivo:** realizzare le parti A (bozza della scena) e B (riassunto nel gioco) di `bozze/migliorie-progetto.md`.

**Architettura:**
- **Parte B:** è React nel gioco vero, con test Vitest e Testing Library come quelli esistenti.
- **Parte A:** tocca solo `bozze/scena/scena.src.html`, uno script unico senza moduli. Lì i test sono script lanciati nella pagina dal browser interno, raccolti in `bozze/scena/prove.js`. Usano un orologio finto che fa avanzare la scena anche con la finestra in sottofondo.
- **Orologio unico:** tutti i timer degli eventi passano da un orologio della scena con una velocità. Le animazioni WAAPI degli eventi ricevono la stessa velocità tramite `playbackRate`.

**Tecnologie:**
- TypeScript, React, Vitest e Testing Library per `client/`;
- JavaScript puro con SVG, WAAPI e Canvas per la bozza;
- Node di VS Code tramite `.tools/bin`.

**Progetto:** `bozze/migliorie-progetto.md` (leggerlo prima di iniziare).

## Vincoli generali

- **Nessun commit, push o Artifact.** `bozze/` resta fuori da git: non fare mai `git add` di file in `bozze/`. Al posto del passo "Commit" c'è "Nessun commit".
- **Node:** in Bash, `export PATH="$PWD/.tools/bin:$PATH"` dalla radice del progetto. Niente installazioni, niente dipendenze nuove.
- **Lingua:** nomi, commenti e testi visibili in italiano. Nel gioco vero tutte le stringhe stanno in `client/src/testi.ts`.
- **Bozza:** si modifica solo `bozze/scena/scena.src.html`, mai `scena.html` (lo genera `costruisci.cjs`).
- **Motore:** il motore (`engine/`) non si tocca.
- **Valori del progetto:**
  - velocità 1 normale, 2 animazioni veloci, 6 salto;
  - passo massimo della simulazione 50 ms;
  - riposo dopo 20 s, a 20 aggiornamenti al secondo;
  - modo leggero dopo 5 s di fila sotto i 30 fotogrammi al secondo: 60 particelle al massimo, erba e nuvole a 15 aggiornamenti al secondo;
  - misura dito D = max(S, min(larghezza/390, 1,25·S));
  - ritmi di vibrazione: Guaio [60, 50, 60], Beee-NO! [140], vittoria [80, 60, 80, 60, 220];
  - chiavi di salvataggio `hls-opzioni` e `hls-consigli-visti`.

## Punti da sorvegliare

1. **Salto durante lo zoom su un avversario** (nei 1250 ms prima che parta il meteo): lo zoom deve finire e `sgancia()` deve riportare recinto e postazioni esattamente come prima. Test nel compito 4.
2. **Meteo nuovo durante un salto:** il precedente si ferma e pulisce, il nuovo parte a velocità 6 e finisce pulito, senza agnellini intrappolati. Test nel compito 4.
3. **Pagina nascosta durante un evento e poi ripresa** (buco di 10 s): l'orologio della scena avanza al massimo di 1000 ms reali per fotogramma, nessuna raffica di timer, l'evento finisce. Test nel compito 3.
4. **Salvataggio che dà errore** (navigazione privata, `localStorage` che lancia): valgono le opzioni predefinite e la pagina parte comunque. Test nel compito 5.
5. **Schermo che cambia misura con una carta sollevata** (telefono girato): la carta sollevata e i pulsanti "Gioca/Rimetti" restano allineati. Test nel compito 7.

---

### Compito 1: riassunto e collegamento alle Regole (parte B)

**File:**
- Modifica: `client/src/testi.ts` (nuovo blocco `riassunto` in `T`)
- Modifica: `client/src/schermate.tsx` (nuovo componente `Riassunto`; `Preparazione` con scelte controllate dall'esterno e `onRegole`)
- Modifica: `client/src/remoto/Stanza.tsx` (`SalaAttesa` riceve `onRegole` e mostra `Riassunto`)
- Modifica: `client/src/App.tsx` (scelte della preparazione tenute in `App`; `regole('preparazione')` torna in preparazione)
- Modifica: `client/src/stile.css` (stile `.riassunto`, coerente con `.regole`)
- Test: `client/src/App.test.tsx`, `client/src/remoto/Stanza.test.tsx`

**Interfacce:**
- Produce:
  - `T.riassunto = { titolo: string; righe: readonly string[]; tutte: string }`. Il testo è quello del progetto, sezione B. Le parti in grassetto del progetto diventano un elemento `<strong>`: ogni riga è `{ forte: string; resto: string }`.
  - `export function Riassunto({ onRegole }: { onRegole: () => void }): JSX.Element` in `schermate.tsx`. Disegna `<section className="riassunto">` con `<h2>`, `<ul>` di 7 `<li>` e `<button type="button" className="link">{T.riassunto.tutte}</button>`.
  - `export type SceltePreparazione = { quanti: number; nomi: string[]; pecore: IdPecora[] }` in `schermate.tsx`.
- Modifica:
  - `Preparazione` riceve `scelte: SceltePreparazione`, `onScelte: (s: SceltePreparazione) => void` e `onRegole: () => void`, e smette di usare `useState` per quelle tre cose.
  - `Schermata` accetta `'preparazione'` come ritorno da `dopoRegole`.

- [ ] **Passo 1: scrivere i test che falliscono.** In `App.test.tsx` aggiungere un `describe('Riassunto e regole')`:

```tsx
it('la preparazione mostra il riassunto; dalle Regole si torna con le scelte intatte', async () => {
  render(<App />);
  await clic(pulsante('Gioca su questo dispositivo'));
  expect(document.querySelector('.riassunto h2')?.textContent).toBe('Come si gioca, in breve');
  expect(document.querySelectorAll('.riassunto li')).toHaveLength(7);
  await clic(pulsante('4'));
  fireEvent.change(document.querySelector('input[aria-label="Nome 1"]')!, { target: { value: 'Ada' } });
  const radio = document.querySelectorAll('.giocatore-prep')[0]!.querySelectorAll('[role=radio]')[2]!;
  await clic(radio);
  await clic(pulsante('Leggi tutte le regole'));
  expect(document.querySelector('.regole h1')?.textContent).toBe('Regole');
  await clic(pulsante('Indietro'));
  expect(document.querySelectorAll('.giocatore-prep')).toHaveLength(4);
  expect((document.querySelector('input[aria-label="Nome 1"]') as HTMLInputElement).value).toBe('Ada');
  expect(document.querySelectorAll('.giocatore-prep')[0]!.querySelectorAll('[role=radio]')[2]!.getAttribute('aria-checked')).toBe('true');
});
```

In `Stanza.test.tsx` aggiungere, nel `describe` che contiene "nel velo di pausa":

```tsx
it("la sala d'attesa mostra il riassunto e il collegamento alle Regole", async () => {
  const rete = new ArchivioMemoria();
  const host = await SessioneHost.crea(rete.dispositivo('u1'), archivioInMemoria(), { nome: 'Ada', pecora: 'ricciolo', gettone: 'a' });
  await aspetta();
  let regole = 0;
  const isc: Iscrizione = { codice: host.codice, ruolo: 'host', idGiocatore: host.idGiocatore, nome: 'Ada', pecora: 'ricciolo', gettone: 'a' };
  render(<Stanza sessione={host} iscrizione={isc} onEsci={() => {}} onRegole={() => regole++} />);
  await aspetta();
  expect(document.querySelector('.sala .riassunto h2')?.textContent).toBe('Come si gioca, in breve');
  await clic(pulsanteIn(document.body, 'Leggi tutte le regole'));
  expect(regole).toBe(1);
});
```

Se il test per il ritorno nella stanza da App è troppo pesante (serve Firebase finto), basta il test qui sopra. Il ritorno lo garantisce il ramo `dopoRegole === 'stanza' && stanza`, già esistente: va solo verificato che `SalaAttesa` riceva `p.onRegole` da `Stanza`.

- [ ] **Passo 2: lanciare i test e vederli fallire.**
  - Comando: `npx vitest run client/src/App.test.tsx client/src/remoto/Stanza.test.tsx`
  - Atteso: i due test nuovi FALLISCONO perché non trovano `.riassunto`. Tutti gli altri passano.

- [ ] **Passo 3: realizzare il riassunto.**
  - **Testi:** in `testi.ts`, con il testo esatto del progetto. Il collegamento è "Leggi tutte le regole ›".
  - **`Preparazione`:** il riassunto va in fondo, dopo il pulsante "Indietro".
  - **`SalaAttesa`:** il riassunto va in fondo, dopo "Esci".
  - **`App.tsx`:**
    - uno `useState<SceltePreparazione>` con i valori iniziali di oggi: 3 giocatori, nomi vuoti, pecore nell'ordine di `SETUP.pecore`;
    - il ramo `regole` restituisce `'preparazione'` quando `dopoRegole === 'preparazione'`;
    - "Indietro" dalla preparazione verso la Home azzera le scelte;
    - la rivincita con `onRigioca` non cambia.
  - **Stile:** `.riassunto` riusa la tipografia di `.regole section`, con un margine sopra che lo separa dai pulsanti.

- [ ] **Passo 4: lanciare tutti i test e il controllo dei tipi.**
  - Comando: `npm test && npm run typecheck`
  - Atteso: tutti verdi, cioè 789 + 2 test; il controllo dei tipi senza errori.

- [ ] **Passo 5: controllo a vista.**
  - `preview_start` con `{name: "gioco"}`, misura 360×640;
  - aprire "Gioca su questo dispositivo" e scorrere in fondo;
  - foto del riassunto;
  - nessuno scorrimento orizzontale: `document.documentElement.scrollWidth <= 360`.

- [ ] **Passo 6: nessun commit.**

---

### Compito 2: banco di prova della bozza (`prove.js`) e prova di partenza

**File:**
- Crea: `bozze/scena/prove.js`
- Modifica: `bozze/scena/server.cjs`:
  - serve `/prove.js` con `Content-Type: text/javascript; charset=utf-8` e `Cache-Control: no-store`;
  - la porta diventa `Number(process.env.PORT || process.env.PORTA || 5180)`.
- Modifica: `.claude/launch.json`: `"autoPort": true` nella configurazione "bozza-scena". La porta 5180 è occupata dal server di un'altra chat.

**Interfacce:**
- Produce `window.PROVE`, caricato con `await import('/prove.js?' + Date.now())`, con:
  - `installaOrologio(): void`: orologio finto, ripreso dallo script della vecchia chat.
    - Sostituisce `performance.now`, `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval` e `requestAnimationFrame`.
    - Porta avanti le animazioni WAAPI con `a.currentTime += (passo) * a.playbackRate`, non con `O.t - t0`, così rispetta la velocità.
    - Avvolge `ciclo` in modo che venga chiamato solo con il tempo finto.
  - `vai(secondi: number, passoMs = 33): Promise<void>`
  - `fotografia(): { agnelli: number; perArea: Record<string, number>; intrappolati: number; fuori: number; inRegia: number; zoom: number; postazioniNascoste: number; errori: string[] }`
    - `fuori`: agnellini fuori dal rettangolo della loro area;
    - `zoom`: `zoomCamera()`;
    - `postazioniNascoste`: elementi ancora sfumati da `sfuma`.
  - `casoMeteo(id: string, chi: string, n: 2 | 3 | 4, modo: 'normale' | 'veloci' | 'salto'): Promise<{ durataMs: number; prima: Foto; dopo: Foto }>`
    - Cambia giocatori se serve, lancia `guaio(id, chi)`, aspetta la fine e misura la durata in tempo finto.
    - Fine vuol dire `meteoAttivo === null` e nessun agnellino in viaggio. Dal compito 4 vuol dire `!eventoInCorso()`.
    - In modo `'veloci'` imposta `OPZIONI.veloci = true` per la durata del caso e poi lo rimette com'era.
    - In modo `'salto'`, a metà della durata attesa chiama `saltaEvento()`.
    - I modi `'veloci'` e `'salto'` funzionano solo dal compito 4 in poi. Prima, `casoMeteo` li rifiuta con un errore chiaro.
  - `provaCompleta(modo): Promise<{ casi: number; falliti: Array<{ id: string; chi: string; n: number; motivo: string }>; durate: Record<string, [number, number]> }>`
    - 8 eventi (i 7 meteo di `METEO_PROVA` più `lupo-vegetariano`), ogni bersaglio di `TUTTI`, con 2, 3 e 4 giocatori: 72 casi.
    - Un caso fallisce se, dopo, `errori` non è vuoto, se il totale degli agnellini è cambiato (36, 45 o 44), se `intrappolati`, `fuori` o `inRegia` sono maggiori di 0, se lo zoom non è 1, se ci sono postazioni nascoste, o se la durata supera 25 s.
  - `misura(w: number, h: number): void`: imposta la misura dello schermo per i compiti 7 e 8, con `resize_window` dal browser interno. Questa funzione rilegge solo i valori.

- [ ] **Passo 1: scrivere `prove.js` e la rotta del server.**
  - **Errori:** gli errori della pagina si raccolgono con `window.addEventListener('error', …)` e con un `console.error` sostituito.
  - **Fine di un caso:** finché la scena non ha `eventoInCorso`, `casoMeteo` considera finito l'evento quando `meteoAttivo === null` e non ci sono agnellini con `stato` `corre` o `vola`, controllando ogni 100 ms di tempo finto.

- [ ] **Passo 2: avviare l'anteprima e caricare il banco.**
  - `preview_start` con `{name: "bozza-scena"}`;
  - poi `javascript_tool`: `await import('/prove.js?'+Date.now()); PROVE.installaOrologio(); 'ok'`
  - Atteso: `"ok"`, e nessun errore in `read_console_messages`.

- [ ] **Passo 3: prova di partenza sul codice di oggi.**
  - `javascript_tool`: `JSON.stringify(await PROVE.provaCompleta('normale'))`
  - Atteso: `casi: 72` e `falliti: []`. Le durate devono stare negli intervalli della tabella del passaggio di consegne (per esempio la nebbia 17–18,5 s e la pioggia 11,5–14 s).
  - Annotare le durate in fondo a questo piano: sono il riferimento per il compito 4.

- [ ] **Passo 4: nessun commit.**

---

### Compito 3: orologio unico della scena (senza cambiare niente di visibile)

**File:**
- Modifica: `bozze/scena/scena.src.html`:
  - riga 314 (`attesa`);
  - `ciclo` (riga ~1362);
  - i timer degli eventi elencati sotto;
  - una nuova sezione "Orologio della scena" subito dopo "Scala della scena".

**Interfacce:**
- Produce:
  - `const OROLOGIO = { ms: 0, velocita: 1, timer: new Map(), prossimo: 1 }`
  - `dopo(ms: number, fn: () => void): number`, `ogni(ms: number, fn: () => void): number`, `annulla(id: number): void`
  - `attesa(ms: number): Promise<void>`: ora sull'orologio della scena;
  - `attesaVera(ms: number): Promise<void>`: quella di prima, sul tempo vero;
  - `avanzaOrologio(msReali: number): void`. Aggiunge `min(max(msReali, 0), 1000) * OROLOGIO.velocita` a `OROLOGIO.ms`, poi esegue in ordine di scadenza i timer scaduti. Un `ogni` si ripianifica.
  - `const ANIMAZIONI_SCENA = new Set()` e `inInterfaccia(el: Element): boolean`, vero se `el.closest('#mano, #hud, #opzioni, #eventi, #azioni-carta, #lettura, #finale')`.
  - Sostituzione di `Element.prototype.animate`, installata una volta sola. Se l'elemento non è `inInterfaccia`:
    - imposta `playbackRate = OROLOGIO.velocita`;
    - aggiunge l'animazione a `ANIMAZIONI_SCENA`;
    - la toglie con `finish` e `cancel`.
  - `impostaVelocita(v: number): void`. Se cambia, aggiorna `OROLOGIO.velocita` e chiama `updatePlaybackRate(v)` su ogni animazione di `ANIMAZIONI_SCENA`.
- Modifica `ciclo(ora)`:
  - `dtReale = (ora - ultimo) / 1000`;
  - `avanzaOrologio(dtReale * 1000)`;
  - poi la simulazione si divide in `passi = max(1, ceil(dtReale * velocita / 0.05))` sotto-passi, ognuno con `dt = min(0.05, dtReale * velocita / passi)`;
  - ogni sotto-passo esegue, nello stesso ordine di oggi, tutto quello che oggi segue `T += dt`: vento, meteo, sole, nuvole/flora a 30 al secondo, tween, pecore, agnellini, giochi, particelle;
  - `aggiornaFumetti()` una volta per fotogramma.

**Quali timer cambiano:**
- **Passano a `dopo`, `ogni`, `annulla` o alla nuova `attesa`** (tutti quelli degli eventi): righe 1759, 1773, 1777, 1787, 1840, 1845, 1852, 1853, 1886, 1898, 1905, 1918, 2072, 2118, 2136, 2147, 2148, 2151, 2171, 2191, 2200, 2225, 2239, 2272, 2279, 2281, 2289, 2307, 2326, 2345, 2351, 2389, 2393.
- **Restano sul tempo vero**, con `setTimeout` o `attesaVera`:
  - 357 (campanaccio di sfondo);
  - 1277–1329 (giochi degli agnellini, che sono sfondo);
  - 1703, 1708, 1712 (pressione lunga sulla carta);
  - 2367, 2368 (suggerimenti);
  - 2417 (avvio);
  - 2452 (caratteri).
- I numeri di riga sono quelli di oggi: cercare le chiamate, non fidarsi del numero.

- [ ] **Passo 1: aggiungere a `prove.js` il test che fallisce.** `provaOrologio(): Promise<string[]>` controlla che:
  - `typeof dopo === 'function'`;
  - un `dopo(500, f)` con velocità 2 scatta dopo 250 ms di tempo finto;
  - un `ogni(100, f)` scatta 10 volte in 1 s a velocità 1;
  - `annulla` lo ferma;
  - una `div.animate(...)` dentro `#mondo` ha `playbackRate === OROLOGIO.velocita`, e una dentro `#mano` ha 1;
  - con un buco di 10 s (un solo passo da 10 000 ms) `OROLOGIO.ms` cresce di 1000 al massimo, senza errori.

  Restituisce l'elenco dei controlli falliti.

- [ ] **Passo 2: lanciarlo e vederlo fallire.**
  - `javascript_tool`: `await import('/prove.js?'+Date.now()); PROVE.installaOrologio(); JSON.stringify(await PROVE.provaOrologio())`
  - Atteso: un elenco non vuoto, che comincia con "dopo non esiste".

- [ ] **Passo 3: realizzare l'orologio e spostare i timer** come indicato sopra. `impostaVelocita` resta sempre a 1 in questo compito.

- [ ] **Passo 4: test dell'orologio e prova completa.**
  - `JSON.stringify(await PROVE.provaOrologio())`. Atteso: `[]`.
  - Ricaricare la pagina, poi `JSON.stringify(await PROVE.provaCompleta('normale'))`. Atteso: 72 casi, `falliti: []`, durate entro ±0,5 s da quelle annotate nel compito 2.

- [ ] **Passo 5: nessun commit.**

---

### Compito 4: eventi in corso, salto e animazioni veloci

**File:**
- Modifica: `bozze/scena/scena.src.html`:
  - nuova sezione "Regia degli eventi" dopo l'orologio;
  - funzioni `guaio`, `beeeNoDi`, `gioca`, `tiraDado`, `furto`, `rubaA`, `vittoria`, `distribuisci`;
  - `Agnello.vaiIn` e il suo arrivo;
  - `suona`;
  - l'ascolto dei tocchi in `avvia`.

**Interfacce:**
- Consuma: `impostaVelocita`, `OROLOGIO` (compito 3).
- Produce:
  - `const REGIA = { aperti: 0, salto: false }` e `const IN_VIAGGIO = new Set()`. Un agnellino entra in `IN_VIAGGIO` quando parte con `vaiIn` ed esce all'arrivo, o quando viene tolto o messo in regia.
  - `apriEvento(nome: string): () => void`: incrementa `REGIA.aperti` e restituisce una funzione `chiudi` che si può chiamare più volte. Va usata così:

    ```js
    const chiudi = apriEvento('guaio'); try { … } finally { chiudi(); }
    ```

  - `eventoInCorso(): boolean`. È vero se `REGIA.aperti > 0`, oppure `meteoAttivo !== null`, oppure `OROLOGIO.timer.size > 0`, oppure `IN_VIAGGIO.size > 0`. Gli `ogni` del meteo contano: vengono annullati da `m.pulisci`.
  - `velocitaScena(): number`: `!eventoInCorso() ? 1 : REGIA.salto ? 6 : OPZIONI.veloci ? 2 : 1`. Fino al compito 5, `OPZIONI` è un semplice `{ veloci: false }` provvisorio, in cima allo script.
  - `saltaEvento(): void`: imposta `REGIA.salto = true` se `eventoInCorso()`.
  - In `ciclo`:
    - all'inizio di ogni fotogramma `impostaVelocita(velocitaScena())`;
    - a fine fotogramma, se `!eventoInCorso()`, `REGIA.salto = false`.
  - In `suona`: se `REGIA.salto` è vero, non suona niente.
  - Tocco per saltare: in `avvia`, `scena.addEventListener('pointerdown', fn, true)` (in fase di cattura). Se `eventoInCorso()` e il tocco non è su `inInterfaccia(e.target)` né su `#mazzo`, `#mazzo-guai`, `#dado-pos` o `#scarti`, chiama `saltaEvento()`. Non ferma la propagazione.

- [ ] **Passo 1: aggiungere a `prove.js` i test che falliscono.** `provaSalto(): Promise<string[]>` controlla:
  - **(a)** `typeof eventoInCorso === 'function'`;
  - **(b)** dopo `guaio('nebbia-fitta', 'io')`, `eventoInCorso()` è vero subito e falso alla fine;
  - **(c)** con `OPZIONI.veloci = true`, la nebbia dura il 45–60% della durata di riferimento del compito 2;
  - **(d)** `guaio('lupo-vegetariano', 'bea')`, poi `saltaEvento()` dopo 600 ms (durante lo zoom): finisce entro 3 s di tempo finto e la fotografia è pulita (Punto da sorvegliare 1);
  - **(e)** `guaio('pioggia-di-traverso', 'io')`, poi `saltaEvento()` a 2 s e `guaio('pozzanghera-senza-fondo', 'io')` a 2,3 s: la fotografia finale è pulita, senza intrappolati (Punto 2);
  - **(f)** fuori dagli eventi la velocità resta 1 anche con `REGIA.salto = true` impostato a mano: alla fine del fotogramma torna `false`;
  - **(g)** mentre si salta, `suona('beee')` non chiama `Suono.beee`, controllato con una spia.

- [ ] **Passo 2: lanciarlo e vederlo fallire.**
  - `JSON.stringify(await PROVE.provaSalto())`
  - Atteso: elenco non vuoto, che comincia con "eventoInCorso non esiste".

- [ ] **Passo 3: realizzare la regia, la velocità, il salto e il silenzio** come indicato sopra.

- [ ] **Passo 4: test del salto e prove complete nei tre modi.**
  - `provaSalto()`. Atteso: `[]`.
  - Poi, ricaricando la pagina tra una prova e l'altra, `provaCompleta('normale')`, `provaCompleta('veloci')` e `provaCompleta('salto')`. Atteso: ogni volta 72 casi e `falliti: []`.
  - In `'veloci'` le durate sono circa la metà di quelle di riferimento: tra il 45% e il 60%, perché lo zoom e le parti fuori dall'evento non accelerano tutte. In `'salto'` ogni caso finisce entro 4 s dal salto.

- [ ] **Passo 5: nessun commit.**

---

### Compito 5: menu Opzioni, salvataggio e suggerimenti alla prima apertura

**File:**
- Modifica: `bozze/scena/scena.src.html`:
  - HTML del `#hud`: `#suoni` diventa `<button class="btn" id="apri-opzioni" type="button" aria-expanded="false">Opzioni</button>`, più un nuovo `<div id="opzioni" hidden>`;
  - CSS: il riquadro `#opzioni`, nello stile di `#eventi`, ma sotto il pulsante a sinistra;
  - l'ascolto in `avvia`;
  - `nascondiConsiglio`.

**Interfacce:**
- Produce:
  - `const CHIAVE_OPZIONI = 'hls-opzioni'`, `const CHIAVE_CONSIGLI = 'hls-consigli-visti'`.
  - `leggiOpzioni(): { suoni: boolean, vibrazione: boolean, veloci: boolean }`. I valori predefiniti sono `{ suoni: false, vibrazione: true, veloci: false }`. Ogni lettura sta in un `try/catch`; un JSON rotto vale come predefinito. Sostituisce l'`OPZIONI` provvisorio: `let OPZIONI = leggiOpzioni()`.
  - `salvaOpzioni(): void` (in `try/catch`).
  - `disegnaOpzioni(): void`: tre interruttori `<button role="switch" aria-checked>` (Suoni, Vibrazione, Animazioni veloci) e il pulsante "Rivedi i suggerimenti".
    - La riga Vibrazione c'è solo se `PUO_VIBRARE`, che definisce il compito 6. Fino ad allora vale `const PUO_VIBRARE = typeof navigator.vibrate === 'function'`.
    - I testi delle righe sono "Suoni", "Vibrazione", "Animazioni veloci", "Rivedi i suggerimenti"; lo stato è "sì" o "no".
  - `rivediSuggerimenti(): void`: toglie `CHIAVE_CONSIGLI`, rimette `passoConsiglio = 0` e mostra `CONSIGLI[0]`.
  - Suggerimenti alla prima apertura:
    - quando `nascondiConsiglio` arriva alla fine, salva `CHIAVE_CONSIGLI = '1'`;
    - all'avvio, se la chiave c'è, `passoConsiglio = CONSIGLI.length` e `#consiglio` resta nascosto.
  - Suoni salvati come accesi: al primo `pointerdown` sulla pagina (con `{ once: true }`) si chiama `Suono.accendi()`.

- [ ] **Passo 1: aggiungere a `prove.js` il test che fallisce.** `provaOpzioni(): Promise<string[]>` controlla:
  - **(a)** `#apri-opzioni` c'è e `#suoni` non c'è più;
  - **(b)** un clic su "Animazioni veloci" porta `OPZIONI.veloci` a `true` e il JSON di `localStorage` a `veloci: true`;
  - **(c)** con `localStorage.getItem` e `setItem` sostituiti da funzioni che lanciano un errore, `leggiOpzioni()` restituisce i valori predefiniti e `salvaOpzioni()` non lancia (Punto da sorvegliare 4);
  - **(d)** con `'{rotto'` salvato, `leggiOpzioni()` dà i valori predefiniti;
  - **(e)** con `CHIAVE_CONSIGLI` salvata, dopo `nascondiConsiglio` `#consiglio` resta trasparente; dopo `rivediSuggerimenti()` mostra il primo suggerimento;
  - **(f)** la riga Vibrazione c'è se e solo se `PUO_VIBRARE`.

  Il test rimette a posto `localStorage` alla fine.

- [ ] **Passo 2: lanciarlo e vederlo fallire.** Atteso: comincia con "manca #apri-opzioni".

- [ ] **Passo 3: realizzare il menu**, come indicato sopra.

- [ ] **Passo 4: verificare.**
  - `provaOpzioni()`. Atteso: `[]`.
  - Ricaricare con `veloci` salvato a `true`: `OPZIONI.veloci === true` subito dopo il caricamento.
  - Foto del menu aperto a 390×844.

- [ ] **Passo 5: nessun commit.**

---

### Compito 6: vibrazione

**File:**
- Modifica: `bozze/scena/scena.src.html`:
  - nuova funzione vicino ai suoni;
  - chiamate in `guaio` (quando `chi === 'io'`, nel punto di `suona('tonfo')`), `beeeNo()` e `vittoria` (quando `chi === 'io'`).

**Interfacce:**
- Consuma: `OPZIONI`, `PUO_VIBRARE` (compito 5).
- Produce:
  - `const RITMI = { guaio: [60, 50, 60], beeeNo: [140], vittoria: [80, 60, 80, 60, 220] }`
  - `vibra(nome: 'guaio' | 'beeeNo' | 'vittoria'): void`. Non fa niente se manca `PUO_VIBRARE`, se `OPZIONI.vibrazione` è falso o se `REGIA.salto` è vero. Altrimenti chiama `navigator.vibrate(RITMI[nome])` dentro un `try/catch`.

- [ ] **Passo 1: aggiungere a `prove.js` il test che fallisce.** `provaVibrazione(): Promise<string[]>` sostituisce `navigator.vibrate` con una spia che registra i ritmi, poi controlla:
  - `guaio('lupo-vegetariano', 'io')` → `[[60, 50, 60]]`;
  - `guaio('lupo-vegetariano', 'bea')` → nessuna vibrazione;
  - `beeeNoDi('bea')` → `[[140]]`;
  - `vittoria('io')` → l'ultimo ritmo è `[80, 60, 80, 60, 220]`;
  - con `OPZIONI.vibrazione = false` → nessuna chiamata.

  Dopo `vittoria`, il test chiama `ricomincia()` e aspetta che la distribuzione sia finita.

- [ ] **Passo 2: lanciarlo e vederlo fallire.** Atteso: "vibra non esiste".

- [ ] **Passo 3: realizzare `vibra`** e le tre chiamate.

- [ ] **Passo 4: verificare.** `provaVibrazione()`. Atteso: `[]`.

- [ ] **Passo 5: nessun commit.**

---

### Compito 7: mano a misura di dito

**File:**
- Modifica: `bozze/scena/scena.src.html`:
  - `adatta()` (riga ~319) e `puntatore`;
  - CSS di `#mano`, `#azioni-carta`, `#hud`, `#consiglio`, `#opzioni`, `#eventi`, `#lettura .grande`, `#lettura span`, `#finale .pannello`;
  - `collegaCarta` (trascinamento);
  - `pesca`, `gioca`, `beeeNoDi` (punti della mano);
  - `fumetto` e `aggiornaFumetti`.

**Interfacce:**
- Produce:
  - `misuraDito(w: number, h: number): { S: number, D: number }`, funzione pura: `S = min(w/390, h/844)`, `D = max(S, min(w/390, 1.25*S))`.
  - `let KD = 1`, che vale `D / S`. `adatta()` lo calcola e lo scrive come variabile CSS `--kd` su `#scena`.
  - Ingrandimento nel CSS:
    - `#mano` usa `transform: scale(var(--kd)); transform-origin: 195px 844px`;
    - `#azioni-carta` usa lo stesso centro, espresso nelle sue coordinate: `transform-origin: 195px 216px`, perché sta a `top: 628px`;
    - `#hud`, `#consiglio`, `#opzioni` e `#eventi` si allargano dall'alto, mantenendo il loro lato;
    - `#lettura .grande` e `#lettura span` dal centro in basso;
    - `#finale .pannello` dal centro.
  - `manoInScena(p): p` e `scenaInMano(p): p`, per i punti `{x, y, k}`:
    - `manoInScena`: x → `195 + (x-195)*KD`, y → `844 + (y-844)*KD`, k → `k*KD`;
    - `scenaInMano` fa l'inverso.
  - Dove si usano:
    - `pesca`: l'arrivo del volo è `manoInScena(posizioneMano(...))`;
    - `gioca`: la partenza è `manoInScena(centroDa(p))`;
    - `beeeNoDi('io')`: `da = manoInScena({x:195,y:800,k:0.37,f:0})`;
    - trascinamento in `collegaCarta`: la posizione della carta è `scenaInMano(puntatore(e))`, mentre il test `p.y < 640` per giocarla usa `puntatore(e)` nelle coordinate della scena.
  - Fumetti: `scale = KD / zoomCamera()`. Il controllo dei bordi usa `w * KD`.
  - Contatore del recinto: se a 360×640 il cartello del mio recinto è coperto dalla mano, alzarlo modificando i dati dell'area `io` in `DISPOSIZIONI`. Il controllo: il suo rettangolo non si sovrappone a quello della carta di mano più alta.

- [ ] **Passo 1: aggiungere a `prove.js` il test che fallisce.** `provaDito(): Promise<string[]>` controlla:
  - **(a)** `misuraDito(360, 640)` dà S ≈ 0,758 e D ≈ 0,923; `misuraDito(390, 660)` dà D ≈ 0,977; `misuraDito(390, 844)` dà S = D = 1; `misuraDito(800, 360)` dà D = 1,25·S;
  - **(b)** alla misura attuale, la carta più a sinistra e quella più a destra della mano stanno dentro lo schermo (`getBoundingClientRect`);
  - **(c)** un trascinamento simulato con `pointerdown`, `pointermove` e `pointerup` sulla prima carta, fino al centro della tovaglia: la carta viene giocata (una carta in meno in `st.mano`), e durante il movimento il centro della carta sta entro 20 px dal dito;
  - **(d)** dopo `fumetto('bea', 'Prova di fumetto lungo')`, il fumetto sta dentro lo schermo;
  - **(e)** con una carta sollevata (`st.attiva`), dopo un cambio di misura con `adatta()`, il centro orizzontale di `#azioni-carta` dista meno di 10 px da quello della carta sollevata, e i pulsanti stanno sotto la carta (Punto da sorvegliare 5);
  - **(f)** il cartello del mio recinto non è coperto da nessuna carta della mano.

- [ ] **Passo 2: lanciarlo a 360×640 e vederlo fallire.**
  - `resize_window` a 360×640, ricaricare, `JSON.stringify(await PROVE.provaDito())`.
  - Atteso: "misuraDito non esiste".

- [ ] **Passo 3: realizzare la mano a misura di dito**, come indicato sopra.

- [ ] **Passo 4: verificare su quattro misure.**
  - Per 360×640, 390×660, 390×844 e 1280×800:
    - `resize_window`, ricaricare;
    - `provaDito()`, atteso `[]`;
    - `document.documentElement.scrollWidth <= innerWidth`;
    - una foto.
  - Poi `resize_window` con `preset: "desktop"`.
  - Rifare `provaCompleta('normale')` a 390×844. Atteso: 72 casi e `falliti: []`.

- [ ] **Passo 5: nessun commit.**

---

### Compito 8: riposo e modo leggero

**File:**
- Modifica: `bozze/scena/scena.src.html`:
  - `ciclo`, `particella`, `aggiornaFlora` (il limite di 140 alla riga ~690);
  - CSS `.leggero .cm`, `.leggero .cm.attiva`, `.leggero .cm.trascinata`, `.leggero .volante`;
  - l'ascolto dei tocchi in `avvia`;
  - `apriEvento`.

**Interfacce:**
- Consuma: `eventoInCorso`, `apriEvento` (compito 4).
- Produce:
  - `const RISPARMIO = { ultimoTocco: 0, riposo: false, leggero: false, accumulo: 0, finestra: { inizio: 0, fotogrammi: 0 }, secondiLenti: 0 }`.
  - Riposo:
    - in `ciclo`, `riposo = !eventoInCorso() && ora - ultimoTocco > 20000`;
    - in riposo i fotogrammi si sommano in `accumulo` e la scena si aggiorna solo quando `accumulo >= 50` ms, con quel `dt`;
    - un `pointerdown` in fase di cattura su `window` aggiorna `ultimoTocco` e toglie il riposo;
    - anche `apriEvento` lo toglie.
  - Misura della fluidità:
    - solo fuori dal riposo e con la pagina visibile;
    - i fotogrammi con un salto di più di 250 ms si scartano e azzerano la finestra in corso;
    - a ogni secondo intero dall'inizio della finestra, se `fotogrammi < 30`, `secondiLenti++`, altrimenti `secondiLenti = 0`;
    - con `secondiLenti >= 5`: `RISPARMIO.leggero = true` e `#scena` riceve la classe `leggero`. Non torna indietro.
  - `limiteParticelle(): number`: 60 in modo leggero, 140 altrimenti.
    - Il limite della flora usa `limiteParticelle()`.
    - In modo leggero `particella()` scarta quella nuova se `PARTICELLE.length >= 60`; per i tipi `petalo`, `seme` e `foglia` la tiene solo con probabilità 0,5, per gli altri 0,7.
    - Flora e nuvole si aggiornano ogni `1/15` s in modo leggero invece di `1/30`.
  - CSS `.leggero`: le carte in mano e quelle in volo perdono il `filter: drop-shadow(...)` e prendono un `box-shadow` netto della stessa tinta (`0 7px 0 rgba(35,38,74,.22)`), con `border-radius` uguale a quello della carta SVG.

- [ ] **Passo 1: aggiungere a `prove.js` il test che fallisce.** `provaRisparmio(): Promise<string[]>` controlla, con l'orologio finto:
  - **(a)** `typeof RISPARMIO === 'object'`;
  - **(b)** dopo 21 s di tempo finto senza tocchi e senza eventi, `RISPARMIO.riposo` è vero e in 1 s ci sono al massimo 21 aggiornamenti della scena, contati avvolgendo `aggiornaVento`;
  - **(c)** un `pointerdown` su `#scena` toglie il riposo;
  - **(d)** con passi da 28 ms (circa 35 fotogrammi al secondo) per 7 s, `RISPARMIO.leggero` resta falso;
  - **(e)** con passi da 40 ms (25 al secondo) per 6 s, diventa vero e `#scena` ha la classe `leggero`;
  - **(f)** in modo leggero, dopo `guaio('gelata-di-agosto', 'io')`, `PARTICELLE.length` non supera mai 60;
  - **(g)** un passo singolo da 3000 ms (ritorno da un'altra scheda) non conta come secondo lento.

  Il test rimette `leggero = false` e toglie la classe alla fine.

- [ ] **Passo 2: lanciarlo e vederlo fallire.** Atteso: "RISPARMIO non esiste".

- [ ] **Passo 3: realizzare riposo e modo leggero**, come indicato sopra.

- [ ] **Passo 4: verificare.**
  - `provaRisparmio()`. Atteso: `[]`.
  - Poi `provaCompleta('normale')` con `RISPARMIO.leggero = true` e la classe impostati a mano prima di iniziare. Atteso: 72 casi e `falliti: []`.
  - Una foto in modo leggero con una carta sollevata, per vedere l'ombra semplice.

- [ ] **Passo 5: nessun commit.**

---

### Compito 9: verifica finale e passaggio di consegne

**File:**
- Modifica:
  - `bozze/passaggio-di-consegne.md`: sezione 4 (orologio, regia, opzioni, misura dito, risparmio, `prove.js`, autoPort) e sezione 7;
  - `bozze/punto-della-situazione.md`: le migliorie fatte escono da "Migliorie proposte";
  - la tabella delle durate, aggiungendo la colonna "veloci".

- [ ] **Passo 1: tutte le prove della bozza su una pagina appena caricata.**
  - Una per volta, ricaricando tra l'una e l'altra:
    - `provaOrologio`, `provaSalto`, `provaOpzioni`, `provaVibrazione`, `provaDito`, `provaRisparmio`;
    - `provaCompleta('normale')`, `provaCompleta('veloci')`, `provaCompleta('salto')`.
  - Atteso: tutte `[]`, oppure 72 casi con `falliti: []`.
  - Nessun errore in `read_console_messages`.

- [ ] **Passo 2: gioco vero.**
  - Comando: `npm test && npm run typecheck`.
  - Atteso: tutto verde.

- [ ] **Passo 3: con "Riduci movimento" attivo** (emulato a mano impostando `RIDOTTO = true` prima di `avvia`, se non si può emulare la preferenza): un Guaio meteo saltato e uno con le animazioni veloci finiscono senza errori.

- [ ] **Passo 4: aggiornare i due file di consegne.**

- [ ] **Passo 5: nessun commit.** Fermarsi e presentare all'utente un riassunto con le foto, come da regola delle fasi.

---

## Durate di riferimento (dal compito 2)

Da compilare durante il compito 2.

Misurate il 13 ottobre sul codice di partenza (72 casi, `falliti: []`), in secondi [min, max]:

| Meteo | Durata |
|---|---|
| Grandine | 7,9–9,2 |
| Pioggia | 11,9–14,1 |
| Vento | 5,5–6,7 |
| Nebbia | 17,2–18,5 |
| Fulmine | 7,3–10,9 |
| Gelata | 8,8–10,0 |
| Pozzanghera | 10,6–16,6 |
| Lupo | 6,0–7,3 |
