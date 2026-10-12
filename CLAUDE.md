# Happy Little Sheeps

Gioco di carte nel browser per 2–4 giocatori. Brief canonico: `brief-codice2.md`. Specifica del motore e decisioni sui casi ambigui: `docs/motore.md`.

## Struttura

- `engine/` — motore puro in TypeScript: `src/` (codice), `data/` (`cards.json`, `setup.json`), `test/` (Vitest; aiuti in `test/aiuti.ts`).
- `design/` — pacchetto grafico definitivo (SVG, token, guida di stile). Non ridisegnare.
- `client/`, `sync/` — arriveranno nelle fasi 3 e 4.
- `docs/` — specifiche.

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
