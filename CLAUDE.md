# Happy Little Sheeps

Gioco di carte nel browser per 2–4 giocatori. Brief canonico: `brief-codice2.md`. Specifica del motore e decisioni sui casi ambigui: `docs/motore.md`.

## Struttura

- `engine/` — motore puro in TypeScript: `src/` (codice), `data/` (`cards.json`, `setup.json`), `test/` (Vitest; aiuti in `test/aiuti.ts`).
- `design/` — pacchetto grafico definitivo (SVG, token, guida di stile). Non ridisegnare.
- `client/` — interfaccia React (Vite, radice `client/`): `src/partita/` modalità "Passa il telefono", `src/remoto/` più dispositivi, `src/testi.ts` tutte le stringhe. `client/prova.html` (solo sviluppo, non pubblicata): tre telefoni affiancati su un database in memoria.
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

Il simulatore (`engine/sim/`) ha due giocatori simulati: `casuale` (richiesto dal brief) e `semplice` (buon senso, come il bot). Le varianti modificano lo stato iniziale senza toccare i file dati.

## Regole di lavoro

- Il motore è una funzione pura `applica(stato, azione)`: niente `Math.random`, `Date`, rete o DOM. La casualità passa da `stato.rng`.
- Numeri, carte e testi del gioco stanno nei file dati, non nel codice.
- Nomi di variabili, funzioni, tipi e commenti in italiano, come nel resto del codice.
- Tutti i testi visibili ai giocatori (fasi successive) stanno in un unico file di stringhe.
- Niente grafica, nomi o testi copiati da giochi esistenti. I PDF dei regolamenti originali non vanno nel repository.
- Costo zero: solo GitHub Free, GitHub Pages, Firebase Spark. Mai Firebase Blaze né Cloud Functions.
