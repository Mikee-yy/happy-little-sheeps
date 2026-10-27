# Happy Little Sheeps

Gioco di carte nel browser per 2–4 giocatori. Ogni giocatore guida una pecora e un Ovile da riempire di agnellini, tra Guai, Trovate, Belati e un Dado del Pastore.

**Si gioca qui: https://mikee-yy.github.io/happy-little-sheeps/**

Non bisogna installare niente: basta aprire il link sul telefono (funziona anche sul computer).

## Come si gioca

Dalla schermata iniziale ci sono tre modi.

1. **Gioca su questo dispositivo.** Un solo telefono che passa di mano in mano: a ogni turno si vede solo la propria mano, poi lo si passa al giocatore successivo.
2. **Crea stanza / Entra in una stanza.** Un telefono per giocatore. Uno crea la stanza e comunica agli altri il codice, che gli altri inseriscono con "Entra in una stanza". Si può anche collegare un proiettore o una TV come "tavolo" comune, che mostra la scena senza mai far vedere le mani.
3. **Partita di prova.** Tu contro due bot (Bea e Leo), con consigli che spiegano le cose man mano che succedono. Il modo migliore per imparare.

Le regole complete sono nel gioco, con il pulsante **Regole**.

## Le regole in breve

- **Scopo:** riempire per primo il proprio Ovile di agnellini; oppure restare l'ultima pecora in gioco; oppure, a mazzo finito, avere più agnellini di tutti (a parità, meno Guai).
- **Ogni round:** si scopre un Guaio (Meteo, Predatori, Drammi o Tosatura a Sorpresa); tutti scelgono in segreto una Trovata (valore da 0 a 9; due Gemelle si sommano); le Trovate si scoprono e gli effetti si risolvono. Chi ha il punteggio più alto lancia il Dado del Pastore, chi ha il più basso prende il Guaio (ma riceve un agnellino di consolazione). A fine round si ripesca fino a 5 carte.
- **Dado del Pastore:** Pascolo (prendi agnellini dal Gregge), Furto (ruba agli altri), Testata del Montone (tiri indietro il Montone come una fionda e lo lasci andare verso l'Ovile di un avversario: più colpisci vicino al centro, più agnellini togli).
- **Belati:** carte giocate fuori turno. Beee-NO! annulla una Trovata, un altro Belato o il risultato del dado (anche un altro Beee-NO!).
- **Eliminazione:** si esce con 3 Guai dello stesso tipo, oppure con 4 Guai di tipi diversi (Meteo, Predatore, Dramma, Tosatura a Sorpresa; la Tosatura fa da jolly). In due giocatori servono 4 Guai uguali o 4 diversi.
- **Parità:** si risolvono con un lancio di dado o con il Belato Finale; i dettagli sono nelle Regole del gioco.

---

# Per chi riprende il progetto

## Cosa c'è nel repository

- `engine/` — il motore del gioco in TypeScript, puro (`applica(stato, azione)`, niente rete né casualità esterna), con dati (`data/`), test (`test/`) e simulatore (`sim/`).
- `client/` — l'interfaccia React (Vite): modalità su un dispositivo, stanze, scena 2,5D, regia e scelte; tutte le stringhe sono in `client/src/testi.ts`.
- `sync/` — la sincronizzazione delle stanze: sessione locale e sessione host/ospite sopra un trasporto (Firebase vero, o in memoria per i test).
- `design/` — il pacchetto grafico definitivo (SVG, token, guida di stile).
- `docs/` — le specifiche (motore, Firebase, rapporto del simulatore).
- `bozze/` — lavori in corso fuori dal sito, piani e la lista di ciò che resta (`da-fare.md`).
- `database.rules.json` — le regole di accesso del database delle stanze.

Altre indicazioni di lavoro (convenzioni, struttura nel dettaglio) sono in `CLAUDE.md`; il brief originale è `brief-codice2.md`.

## Provarlo in locale

Serve Node.js. Poi, dalla cartella del progetto:

```bash
npm install          # una volta sola
npm run dev          # sito in locale (Vite)
npm test             # tutti i test
npm run typecheck    # controllo dei tipi
npm run build        # compila il sito in client/dist
```

Altri comandi: `npm run simula` (simulatore di partite) e `npm run esperimenti`.

## Come si pubblica

Il sito è statico, su GitHub Pages. A ogni push sul ramo `main` parte il workflow `.github/workflows/pubblica.yml`: controlla i tipi, esegue i test, compila e pubblica `client/dist`. Se un controllo fallisce il sito resta com'era. Si può rilanciare anche a mano dalla scheda Actions del repository.

## Stanze: Firebase

Le stanze usano Firebase Realtime Database con accesso anonimo, sul piano gratuito **Spark**. La guida passo per passo, interamente dal browser, è in `docs/firebase.md`. Le regole di accesso stanno in `database.rules.json` e vanno incollate nella console di Firebase (scheda Regole). Le chiavi web di Firebase sono pubbliche per natura: la protezione sono le regole.

## Costo zero

Solo GitHub Free, GitHub Pages e Firebase Spark. Mai il piano Blaze, mai Cloud Functions. Nel repository non devono finire dati personali.
