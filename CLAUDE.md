# Happy Little Sheeps

Gioco di carte nel browser per 2–4 giocatori. Brief canonico: `brief-codice2.md`. Specifica del motore e decisioni sui casi ambigui: `docs/motore.md`.

## Struttura

- `engine/` — motore puro in TypeScript: `src/` (codice), `data/` (`cards.json`, `setup.json`), `test/` (Vitest; aiuti in `test/aiuti.ts`).
- `design/` — pacchetto grafico definitivo (SVG, token, guida di stile). Non ridisegnare.
- `client/` — interfaccia React (Vite, radice `client/`): `src/partita/` modalità "Passa il telefono", `src/remoto/` più dispositivi, `src/testi.ts` tutte le stringhe. `client/prova.html` (solo sviluppo, non pubblicata): tre telefoni affiancati su un database in memoria.
- `client/src/scena/` — teatro della scena 2,5D: moduli ricavati dalla bozza, fotografia della partita, allineamento. Un solo punto d'accesso, `creaTeatro` (`teatro.ts`); React lo monta con `Scena.tsx`, caricata a parte.
- `client/src/scena/regia/` — la regia: `copione.ts` (funzione pura, eventi del motore → battute da recitare con la loro attesa) e `regista.ts` (le recita in fila con gli ordini del teatro e dice quando la scena è "occupata"; la partita aspetta solo i primi 5 s di un meteo).
- `client/src/scena/scelte/` — le scelte nella scena: `domanda.ts` (puro: dalla partita e dalle mosse permesse "la domanda di adesso", e dai gesti la mossa del motore; `tavolo.ts` per i momenti senza mano, `carte.ts` per quelli con la mano). Il teatro la mostra con `chiedi.ts` (zone sulle pecore, pulsanti, dado, carte grandi, agnellini del furto, nuvoletta del pensiero); `Partita` fa da ponte. I pannelli del cassetto restano solo come riserva se la scena non si carica, e per le stanze.
- `client/src/scena/fionda/` — la Testata a fionda nella scena: `tiro.ts` (calcolo puro: dal trascinamento la traiettoria, il punto d'arrivo e l'esito 0–3), `mira.ts` (la mira sul prato, montata da `chiedi.ts`: trascinamento, tastiera, scia, cerchi), numeri in `fionda.json`. Il riquadro di mira di prima (`client/src/partita/Testata.tsx`) resta solo nei pannelli di riserva.
- `client/src/partita/GiocoInScena.tsx` — il collegamento comune tra scena e domande, usato dalla partita su un dispositivo (`Partita.tsx`) e dalle stanze (`client/src/remoto/Stanza.tsx`). Nelle stanze chi ospita calcola scadenze, fasi automatiche e mosse dei bot con la durata normale delle animazioni (`client/src/scena/regia/durate.ts` + `durate.json`, passata a `SessioneHost` per iniezione: `sync/` non importa niente dal client).
- `client/src/regole/` — la schermata delle Regole: `Regole.tsx` (otto sezioni a fisarmonica; testi, figure ed esempi da `regole(nomi)` in `testi.ts`, numeri da `setup.json` e dal catalogo), `recinto.tsx` (le zone della Testata), `alternativi.ts` (testi alternativi delle figure), `ritorno.ts` (scorrimento e punto della tastiera al ritorno). Le carte disegnate arrivano a parte da `regole/carte.tsx` (import dinamico in `caricaCarte.ts`): la pagina iniziale non le scarica. Dalla stanza si aprono con `RegoleInStanza` (`client/src/remoto/Stanza.tsx`): riga "la partita va avanti" e richiamo quando tocca a te.
- `client/scena.html` — solo sviluppo, non pubblicata: scena da sola, pannello "Prova eventi", banco di prova.
- `sync/` — interfaccia `Sessione` con due implementazioni: `locale.ts` (un dispositivo) e `host.ts`/`ospite.ts` (stanze). Il servizio realtime sta dietro `Trasporto`: `trasporto-firebase.ts` (vero) e `trasporto-memoria.ts` (test, riproduce `database.rules.json`).
- `database.rules.json` — regole di accesso di Firebase, da incollare nella console (guida in `docs/firebase.md`).
- `docs/` — specifiche.
- `bozze/` — lavori in corso fuori dal sito: `scena/` (bozza della scena 2,5D: si modifica solo `scena.src.html`; anteprima con `server.cjs`, banco di prova `prove.js`), passaggio di consegne, piani e `da-fare.md` (la lista di ciò che resta).

## Comandi

Node.js non è installato: si usa quello incluso in VS Code tramite gli shim in `.tools/bin` (non versionati). In Bash:

```bash
export PATH="$PWD/.tools/bin:$PATH"
npm test                      # tutti i test
npx vitest run engine/test/dado.test.ts   # un solo file
npm run typecheck
npm run simula -- --partite 1000            # simulatore: rapporto in docs/rapporto-simulatore.md
npm run simula -- --variante brief-originale # confronto con i numeri di partenza del brief (engine/sim/varianti.ts)
npm run esperimenti -- --giocatori 3        # griglia posti dell'Ovile × dado
```

`npm test`, `npm run typecheck`, `npm run build` e `npx vitest|tsc|vite|tsx` passano dalle scorciatoie di `.tools/bin`, che lanciano il programma direttamente (niente finestre di terminale). Vitest usa i fili (`pool: 'threads'`).

Il simulatore (`engine/sim/`) ha due giocatori simulati: `casuale` (richiesto dal brief) e `semplice` (buon senso, come il bot). Le varianti modificano lo stato iniziale senza toccare i file dati.

## Regole di lavoro

- Il motore è una funzione pura `applica(stato, azione)`: niente `Math.random`, `Date`, rete o DOM. La casualità passa da `stato.rng`.
- Numeri, carte e testi del gioco stanno nei file dati, non nel codice.
- Nomi di variabili, funzioni, tipi e commenti in italiano, come nel resto del codice.
- Tutti i testi visibili ai giocatori (fasi successive) stanno in un unico file di stringhe.
- Niente grafica, nomi o testi copiati da giochi esistenti. I PDF dei regolamenti originali non vanno nel repository.
- Costo zero: solo GitHub Free, GitHub Pages, Firebase Spark. Mai Firebase Blaze né Cloud Functions.
